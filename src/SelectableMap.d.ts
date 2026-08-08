import type { ComponentType } from 'react';

declare const SelectableMap: ComponentType<{
  compact?: boolean;
  thumbnail?: boolean;
  searchQuery?: string;
  fill?: boolean;
  fullWidth?: boolean;
  onAddressChange?: (address: string) => void;
  onCoordinateChange?: (coordinate: { latitude: number; longitude: number }) => void;
}>;
export default SelectableMap;
