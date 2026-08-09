import {
  backendEnabled,
  checkServiceability as apiCheckServiceability,
  fetchServiceableAreas,
} from './api/client';

export type DeliveryAvailabilityState = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

export type PincodeServiceabilityState = 'idle' | 'checking' | 'serviceable' | 'notServiceable' | 'error';

export type ServiceabilityResponse = {
  serviceable: boolean;
  pincode: string;
  areaName?: string;
};

export type ServiceableArea = {
  pincode: string;
  areaName: string;
};

/** @deprecated Prefer getServiceableAreas() — kept for legacy coverage-request UI only. */
export const supportedDeliveryPincodes = ['400100', '400051', '400068', '400081'] as const;

const mockServiceableAreas: ServiceableArea[] = [
  { pincode: '400068', areaName: 'Dahisar East' },
  { pincode: '400101', areaName: 'Kandivali East' },
  { pincode: '400100', areaName: 'Malad East' },
  { pincode: '400051', areaName: 'Airoli' },
  { pincode: '400081', areaName: 'Andheri East' },
];

export function extractPincode(value: string): string {
  const match = value.match(/\b(\d{6})\b/);
  return match?.[1] ?? '';
}

export function isValidIndianPincodeFormat(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(pincode.trim());
}

function normalizePincode(pincode: string): string {
  return pincode.replace(/\D/g, '').slice(0, 6);
}

function mockDelay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Development mock — replace with POST /v1/serviceability/check when the API is live. */
async function mockCheckPincodeServiceability(pincode: string): Promise<ServiceabilityResponse> {
  await mockDelay();
  const normalized = normalizePincode(pincode);
  const area = mockServiceableAreas.find((item) => item.pincode === normalized);
  return {
    serviceable: !!area,
    pincode: normalized,
    areaName: area?.areaName,
  };
}

/** Development mock — replace with GET /v1/serviceability/areas when the API is live. */
async function mockGetServiceableAreas(): Promise<ServiceableArea[]> {
  await mockDelay(250);
  return [...mockServiceableAreas].sort((a, b) => a.pincode.localeCompare(b.pincode));
}

export async function checkPincodeServiceability({ pincode }: { pincode: string }): Promise<ServiceabilityResponse> {
  const normalized = normalizePincode(pincode);
  if (!isValidIndianPincodeFormat(normalized)) {
    throw new Error('Invalid pincode format');
  }
  if (backendEnabled) {
    const result = await apiCheckServiceability(normalized);
    return {
      serviceable: result.serviceable,
      pincode: result.pincode,
      areaName: result.areaName ?? undefined,
    };
  }
  return mockCheckPincodeServiceability(normalized);
}

export async function getServiceableAreas(): Promise<ServiceableArea[]> {
  if (backendEnabled) return fetchServiceableAreas();
  return mockGetServiceableAreas();
}

export function pincodeServiceabilityToAvailability(state: PincodeServiceabilityState): DeliveryAvailabilityState {
  if (state === 'serviceable') return 'available';
  if (state === 'notServiceable') return 'unavailable';
  if (state === 'checking') return 'checking';
  if (state === 'error') return 'error';
  return 'idle';
}

export function eligibilityPincodeMessage(state: PincodeServiceabilityState): string | null {
  if (state === 'checking') return 'Checking delivery availability…';
  if (state === 'serviceable') return 'Yay! We deliver to this pincode.';
  if (state === 'notServiceable') return "We're sorry! We don't deliver to this pincode yet.";
  if (state === 'error') return "We couldn't check this pincode right now. Please try again.";
  return null;
}

/** Used by the delivery address map flow — delegates to the same serviceability backend. */
export async function checkDeliveryAvailability(pincode: string): Promise<DeliveryAvailabilityState> {
  const normalized = normalizePincode(pincode);
  if (normalized.length !== 6) return 'idle';
  if (!isValidIndianPincodeFormat(normalized)) return 'error';

  try {
    const response = await checkPincodeServiceability({ pincode: normalized });
    return response.serviceable ? 'available' : 'unavailable';
  } catch {
    return 'error';
  }
}

/** @deprecated Use isValidIndianPincodeFormat + checkPincodeServiceability instead. */
export function isDeliveryAvailable(pincode: string): boolean {
  const normalized = normalizePincode(pincode);
  return mockServiceableAreas.some((area) => area.pincode === normalized);
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
