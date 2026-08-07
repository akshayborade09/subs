export type CoverageRequestState = 'idle' | 'submitting' | 'submitted' | 'error';

const requestedPincodes: string[] = [];

/** Local stand-in until a backend endpoint is wired up. */
export async function submitCoverageRequest(pincode: string): Promise<void> {
  const normalized = pincode.trim();
  if (!/^\d{6}$/.test(normalized)) {
    throw new Error('Invalid pincode');
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (!requestedPincodes.includes(normalized)) {
    requestedPincodes.push(normalized);
  }
}

export function getCoverageRequests(): readonly string[] {
  return requestedPincodes;
}
