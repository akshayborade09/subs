/**
 * Thin client for the Healthy Tiffins backend (akshayborade09/subs-backend).
 *
 * Backend mode is opt-in: set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.5:4000)
 * and the wired modules call the real API; leave it unset and every flow keeps
 * running on the local mocks exactly as before.
 */
const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const backendEnabled = API_BASE_URL.length > 0;

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function isSignedIn(): boolean {
  return accessToken !== null;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  if (!backendEnabled) {
    throw new Error('EXPO_PUBLIC_API_URL is not set — backend mode is disabled.');
  }
  const response = await fetch(`${API_BASE_URL}/v1${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { code: string; message: string; details?: unknown } })
    | null;
  if (!response.ok || (payload && payload.error)) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }
  return payload as T;
}

/**
 * OTP sign-in. The dev backend returns the code in the response (devCode) so a
 * phone-less demo can complete verification; production providers will not.
 */
export async function startOtp(phone: string): Promise<{ devCode: string | null }> {
  const response = await apiFetch<{ devCode?: string }>('/auth/otp/start', {
    body: { phone },
  });
  return { devCode: response.devCode ?? null };
}

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const response = await apiFetch<{ accessToken: string }>('/auth/otp/verify', {
    body: { phone, code },
  });
  setAccessToken(response.accessToken);
}

export type ServiceabilityCheck = {
  serviceable: boolean;
  pincode: string;
  areaName: string | null;
};

export function checkServiceability(pincode: string): Promise<ServiceabilityCheck> {
  return apiFetch<ServiceabilityCheck>('/serviceability/check', { body: { pincode } });
}

export async function fetchServiceableAreas(): Promise<Array<{ pincode: string; areaName: string }>> {
  const response = await apiFetch<{ areas: Array<{ pincode: string; areaName: string }> }>(
    '/serviceability/areas',
  );
  return response.areas;
}

export function requestCoverage(pincode: string): Promise<void> {
  return apiFetch('/serviceability/coverage-requests', { body: { pincode } }).then(() => undefined);
}

/** Persists a completed wizard step so the server-side draft mirrors the client. */
export function completeOnboardingStep(
  step: string,
  payload: Record<string, unknown>,
): Promise<void> {
  return apiFetch('/me/onboarding/step', { body: { step, payload } }).then(() => undefined);
}
