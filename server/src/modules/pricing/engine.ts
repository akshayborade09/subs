/**
 * Backend-authoritative pricing. The client displays what this returns and never
 * computes a total itself (handoff §3).
 *
 * Calculation order is fixed by checkout-profile-loyalty-spec §5.5:
 *
 *   effective plan price   (list price less any plan-level discount)
 *   − coupon discount
 *   − trial credit
 *   − loyalty/reward credit
 *   + delivery charge
 *   + tax on the legally applicable base
 *   = total payable, floored at zero
 *
 * Every value is integer paise. Pure and dependency-free so the whole table of
 * cases is unit-testable.
 */
export type PriceInputs = {
  listPricePaise: number;
  planDiscountPaise?: number;
  couponDiscountPaise?: number;
  trialCreditPaise?: number;
  rewardCreditPaise?: number;
  deliveryChargesPaise?: number;
  /** Tax rate in basis points. 0 for MVP — the app shows "Included". */
  taxBps?: number;
};

export type PriceBreakdown = {
  planPricePaise: number;
  deliveryChargesPaise: number;
  taxesPaise: number;
  discountPaise: number;
  trialCreditPaise: number;
  rewardCreditPaise: number;
  totalPayablePaise: number;
};

export function computePrice(input: PriceInputs): PriceBreakdown {
  const list = nonNegative(input.listPricePaise);
  const planDiscount = clamp(nonNegative(input.planDiscountPaise ?? 0), 0, list);
  const planPrice = list - planDiscount;

  // Credits and coupons can never exceed what is actually owed, otherwise a large
  // coupon on a small plan would turn into a refund.
  const coupon = clamp(nonNegative(input.couponDiscountPaise ?? 0), 0, planPrice);
  let remaining = planPrice - coupon;

  const trialCredit = clamp(nonNegative(input.trialCreditPaise ?? 0), 0, remaining);
  remaining -= trialCredit;

  const rewardCredit = clamp(nonNegative(input.rewardCreditPaise ?? 0), 0, remaining);
  remaining -= rewardCredit;

  const delivery = nonNegative(input.deliveryChargesPaise ?? 0);
  const taxes = Math.round((remaining * nonNegative(input.taxBps ?? 0)) / 10_000);

  return {
    planPricePaise: planPrice,
    deliveryChargesPaise: delivery,
    taxesPaise: taxes,
    discountPaise: coupon,
    trialCreditPaise: trialCredit,
    rewardCreditPaise: rewardCredit,
    totalPayablePaise: Math.max(0, remaining + delivery + taxes),
  };
}

const nonNegative = (value: number): number => (Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** ₹2,499 — for display strings the backend owns (transactions, receipts). */
export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
