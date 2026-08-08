import {
  checkPincodeServiceability,
  isValidIndianPincodeFormat,
  type PincodeServiceabilityState,
  type ServiceabilityResponse,
} from './deliveryServiceability';

export type MealSelection = 'lunch' | 'dinner' | 'both';

export type DeliveryEligibilityState = {
  pincode: string;
  serviceability: PincodeServiceabilityState;
  serviceabilityResponse: ServiceabilityResponse | null;
  mealSelection: MealSelection | null;
  serviceableAreasOpen: boolean;
};

export type DeliveryEligibilityEvent =
  | { type: 'SET_PINCODE'; pincode: string }
  | { type: 'CHECK_PINCODE' }
  | { type: 'PINCODE_SERVICEABLE'; data: ServiceabilityResponse }
  | { type: 'PINCODE_NOT_SERVICEABLE'; data: ServiceabilityResponse }
  | { type: 'PINCODE_CHECK_FAILED' }
  | { type: 'SELECT_MEAL'; meal: MealSelection }
  | { type: 'OPEN_SERVICEABLE_AREAS' }
  | { type: 'CLOSE_SERVICEABLE_AREAS' }
  | { type: 'SELECT_SERVICEABLE_AREA'; pincode: string };

export const initialDeliveryEligibilityState = (
  pincode = '',
  mealSelection: MealSelection | null = null,
  trusted = false,
): DeliveryEligibilityState => {
  const normalized = pincode.replace(/\D/g, '').slice(0, 6);
  const valid = isValidIndianPincodeFormat(normalized);
  const serviceable = trusted && valid;
  return {
    pincode: normalized,
    serviceability: serviceable ? 'serviceable' : 'idle',
    serviceabilityResponse: serviceable ? { serviceable: true, pincode: normalized } : null,
    mealSelection: serviceable ? mealSelection : null,
    serviceableAreasOpen: false,
  };
};

export function mealSelectionToMealLabel(meal: MealSelection): string {
  if (meal === 'lunch') return 'Lunch';
  if (meal === 'dinner') return 'Dinner';
  return 'Both';
}

export function mealLabelToMealSelection(meal: string): MealSelection | null {
  if (meal === 'Lunch') return 'lunch';
  if (meal === 'Dinner') return 'dinner';
  if (meal === 'Both') return 'both';
  return null;
}

export function canContinueDeliveryEligibility(state: DeliveryEligibilityState): boolean {
  return (
    state.pincode.length === 6
    && isValidIndianPincodeFormat(state.pincode)
    && state.serviceability === 'serviceable'
    && state.mealSelection !== null
  );
}

export function deliveryEligibilityReducer(
  state: DeliveryEligibilityState,
  event: DeliveryEligibilityEvent,
): DeliveryEligibilityState {
  switch (event.type) {
    case 'SET_PINCODE': {
      const pincode = event.pincode.replace(/\D/g, '').slice(0, 6);
      return {
        ...state,
        pincode,
        serviceability: 'idle',
        serviceabilityResponse: null,
        mealSelection: null,
      };
    }
    case 'CHECK_PINCODE':
      return {
        ...state,
        serviceability: 'checking',
        serviceabilityResponse: null,
        mealSelection: null,
      };
    case 'PINCODE_SERVICEABLE':
      return {
        ...state,
        pincode: event.data.pincode,
        serviceability: 'serviceable',
        serviceabilityResponse: event.data,
      };
    case 'PINCODE_NOT_SERVICEABLE':
      return {
        ...state,
        pincode: event.data.pincode,
        serviceability: 'notServiceable',
        serviceabilityResponse: event.data,
        mealSelection: null,
      };
    case 'PINCODE_CHECK_FAILED':
      return {
        ...state,
        serviceability: 'error',
        serviceabilityResponse: null,
        mealSelection: null,
      };
    case 'SELECT_MEAL':
      if (state.serviceability !== 'serviceable') return state;
      return { ...state, mealSelection: event.meal };
    case 'OPEN_SERVICEABLE_AREAS':
      return { ...state, serviceableAreasOpen: true };
    case 'CLOSE_SERVICEABLE_AREAS':
      return { ...state, serviceableAreasOpen: false };
    case 'SELECT_SERVICEABLE_AREA':
      return {
        ...state,
        pincode: event.pincode.replace(/\D/g, '').slice(0, 6),
        serviceability: 'checking',
        serviceabilityResponse: null,
        mealSelection: null,
        serviceableAreasOpen: false,
      };
    default:
      return state;
  }
}

export async function runPincodeServiceabilityCheck(
  pincode: string,
): Promise<
  | { type: 'PINCODE_SERVICEABLE'; data: ServiceabilityResponse }
  | { type: 'PINCODE_NOT_SERVICEABLE'; data: ServiceabilityResponse }
  | { type: 'PINCODE_CHECK_FAILED' }
> {
  try {
    const data = await checkPincodeServiceability({ pincode });
    return data.serviceable
      ? { type: 'PINCODE_SERVICEABLE', data }
      : { type: 'PINCODE_NOT_SERVICEABLE', data };
  } catch {
    return { type: 'PINCODE_CHECK_FAILED' };
  }
}
