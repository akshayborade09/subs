import { useCallback, useReducer } from 'react';
import type { AddressDetails, AddressFlowMode, SavedAddress } from './addressTypes';
import { emptyAddressDetails } from './addressTypes';
import { extractPincode, type DeliveryAvailabilityState } from './deliveryServiceability';
import type { CoverageRequestState } from './coverageRequestStore';

export type DeliveryAddressPhase =
  | 'mapSelection'
  | 'addressDetails'
  | 'selectingSavedAddress'
  | 'confirmingAddress'
  | 'completed';

export type DeliveryAddressEvent =
  | { type: 'LOCATION_SELECTED'; location: string }
  | { type: 'NEXT_FROM_MAP' }
  | { type: 'BACK_TO_MAP' }
  | { type: 'OPEN_SAVED_ADDRESSES' }
  | { type: 'CLOSE_SAVED_ADDRESSES' }
  | { type: 'SELECT_SAVED_ADDRESS'; address: SavedAddress }
  | { type: 'UPDATE_ADDRESS_DETAILS'; details: Partial<AddressDetails> }
  | { type: 'SELECT_ADDRESS_LABEL'; labelType: AddressDetails['labelType'] }
  | { type: 'SET_CUSTOM_ADDRESS_LABEL'; label: string }
  | { type: 'SET_PINCODE_AVAILABILITY'; availability: DeliveryAvailabilityState }
  | { type: 'OPEN_COVERAGE' }
  | { type: 'CLOSE_COVERAGE' }
  | { type: 'UPDATE_COVERAGE_REQUEST_PINCODE'; pincode: string }
  | { type: 'SUBMIT_COVERAGE_REQUEST' }
  | { type: 'COVERAGE_REQUEST_SUBMITTED' }
  | { type: 'COVERAGE_REQUEST_FAILED' }
  | { type: 'CONTINUE_TO_CONFIRM' }
  | { type: 'EDIT_ADDRESS' }
  | { type: 'ADDRESS_CONFIRMED' }
  | { type: 'RESET'; mode: AddressFlowMode; initialLocation?: string; initialDetails?: AddressDetails };

type DeliveryAddressState = {
  phase: DeliveryAddressPhase;
  mode: AddressFlowMode;
  deliveryLocation: string;
  details: AddressDetails;
  selectedSavedAddressId?: string;
  savedAddressesReturnPhase: DeliveryAddressPhase;
  availability: DeliveryAvailabilityState;
  coverageOpen: boolean;
  coverageRequestPincode: string;
  coverageRequestState: CoverageRequestState;
};

function reducer(state: DeliveryAddressState, event: DeliveryAddressEvent): DeliveryAddressState {
  switch (event.type) {
    case 'LOCATION_SELECTED': {
      const pincode = extractPincode(event.location);
      return {
        ...state,
        deliveryLocation: event.location,
        details: {
          ...state.details,
          deliveryLocation: event.location,
          pincode,
        },
      };
    }
    case 'NEXT_FROM_MAP':
      return { ...state, phase: 'addressDetails' };
    case 'BACK_TO_MAP':
      return { ...state, phase: 'mapSelection' };
    case 'OPEN_SAVED_ADDRESSES':
      return { ...state, phase: 'selectingSavedAddress', savedAddressesReturnPhase: state.phase };
    case 'CLOSE_SAVED_ADDRESSES':
      return { ...state, phase: state.savedAddressesReturnPhase };
    case 'SELECT_SAVED_ADDRESS':
      return {
        ...state,
        phase: 'addressDetails',
        selectedSavedAddressId: event.address.id,
        deliveryLocation: event.address.deliveryLocation,
        details: {
          deliveryLocation: event.address.deliveryLocation,
          number: event.address.number,
          society: event.address.society,
          landmark: event.address.landmark,
          instructions: event.address.instructions,
          labelType: event.address.labelType,
          customLabel: event.address.customLabel ?? '',
          pincode: event.address.pincode,
        },
      };
    case 'UPDATE_ADDRESS_DETAILS':
      return { ...state, details: { ...state.details, ...event.details }, selectedSavedAddressId: undefined };
    case 'SELECT_ADDRESS_LABEL':
      return {
        ...state,
        details: {
          ...state.details,
          labelType: event.labelType,
          customLabel: event.labelType === 'custom' ? state.details.customLabel : '',
        },
        selectedSavedAddressId: undefined,
      };
    case 'SET_CUSTOM_ADDRESS_LABEL':
      return { ...state, details: { ...state.details, customLabel: event.label, labelType: 'custom' }, selectedSavedAddressId: undefined };
    case 'SET_PINCODE_AVAILABILITY':
      return { ...state, availability: event.availability };
    case 'OPEN_COVERAGE':
      return {
        ...state,
        coverageOpen: true,
        coverageRequestPincode: state.coverageRequestPincode || state.details.pincode || extractPincode(state.deliveryLocation),
        coverageRequestState: 'idle',
      };
    case 'CLOSE_COVERAGE':
      return { ...state, coverageOpen: false };
    case 'UPDATE_COVERAGE_REQUEST_PINCODE':
      return {
        ...state,
        coverageRequestPincode: event.pincode.replace(/\D/g, '').slice(0, 6),
        coverageRequestState: 'idle',
      };
    case 'SUBMIT_COVERAGE_REQUEST':
      return { ...state, coverageRequestState: 'submitting' };
    case 'COVERAGE_REQUEST_SUBMITTED':
      return { ...state, coverageRequestState: 'submitted', coverageOpen: false };
    case 'COVERAGE_REQUEST_FAILED':
      return { ...state, coverageRequestState: 'error' };
    case 'CONTINUE_TO_CONFIRM':
      return { ...state, phase: 'confirmingAddress' };
    case 'EDIT_ADDRESS':
      return { ...state, phase: 'addressDetails' };
    case 'ADDRESS_CONFIRMED':
      return { ...state, phase: 'completed' };
    case 'RESET':
      return {
        phase: 'mapSelection',
        mode: event.mode,
        deliveryLocation: event.initialLocation ?? '',
        details: event.initialDetails ?? emptyAddressDetails(event.initialLocation ?? ''),
        selectedSavedAddressId: undefined,
        savedAddressesReturnPhase: 'mapSelection',
        availability: 'idle',
        coverageOpen: false,
        coverageRequestPincode: '',
        coverageRequestState: 'idle',
      };
    default:
      return state;
  }
}

export function useDeliveryAddressMachine(mode: AddressFlowMode, initialLocation = '', initialDetails?: AddressDetails) {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'mapSelection',
    mode,
    deliveryLocation: initialLocation,
    details: initialDetails ?? emptyAddressDetails(initialLocation),
    savedAddressesReturnPhase: 'mapSelection',
    availability: 'idle',
    coverageOpen: false,
    coverageRequestPincode: '',
    coverageRequestState: 'idle',
  });

  const send = useCallback((event: DeliveryAddressEvent) => {
    dispatch(event);
  }, []);

  return { ...state, send };
}
