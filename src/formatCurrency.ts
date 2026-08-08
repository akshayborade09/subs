/** Indian grouping — e.g. 13549 → 13,549, 149999 → 1,49,999 */
export function formatInr(amount: number): string {
  return amount.toLocaleString('en-IN');
}

export function formatRupee(amount: number): string {
  return `₹${formatInr(amount)}`;
}
