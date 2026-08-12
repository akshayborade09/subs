/**
 * Thin client for the Healthy Tiffins backend (akshayborade09/subs-backend).
 *
 * Backend mode is opt-in: set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.5:4000)
 * and the wired modules call the real API; leave it unset and every flow keeps
 * running on the local mocks exactly as before.
 */
const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const rawMobbinBaseUrl = process.env.EXPO_PUBLIC_MOBBIN_API_URL ?? '';
const rawMobbinApiKey = process.env.EXPO_PUBLIC_MOBBIN_API_KEY ?? '';

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');
export const MOBBIN_API_BASE_URL = rawMobbinBaseUrl.replace(/\/+$/, '');
export const MOBBIN_API_KEY = rawMobbinApiKey;
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

export async function mobbinFetch<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
): Promise<T> {
  if (MOBBIN_API_BASE_URL.length === 0) {
    throw new Error('EXPO_PUBLIC_MOBBIN_API_URL is not set — Mobbin API is unavailable.');
  }
  if (MOBBIN_API_KEY.length === 0) {
    throw new Error('EXPO_PUBLIC_MOBBIN_API_KEY is not set — Mobbin authentication is required.');
  }
  const response = await fetch(`${MOBBIN_API_BASE_URL}/${path.replace(/^\/+/, '')}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${MOBBIN_API_KEY}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      'MOBBIN_API_ERROR',
      `Mobbin request failed (${response.status})`,
      payload,
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

export type NutritionProfileResponse = {
  setupCompleted: boolean;
  setup: Record<string, unknown> | null;
};

export type NutritionDayResponse = {
  date: string;
  waterMl: number;
  meals: Array<{ id: string; foodItems: Array<Record<string, unknown>> }>;
};

export type NutritionAggregateResponse = {
  start: string;
  mode: 'weekly' | 'monthly';
  days: NutritionDayResponse[];
};

export function fetchNutritionProfile(): Promise<NutritionProfileResponse> {
  return apiFetch<NutritionProfileResponse>('/me/nutrition/profile');
}

export function saveNutritionSetup(payload: Record<string, unknown>): Promise<void> {
  return apiFetch('/me/nutrition/setup', { body: payload }).then(() => undefined);
}

export function fetchNutritionDay(date: string): Promise<NutritionDayResponse> {
  return apiFetch<NutritionDayResponse>(`/me/nutrition/days/${date}`);
}

export function fetchNutritionAggregate(
  mode: 'weekly' | 'monthly',
  start: string,
): Promise<NutritionAggregateResponse> {
  return apiFetch<NutritionAggregateResponse>(`/me/nutrition/aggregate?mode=${mode}&start=${start}`);
}

/** Absolute total rather than a delta, so a retried request stays idempotent. */
export function saveWaterTotal(date: string, totalMl: number): Promise<void> {
  return apiFetch('/me/nutrition/water', { method: 'PATCH', body: { date, totalMl } }).then(() => undefined);
}

export function saveMealItems(
  date: string,
  mealId: string,
  items: Array<Record<string, unknown>>,
): Promise<void> {
  return apiFetch('/me/nutrition/meals', { method: 'PATCH', body: { date, mealId, items } }).then(
    () => undefined,
  );
}
