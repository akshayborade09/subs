import type { ComponentType } from 'react';

declare const SelectableMap: ComponentType<{ compact?: boolean; thumbnail?: boolean; searchQuery?: string; fill?: boolean; onAddressChange?: (address: string) => void }>;
export default SelectableMap;
