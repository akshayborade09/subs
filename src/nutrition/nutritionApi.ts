/**
 * Routes nutrition calls to the backend when EXPO_PUBLIC_API_URL is set and to
 * local mocks otherwise, so the prototype keeps working with no server.
 */
import {
  backendEnabled,
  fetchNutritionDay as fetchNutritionDayRequest,
  saveMealItems as saveMealItemsRequest,
  saveNutritionSetup as saveNutritionSetupRequest,
  saveWaterTotal as saveWaterTotalRequest,
} from '../api/client';
import type { NutritionFoodItem, NutritionOnboardingState } from './types';

const MOCK_LATENCY_MS = 220;

function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

export async function pushNutritionSetup(setup: NutritionOnboardingState): Promise<void> {
  if (!backendEnabled) {
    await mockDelay(undefined);
    return;
  }
  await saveNutritionSetupRequest(setup as unknown as Record<string, unknown>);
}

/**
 * Subscription meal details for a day. Mock mode resolves immediately; the
 * caller keeps the meal card mounted and shows Retry when this rejects.
 *
 * The backend response is not merged yet — day content still comes from the
 * local store until the server's meal payload shape is settled.
 */
export async function pullNutritionDay(date: string): Promise<{ synced: boolean }> {
  if (!backendEnabled) {
    await mockDelay(undefined);
    return { synced: false };
  }
  await fetchNutritionDayRequest(date);
  return { synced: true };
}

/** Sends the resulting total, not the increment, so retries cannot double-count. */
export async function pushWaterTotal(date: string, totalMl: number): Promise<void> {
  if (!backendEnabled) {
    await mockDelay(undefined);
    return;
  }
  await saveWaterTotalRequest(date, totalMl);
}

export async function pushMealItems(
  date: string,
  mealId: string,
  items: NutritionFoodItem[],
): Promise<void> {
  if (!backendEnabled) {
    await mockDelay(undefined);
    return;
  }
  await saveMealItemsRequest(date, mealId, items as unknown as Array<Record<string, unknown>>);
}
