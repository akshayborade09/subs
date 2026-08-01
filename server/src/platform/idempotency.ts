import { createHash } from 'node:crypto';
import { db, type Tx } from './db/index.js';
import { AppError } from './errors.js';

const STALE_LOCK_MS = 60_000;

function hashRequest(endpoint: string, body: unknown): string {
  return createHash('sha256').update(`${endpoint}:${JSON.stringify(body ?? null)}`).digest('hex');
}

export type IdempotentResult<T> = { value: T; replayed: boolean };

/**
 * Idempotency-Key support for mutating routes (handoff §19.2).
 *
 * The critical detail: the key's transition to `completed`, carrying the response
 * body, commits in the SAME transaction as the effect. If those were two
 * transactions, a crash in between would let the client's retry run the effect a
 * second time — which for `/pay` means charging twice.
 */
export async function withIdempotency<T>(args: {
  userId: string;
  key: string | undefined;
  endpoint: string;
  body: unknown;
  run: (tx: Tx) => Promise<T>;
}): Promise<IdempotentResult<T>> {
  const { userId, key, endpoint, body, run } = args;

  // No key supplied: execute normally. Routes that must not be retried blindly
  // should require the header at the schema level instead.
  if (!key) {
    const value = await db.transaction().execute(run);
    return { value, replayed: false };
  }

  const requestHash = hashRequest(endpoint, body);

  const claimed = await db
    .insertInto('idempotency_keys')
    .values({ user_id: userId, key, endpoint, request_hash: requestHash, state: 'in_progress' })
    .onConflict((oc) => oc.columns(['user_id', 'key']).doNothing())
    .returning('key')
    .executeTakeFirst();

  if (!claimed) {
    const existing = await db
      .selectFrom('idempotency_keys')
      .selectAll()
      .where('user_id', '=', userId)
      .where('key', '=', key)
      .executeTakeFirstOrThrow();

    if (existing.request_hash !== requestHash) {
      throw new AppError(
        'IDEMPOTENCY_KEY_REUSED',
        'This idempotency key was already used with a different request.',
      );
    }

    if (existing.state === 'completed') {
      return { value: existing.response_body as T, replayed: true };
    }

    const lockAge = Date.now() - existing.locked_at.getTime();
    if (lockAge < STALE_LOCK_MS) {
      throw new AppError(
        'IDEMPOTENCY_IN_PROGRESS',
        'This request is still being processed. Retry in a moment.',
      );
    }

    // The previous attempt died mid-flight; take the lock over.
    await db
      .updateTable('idempotency_keys')
      .set({ locked_at: new Date() })
      .where('user_id', '=', userId)
      .where('key', '=', key)
      .execute();
  }

  try {
    const value = await db.transaction().execute(async (tx) => {
      const result = await run(tx);
      await tx
        .updateTable('idempotency_keys')
        .set({
          state: 'completed',
          response_status: 200,
          response_body: result as never,
          completed_at: new Date(),
        })
        .where('user_id', '=', userId)
        .where('key', '=', key)
        .execute();
      return result;
    });
    return { value, replayed: false };
  } catch (error) {
    // Release the claim so a corrected retry is not stuck behind a dead lock.
    await db
      .deleteFrom('idempotency_keys')
      .where('user_id', '=', userId)
      .where('key', '=', key)
      .where('state', '=', 'in_progress')
      .execute();
    throw error;
  }
}
