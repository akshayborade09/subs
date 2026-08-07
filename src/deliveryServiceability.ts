export type DeliveryAvailabilityState = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export const supportedDeliveryPincodes = ['400068', '400081', '400101'] as const;

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

/** Message shown under the location search box on the map screen. */
export function deliveryLocationAvailabilityMessage(state: DeliveryAvailabilityState): string | null {
  if (state === 'available') return 'Yay! We deliver to this pincode.';
  if (state === 'unavailable') return "We're sorry! We don't deliver to this pincode yet.";
  if (state === 'checking') return 'Checking delivery availability…';
  if (state === 'error') return 'Unable to check delivery availability right now.';
  return null;
}

/** Message shown on the address-details form. */
export function deliveryAvailabilityMessage(state: DeliveryAvailabilityState): string | null {
  if (state === 'available') return 'Delivery is available at this pincode';
  if (state === 'unavailable') return "We don't deliver to this pincode yet.";
  if (state === 'error') return 'Unable to check delivery availability right now.';
  return null;
}

export function canContinueFromMapSelection(location: string, availability: DeliveryAvailabilityState): boolean {
  return location.trim().length > 2 && availability === 'available';
}
