export type AddressLabelType = 'home' | 'office' | 'friends' | 'relatives' | 'custom';

export type AddressFlowMode = 'onboarding' | 'meal-edit' | 'add-address' | 'subscription';

export type MealDeliverySlot = 'lunch' | 'dinner';

export function deliveryAddressHeaderTitle(slot?: MealDeliverySlot) {
  if (slot) return `Delivery address - ${slot === 'lunch' ? 'Lunch' : 'Dinner'}`;
  return 'Delivery address';
}

export function editAddressHeaderTitle() {
  return 'Edit address';
}

/** @deprecated Use deliveryAddressHeaderTitle */
export function mealDeliveryLocationTitle(slot: MealDeliverySlot) {
  return deliveryAddressHeaderTitle(slot);
}

/** @deprecated Address details are on the combined delivery address screen */
export function mealAddressDetailsTitle(slot: MealDeliverySlot) {
  return deliveryAddressHeaderTitle(slot);
}

export function mealConfirmDeliveryTitle(slot: MealDeliverySlot) {
  return `Confirm delivery - ${slot === 'lunch' ? 'Lunch' : 'Dinner'}`;
}

export type AddressDetails = {
  deliveryLocation: string;
  number: string;
  society: string;
  landmark: string;
  instructions: string;
  labelType: AddressLabelType;
  customLabel: string;
  pincode: string;
};

export type SavedAddress = {
  id: string;
  labelType: AddressLabelType;
  customLabel?: string;
  deliveryLocation: string;
  number: string;
  society: string;
  landmark: string;
  instructions: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
};

export const ADDRESS_LABEL_OPTIONS: { id: AddressLabelType; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'office', label: 'Office' },
  { id: 'friends', label: "Friend's place" },
  { id: 'relatives', label: "Relative's place" },
  { id: 'custom', label: 'Others' },
];

export function emptyAddressDetails(deliveryLocation = ''): AddressDetails {
  return {
    deliveryLocation,
    number: '',
    society: '',
    landmark: '',
    instructions: '',
    labelType: 'home',
    customLabel: '',
    pincode: extractPincodeFromText(deliveryLocation),
  };
}

export function extractPincodeFromText(value: string): string {
  const match = value.match(/\b(\d{6})\b/);
  return match?.[1] ?? '';
}

export function addressLabelDisplay(address: Pick<SavedAddress, 'labelType' | 'customLabel'>): string {
  if (address.labelType === 'custom' && address.customLabel?.trim()) return address.customLabel.trim();
  return ADDRESS_LABEL_OPTIONS.find((option) => option.id === address.labelType)?.label ?? 'Home';
}

export function formatSavedAddressLines(address: Pick<SavedAddress, 'number' | 'society' | 'landmark' | 'deliveryLocation' | 'pincode'>): string {
  const parts = [address.number, address.society, address.landmark, address.deliveryLocation]
    .map((part) => part?.trim())
    .filter(Boolean);
  const pin = address.pincode?.trim();
  if (pin && !parts.join(', ').includes(pin)) parts.push(pin);
  return parts.join(', ');
}

export function formatSavedAddressUserLines(address: Pick<SavedAddress, 'number' | 'society' | 'landmark' | 'pincode'>): string {
  const parts = [address.number, address.society, address.landmark]
    .map((part) => part?.trim())
    .filter(Boolean);
  const pin = address.pincode?.trim();
  if (pin) parts.push(pin);
  return parts.join(', ');
}

export function savedAddressFromDetails(details: AddressDetails, id?: string): SavedAddress {
  return {
    id: id ?? `addr-${Date.now()}`,
    labelType: details.labelType,
    customLabel: details.labelType === 'custom' ? details.customLabel.trim() : undefined,
    deliveryLocation: details.deliveryLocation.trim(),
    number: details.number.trim(),
    society: details.society.trim(),
    landmark: details.landmark.trim(),
    instructions: details.instructions.trim(),
    pincode: details.pincode.trim() || extractPincodeFromText(details.deliveryLocation),
  };
}

export function detailsFromSavedAddress(address: SavedAddress): AddressDetails {
  return {
    deliveryLocation: address.deliveryLocation,
    number: address.number,
    society: address.society,
    landmark: address.landmark,
    instructions: address.instructions,
    labelType: address.labelType,
    customLabel: address.customLabel ?? '',
    pincode: address.pincode,
  };
}

export function canSaveDeliveryAddress(
  deliveryLocation: string,
  details: AddressDetails,
  availability: 'available' | 'checking' | 'idle' | 'unavailable' | 'error',
): boolean {
  const pincode = details.pincode.trim() || extractPincodeFromText(deliveryLocation);
  if (deliveryLocation.trim().length <= 2) return false;
  if (pincode.length !== 6) return false;
  if (availability !== 'available') return false;
  if (!details.number.trim()) return false;
  if (details.labelType === 'custom' && !details.customLabel.trim()) return false;
  return true;
}

export function addressDetailLine(details: Pick<AddressDetails, 'number' | 'society' | 'landmark'>): string {
  return [details.number, details.society, details.landmark]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

/** @deprecated Use canSaveDeliveryAddress */
export function addressDetailsValid(details: AddressDetails, availability: 'available' | 'checking' | 'idle' | 'unavailable' | 'error'): boolean {
  return canSaveDeliveryAddress(details.deliveryLocation, details, availability);
}

export function mealOverrideFromSavedAddress(address: SavedAddress) {
  return {
    text: formatSavedAddressLines(address),
    pincode: address.pincode,
    label: addressLabelDisplay(address),
    savedAddressId: address.id,
  };
}
