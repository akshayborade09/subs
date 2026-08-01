import { describe, expect, it } from 'vitest';
import { computePrice, formatRupees } from './engine.js';

const rupees = (value: number): number => value * 100;

describe('computePrice', () => {
  it('applies the plan discount to reach the displayed plan price', () => {
    // The Monthly plan: ₹5,499 list, ₹500 off.
    const price = computePrice({
      listPricePaise: rupees(5499),
      planDiscountPaise: rupees(500),
    });
    expect(price.planPricePaise).toBe(rupees(4999));
    expect(price.totalPayablePaise).toBe(rupees(4999));
  });

  it('follows the spec order: coupon, then trial credit, then reward credit', () => {
    const price = computePrice({
      listPricePaise: rupees(2799),
      couponDiscountPaise: rupees(300),
      trialCreditPaise: rupees(100),
      rewardCreditPaise: rupees(50),
    });
    expect(price.discountPaise).toBe(rupees(300));
    expect(price.trialCreditPaise).toBe(rupees(100));
    expect(price.rewardCreditPaise).toBe(rupees(50));
    expect(price.totalPayablePaise).toBe(rupees(2349));
  });

  it('never returns a negative total, however large the credits', () => {
    const price = computePrice({
      listPricePaise: rupees(500),
      couponDiscountPaise: rupees(9999),
      trialCreditPaise: rupees(9999),
      rewardCreditPaise: rupees(9999),
    });
    expect(price.totalPayablePaise).toBe(0);
  });

  it('caps a coupon at the plan price rather than turning it into a refund', () => {
    const price = computePrice({
      listPricePaise: rupees(1000),
      couponDiscountPaise: rupees(2500),
    });
    expect(price.discountPaise).toBe(rupees(1000));
    expect(price.totalPayablePaise).toBe(0);
  });

  it('stops crediting once nothing is owed, so credits are not silently burned', () => {
    const price = computePrice({
      listPricePaise: rupees(300),
      couponDiscountPaise: rupees(300),
      trialCreditPaise: rupees(100),
      rewardCreditPaise: rupees(100),
    });
    expect(price.trialCreditPaise).toBe(0);
    expect(price.rewardCreditPaise).toBe(0);
  });

  it('adds delivery after discounts, so a coupon cannot wipe out the delivery fee', () => {
    const price = computePrice({
      listPricePaise: rupees(500),
      couponDiscountPaise: rupees(500),
      deliveryChargesPaise: rupees(40),
    });
    expect(price.totalPayablePaise).toBe(rupees(40));
  });

  it('taxes the discounted base, not the list price', () => {
    const price = computePrice({
      listPricePaise: rupees(1000),
      couponDiscountPaise: rupees(500),
      taxBps: 500, // 5%
    });
    expect(price.taxesPaise).toBe(rupees(25));
    expect(price.totalPayablePaise).toBe(rupees(525));
  });

  it('is zero-tax by default, matching the app showing "Included"', () => {
    expect(computePrice({ listPricePaise: rupees(2799) }).taxesPaise).toBe(0);
  });

  it('ignores negative and non-finite inputs instead of trusting them', () => {
    const price = computePrice({
      listPricePaise: rupees(1000),
      couponDiscountPaise: -rupees(500),
      trialCreditPaise: Number.NaN,
    });
    expect(price.discountPaise).toBe(0);
    expect(price.trialCreditPaise).toBe(0);
    expect(price.totalPayablePaise).toBe(rupees(1000));
  });

  it('returns whole paise, never fractions', () => {
    const price = computePrice({ listPricePaise: 99_999, taxBps: 333 });
    expect(Number.isInteger(price.taxesPaise)).toBe(true);
    expect(Number.isInteger(price.totalPayablePaise)).toBe(true);
  });
});

describe('formatRupees', () => {
  it('formats in the Indian numbering system', () => {
    expect(formatRupees(rupees(2499))).toBe('₹2,499');
    expect(formatRupees(rupees(149999))).toBe('₹1,49,999');
    expect(formatRupees(0)).toBe('₹0');
  });
});
