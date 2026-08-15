import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  backendEnabled,
  createSavedAddress,
  deleteAddressOnServer,
  isSignedIn,
  listSavedAddresses,
  onAuthChange,
  setDefaultAddressOnServer,
  type ServerAddress,
} from './api/client';
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

const isServerId = (value: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);

/** Server rows → the app's SavedAddress shape (lossless since 08c2f0c). */
function fromServer(row: ServerAddress): SavedAddress {
  return {
    id: row.id,
    labelType: (['home', 'office', 'friends', 'relatives', 'custom'].includes(row.label)
      ? row.label
      : 'custom') as SavedAddress['labelType'],
    ...(row.customLabel ? { customLabel: row.customLabel } : {}),
    deliveryLocation: row.line1,
    number: row.flatOrHouse ?? '',
    society: row.buildingOrSociety ?? '',
    landmark: row.landmark ?? '',
    instructions: row.deliveryInstructions ?? '',
    pincode: row.pincode,
    ...(row.latitude !== null ? { latitude: row.latitude } : {}),
    ...(row.longitude !== null ? { longitude: row.longitude } : {}),
    isDefault: row.isDefault,
  };
}

function toServerBody(details: AddressDetails): Record<string, unknown> {
  return {
    label: details.labelType,
    ...(details.labelType === 'custom' && details.customLabel
      ? { customLabel: details.customLabel }
      : {}),
    flatOrHouse: details.number,
    ...(details.society ? { buildingOrSociety: details.society } : {}),
    line1: details.deliveryLocation,
    ...(details.landmark ? { landmark: details.landmark } : {}),
    ...(details.instructions ? { deliveryInstructions: details.instructions } : {}),
    pincode: details.pincode,
  };
}

export function SavedAddressesProvider({ children }: { children: ReactNode }) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(demoSavedAddresses);
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>('demo-home');

  // Backend mode: the server list is the truth. Hydrate on sign-in and after
  // every mirrored mutation; the demo seed only exists while signed out.
  const hydrate = useCallback(() => {
    if (!backendEnabled || !isSignedIn()) return;
    void listSavedAddresses()
      .then((rows) => {
        setSavedAddresses(rows.map(fromServer));
        setDefaultAddressId(rows.find((row) => row.isDefault)?.id ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    hydrate();
    return onAuthChange((signedIn) => {
      if (signedIn) hydrate();
    });
  }, [hydrate]);

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
    if (backendEnabled && isSignedIn()) {
      // Create the address server-side; an edit of a server row becomes a new
      // row plus a best-effort delete of the old one (there is no update
      // endpoint, and deletion is refused while a live plan references it).
      void createSavedAddress(toServerBody(details))
        .then(() => {
          if (existingId && isServerId(existingId)) {
            return deleteAddressOnServer(existingId).catch(() => {});
          }
          return undefined;
        })
        .then(hydrate)
        .catch(() => {});
    }
    return next;
  }, [hydrate]);

  const setDefaultAddress = useCallback((id: string) => {
    setDefaultAddressId(id);
    setSavedAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === id })));
    if (backendEnabled && isSignedIn() && isServerId(id)) {
      void setDefaultAddressOnServer(id).then(hydrate).catch(() => {});
    }
  }, [hydrate]);

  const removeAddress = useCallback((id: string) => {
    setSavedAddresses((current) => current.filter((item) => item.id !== id));
    setDefaultAddressId((current) => (current === id ? null : current));
    if (backendEnabled && isSignedIn() && isServerId(id)) {
      // Refused deletions (live plan references) resync the row back in.
      void deleteAddressOnServer(id).then(hydrate).catch(hydrate);
    }
  }, [hydrate]);

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
