import { db, type Executor, type Tx } from '../../platform/db/index.js';
import { todayIn } from '../../platform/time.js';

/**
 * Scoring from spec §15.3. Deliberately excludes app opens and notification taps:
 * the leaderboard rewards eating, not engagement farming.
 */
export const POINTS = {
  meal_delivered: 10,
  full_paid_week: 25,
  meal_rated: 2,
  referral_qualified: 50,
  monthly_streak: 100,
} as const;

export type PointEvent = keyof typeof POINTS;

export const currentPeriod = (today = todayIn(new Date())): string => `${today.slice(0, 7)}-01`;

/**
 * Points are server-authoritative and idempotent: the unique index on
 * (user_id, event_kind, source_type, source_id) is what stops a duplicate rating
 * or a redelivered event from paying twice.
 */
export async function awardPoints(
  tx: Executor,
  input: {
    userId: string;
    eventKind: PointEvent;
    sourceType: string;
    sourceId: string;
    period?: string;
  },
): Promise<boolean> {
  const inserted = await tx
    .insertInto('leaderboard_points')
    .values({
      user_id: input.userId,
      period: input.period ?? currentPeriod(),
      event_kind: input.eventKind,
      points: POINTS[input.eventKind],
      source_type: input.sourceType,
      source_id: input.sourceId,
    })
    .onConflict((oc) =>
      oc.columns(['user_id', 'event_kind', 'source_type', 'source_id']).doNothing(),
    )
    .returning('id')
    .executeTakeFirst();

  return inserted !== undefined;
}

/** Spec §15.6: a reversed payment reverses the points it earned. */
export async function reversePoints(
  tx: Tx,
  sourceType: string,
  sourceId: string,
): Promise<number> {
  const reversed = await tx
    .updateTable('leaderboard_points')
    .set({ reversed_at: new Date() })
    .where('source_type', '=', sourceType)
    .where('source_id', '=', sourceId)
    .where('reversed_at', 'is', null)
    .returning('id')
    .execute();
  return reversed.length;
}

export type LeaderboardEntry = {
  rank: number;
  displayName: string;
  points: number;
  isCurrentUser: boolean;
};

function displayName(fullName: string | null, isCurrentUser: boolean): string {
  if (isCurrentUser) return 'You';
  if (!fullName) return 'A member';
  const [first = '', last = ''] = fullName.trim().split(/\s+/);
  // Initials and a partial surname by default (spec §15.4).
  return last ? `${first[0]?.toUpperCase()}${'•'.repeat(5)} ${last[0]?.toUpperCase()}.` : `${first[0]?.toUpperCase()}${'•'.repeat(5)}`;
}

export async function getLeaderboard(userId: string, period = currentPeriod(), topN = 10) {
  const rows = await db
    .selectFrom('leaderboard_points')
    .innerJoin('users', 'users.id', 'leaderboard_points.user_id')
    .leftJoin('notification_preferences', 'notification_preferences.user_id', 'users.id')
    .select((eb) => [
      'users.id as user_id',
      'users.full_name',
      'notification_preferences.leaderboard_opt_in',
      eb.fn.sum<string>('leaderboard_points.points').as('points'),
    ])
    .where('leaderboard_points.period', '=', period)
    .where('leaderboard_points.reversed_at', 'is', null)
    .groupBy(['users.id', 'users.full_name', 'notification_preferences.leaderboard_opt_in'])
    .orderBy('points', 'desc')
    .orderBy('users.id')
    .execute();

  // Rank is computed over everyone, then opted-out users are hidden from the
  // public list. Opting out must not change anyone else's position, and must not
  // cost the user their own rank — spec §15.4.
  const ranked = rows.map((row, index) => ({
    userId: row.user_id,
    fullName: row.full_name,
    optedIn: row.leaderboard_opt_in !== false,
    points: Number(row.points),
    rank: index + 1,
  }));

  const me = ranked.find((row) => row.userId === userId);
  const publicRows = ranked.filter((row) => row.optedIn);

  const top: LeaderboardEntry[] = publicRows.slice(0, topN).map((row) => ({
    rank: row.rank,
    displayName: displayName(row.fullName, row.userId === userId),
    points: row.points,
    isCurrentUser: row.userId === userId,
  }));

  const inTop = top.some((entry) => entry.isCurrentUser);

  return {
    period,
    daysUntilReset: daysUntilReset(period),
    top,
    me: me
      ? {
          rank: me.rank,
          points: me.points,
          optedIn: me.optedIn,
          // Pinned separately when outside the visible top ranks.
          pinned: !inTop,
        }
      : { rank: null, points: 0, optedIn: true, pinned: false },
  };
}

function daysUntilReset(period: string): number {
  const start = new Date(`${period}T00:00:00Z`);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const today = new Date(`${todayIn(new Date())}T00:00:00Z`);
  return Math.max(0, Math.round((next.getTime() - today.getTime()) / 86_400_000));
}
