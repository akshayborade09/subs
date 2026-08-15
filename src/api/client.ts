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

const TOKEN_KEY = 'tiffins.accessToken';

/** Web localStorage when present (Expo web / browser demo); memory otherwise. */
function readStoredToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

let accessToken: string | null = readStoredToken();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token === null) globalThis.localStorage?.removeItem(TOKEN_KEY);
    else globalThis.localStorage?.setItem(TOKEN_KEY, token);
  } catch {
    // No storage available (native without a persistence module) — memory only.
  }
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
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  if (!backendEnabled) {
    throw new Error('EXPO_PUBLIC_API_URL is not set — backend mode is disabled.');
  }
  const response = await fetch(`${API_BASE_URL}/v1${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers ?? {}),
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

/**
 * The server-side router: lifecycle condition, legacy letter and the full Home
 * payload. In backend mode this replaces the app's local lifecycle machine as
 * the source of truth for where the user is.
 */
export type AppStateMarker = {
  mealOrderId: string;
  slot: 'lunch' | 'dinner';
  foodType: 'vegetarian' | 'non_vegetarian';
  status: string;
  showRipple: boolean;
};

export type AppStateWeekDay = {
  date: string;
  dayLabel: string;
  shortDate: string;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  markers: AppStateMarker[];
};

export type AppStateHome = {
  variant: string;
  eyebrow: string;
  title: string;
  description: string;
  caption: string | null;
  selectedLabel: string;
  selectedDate: string | null;
  week: AppStateWeekDay[];
  notice: { title: string; body: string; tone: string; action?: string } | null;
  planCard: { title: string; description: string; buttonLabel: string } | null;
};

export type AppState = {
  lifecycleState: string;
  legacyStateId: string | null;
  route: string;
  requiresAction: boolean;
  resumeStep: string | null;
  home: AppStateHome | null;
};

export function fetchAppState(): Promise<AppState> {
  return apiFetch<AppState>('/me/app-state');
}

/** Trial purchase surface. Enums are the server's; map app labels before calling. */
export function startTrialDraft(): Promise<void> {
  return apiFetch('/me/trial/draft', { method: 'POST', body: {} }).then(() => undefined);
}

export function saveTrialPreferences(payload: {
  foodPreference: string;
  mealPreference: string;
  breadPreference: string;
  ricePreference: string;
  dailyMeals?: Array<{ lunch: string | null; dinner: string | null }>;
}): Promise<void> {
  return apiFetch('/me/trial/preferences', { method: 'PATCH', body: payload }).then(() => undefined);
}

export function saveTrialDates(dates: string[]): Promise<void> {
  return apiFetch('/me/trial/dates', { method: 'PATCH', body: { dates } }).then(() => undefined);
}

export function saveTrialAddress(payload: {
  addressId?: string;
  lunchAddressId?: string;
  dinnerAddressId?: string;
}): Promise<void> {
  return apiFetch('/me/trial/address', { method: 'PATCH', body: payload }).then(() => undefined);
}

export function createSavedAddress(payload: Record<string, unknown>): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/me/addresses', { body: payload });
}

function idempotencyKey(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createTrialCheckout(paymentMethod: string): Promise<{ checkoutSessionId: string }> {
  return apiFetch<{ checkoutSessionId: string }>('/me/trial/checkout', {
    body: { paymentMethod },
    headers: { 'idempotency-key': idempotencyKey() },
  });
}

/** The mock provider settles via webhook moments later; poll fetchPaymentStatus. */
export function payCheckout(checkoutSessionId: string): Promise<{ paymentId: string }> {
  return apiFetch<{ paymentId: string }>(`/me/checkout/${checkoutSessionId}/pay`, {
    body: { scenario: 'success_immediate' },
    headers: { 'idempotency-key': idempotencyKey() },
  });
}

export function createSubscriptionCheckout(payload: {
  planCode: string;
  mealPreference: string;
  foodPreference: string;
  breadPreference: string;
  ricePreference: string;
}): Promise<{ checkoutSessionId: string }> {
  return apiFetch<{ checkoutSessionId: string }>('/me/subscriptions/checkout', {
    body: payload,
    headers: { 'idempotency-key': idempotencyKey() },
  });
}

export function fetchPaymentStatus(
  checkoutSessionId: string,
): Promise<{ step: string; paymentStatus: string; failureReason: string | null }> {
  return apiFetch(`/me/checkout/${checkoutSessionId}/payment-status`);
}
