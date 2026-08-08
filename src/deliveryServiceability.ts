export type DeliveryAvailabilityState = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export const supportedDeliveryPincodes = ['400100', '400051', '400068', '400081'] as const;

const serviceablePincodes = new Set<string>(supportedDeliveryPincodes);

export function extractPincode(value: string): string {
  const match = value.match(/\b(\d{6})\b/);
  return match?.[1] ?? '';
}

export function isDeliveryAvailable(pincode: string): boolean {
  return serviceablePincodes.has(pincode.trim());
}

/** Simulates a serviceability lookup. Extend with API integration later. */
export async function checkDeliveryAvailability(pincode: string): Promise<DeliveryAvailabilityState> {
  const normalized = pincode.trim();
  if (normalized.length !== 6) return 'idle';

  await new Promise((resolve) => setTimeout(resolve, 350));

  if (!/^\d{6}$/.test(normalized)) return 'error';
  return isDeliveryAvailable(normalized) ? 'available' : 'unavailable';
}

/** Message shown under the current location on the delivery address screen. */
export function deliveryLocationAvailabilityMessage(state: DeliveryAvailabilityState): string | null {
  if (state === 'available') return 'Yay! We deliver here.';
  if (state === 'unavailable') return "We're sorry! We don't deliver here yet.";
  if (state === 'checking') return 'Checking delivery availability…';
  if (state === 'error') return 'Unable to check delivery availability right now.';
  return null;
}

/** @deprecated Use deliveryLocationAvailabilityMessage for the combined delivery address screen. */
export function deliveryAvailabilityMessage(state: DeliveryAvailabilityState): string | null {
  return deliveryLocationAvailabilityMessage(state);
}
