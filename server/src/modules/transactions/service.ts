import { db } from '../../platform/db/index.js';
import { AppError } from '../../platform/errors.js';
import { transactionTimestamp } from '../../platform/time.js';
import { formatRupees } from '../pricing/engine.js';
import type { TransactionType } from '../../platform/db/types.js';

export type TransactionFilter = 'all' | 'payments' | 'refunds_credits' | 'rewards';

const TYPES_BY_FILTER: Record<TransactionFilter, TransactionType[] | null> = {
  all: null,
  payments: ['payment'],
  refunds_credits: ['refund', 'credit'],
  rewards: ['reward'],
};

export type TransactionRow = {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  /**
   * Both are returned because not every ledger entry is monetary: a reward reads
   * "Free meal day" with no amount, which is why the table carries two columns
   * rather than encoding it as a fake zero.
   */
  amountPaise: number | null;
  displayAmount: string;
  status: string;
  reference: string | null;
  occurredAt: string;
};

export type TransactionGroup = { month: string; label: string; transactions: TransactionRow[] };

function present(row: {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  amount_paise: number | null;
  display_amount: string | null;
  status: string;
  reference: string | null;
  occurred_at: Date;
}): TransactionRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtitle: row.subtitle,
    amountPaise: row.amount_paise,
    displayAmount:
      row.display_amount ?? (row.amount_paise !== null ? formatRupees(row.amount_paise) : '—'),
    status: row.status,
    reference: row.reference,
    occurredAt: row.occurred_at.toISOString(),
  };
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

/** Grouped by month, newest first — the shape the transactions screen renders. */
export async function listTransactions(
  userId: string,
  filter: TransactionFilter = 'all',
): Promise<TransactionGroup[]> {
  let query = db
    .selectFrom('transactions')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('occurred_at', 'desc');

  const types = TYPES_BY_FILTER[filter];
  if (types) query = query.where('type', 'in', types);

  const rows = await query.execute();

  const groups = new Map<string, TransactionGroup>();
  for (const row of rows) {
    const month = row.occurred_at.toISOString().slice(0, 7);
    let group = groups.get(month);
    if (!group) {
      group = { month, label: MONTH_LABEL.format(row.occurred_at), transactions: [] };
      groups.set(month, group);
    }
    group.transactions.push(present(row));
  }
  return [...groups.values()];
}

export async function getTransaction(userId: string, transactionId: string) {
  const row = await db
    .selectFrom('transactions')
    .selectAll()
    .where('id', '=', transactionId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!row) throw new AppError('NOT_FOUND', 'Transaction not found.');

  const payment = row.payment_id
    ? await db
        .selectFrom('payments')
        .innerJoin('checkout_sessions', 'checkout_sessions.id', 'payments.checkout_session_id')
        .select([
          'payments.provider',
          'payments.status as payment_status',
          'payments.created_at as initiated_at',
          'payments.updated_at as settled_at',
          'payments.failure_reason',
          'checkout_sessions.payment_method',
          'checkout_sessions.kind',
          'checkout_sessions.plan_price_paise',
          'checkout_sessions.delivery_charges_paise',
          'checkout_sessions.taxes_paise',
          'checkout_sessions.discount_paise',
          'checkout_sessions.trial_credit_paise',
          'checkout_sessions.reward_credit_paise',
          'checkout_sessions.total_payable_paise',
          'checkout_sessions.coupon_id',
        ])
        .where('payments.id', '=', row.payment_id)
        .executeTakeFirst()
    : undefined;

  const coupon = payment?.coupon_id
    ? await db
        .selectFrom('coupons')
        .select(['code', 'title'])
        .where('id', '=', payment.coupon_id)
        .executeTakeFirst()
    : undefined;

  return {
    ...present(row),
    subtitleLabel: transactionTimestamp(row.occurred_at),
    paymentMethod: payment?.payment_method ?? (row.type === 'reward' ? 'Reward credit' : null),
    purchaseKind: payment?.kind ?? null,
    failureReason: payment?.failure_reason ?? null,
    priceBreakdown: payment
      ? {
          planPricePaise: payment.plan_price_paise,
          deliveryChargesPaise: payment.delivery_charges_paise,
          taxesPaise: payment.taxes_paise,
          discountPaise: payment.discount_paise,
          trialCreditPaise: payment.trial_credit_paise,
          rewardCreditPaise: payment.reward_credit_paise,
          totalPayablePaise: payment.total_payable_paise,
        }
      : null,
    coupon: coupon ? { code: coupon.code, title: coupon.title } : null,
    timeline: buildTimeline(row.status, payment?.initiated_at ?? row.occurred_at, payment?.settled_at ?? null),
  };
}

/** A simple status history so the detail screen can show progression. */
function buildTimeline(status: string, initiatedAt: Date, settledAt: Date | null) {
  const steps = [{ label: 'Initiated', at: initiatedAt.toISOString() }];
  if (status === 'succeeded' || status === 'credited') {
    steps.push({ label: 'Completed', at: (settledAt ?? initiatedAt).toISOString() });
  } else if (status === 'failed') {
    steps.push({ label: 'Failed', at: (settledAt ?? initiatedAt).toISOString() });
  } else if (status === 'refunded' || status === 'partially_refunded') {
    steps.push({ label: 'Completed', at: initiatedAt.toISOString() });
    steps.push({ label: 'Refunded', at: (settledAt ?? initiatedAt).toISOString() });
  }
  return steps;
}
