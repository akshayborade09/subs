import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SavedAddress } from './addressTypes';
import { savedAddressFromDetails, type AddressDetails } from './addressTypes';

export const demoSavedAddresses: SavedAddress[] = [
  {
    id: 'demo-home',
    labelType: 'home',
    deliveryLocation: 'Dahisar East, Mumbai',
    number: 'B-704',
    society: 'Green View Apartments',
    landmark: '',
    instructions: 'Leave with security if unavailable.',
    pincode: '400068',
    isDefault: true,
  },
  {
    id: 'demo-office',
    labelType: 'office',
    deliveryLocation: 'Dahisar East, Mumbai',
    number: '402',
    society: 'Sky Vista',
    landmark: 'Near station',
    instructions: '',
    pincode: '400068',
  },
];

type SavedAddressesContextValue = {
  savedAddresses: SavedAddress[];
  defaultAddressId: string | null;
  upsertAddress: (details: AddressDetails, existingId?: string) => SavedAddress;
  setDefaultAddress: (id: string) => void;
  removeAddress: (id: string) => void;
  getAddressById: (id: string) => SavedAddress | undefined;
};

const SavedAddressesContext = createContext<SavedAddressesContextValue | null>(null);

export function SavedAddressesProvider({ children }: { children: ReactNode }) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(demoSavedAddresses);
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>('demo-home');

  const upsertAddress = useCallback((details: AddressDetails, existingId?: string) => {
    const next = savedAddressFromDetails(details, existingId);
    setSavedAddresses((current) => {
      const index = existingId ? current.findIndex((item) => item.id === existingId) : -1;
      if (index >= 0) {
        const copy = [...current];
        copy[index] = { ...next, isDefault: current[index]?.isDefault };
        return copy;
      }
      return [...current, next];
    });
    setDefaultAddressId((currentDefault) => currentDefault ?? next.id);
    return next;
  }, []);

  const setDefaultAddress = useCallback((id: string) => {
    setDefaultAddressId(id);
    setSavedAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === id })));
  }, []);

  const removeAddress = useCallback((id: string) => {
    setSavedAddresses((current) => current.filter((item) => item.id !== id));
    setDefaultAddressId((current) => (current === id ? null : current));
  }, []);

  const getAddressById = useCallback((id: string) => savedAddresses.find((item) => item.id === id), [savedAddresses]);

  const value = useMemo(
    () => ({ savedAddresses, defaultAddressId, upsertAddress, setDefaultAddress, removeAddress, getAddressById }),
    [savedAddresses, defaultAddressId, upsertAddress, setDefaultAddress, removeAddress, getAddressById],
  );

  return <SavedAddressesContext.Provider value={value}>{children}</SavedAddressesContext.Provider>;
}

export function useSavedAddresses() {
  const context = useContext(SavedAddressesContext);
  if (!context) throw new Error('useSavedAddresses must be used within SavedAddressesProvider');
  return context;
}
