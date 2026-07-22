import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';
import * as Location from 'expo-location';

const pune: Region = { latitude: 18.559, longitude: 73.7868, latitudeDelta: 0.012, longitudeDelta: 0.012 };

export default function SelectableMap({ compact = false, searchQuery = '', fill = false, onAddressChange }: { compact?: boolean; searchQuery?: string; fill?: boolean; onAddressChange?: (address: string) => void }) {
  const mapRef = useRef<MapView>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResolvedAddress = useRef('');
  const [coordinate, setCoordinate] = useState({ latitude: pune.latitude, longitude: pune.longitude });

  useEffect(() => {
    if (compact) return;
    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return;
      const result = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude };
      setCoordinate(next);
      mapRef.current?.animateToRegion({ ...next, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 450);
    })();
  }, [compact]);

  useEffect(() => {
    if (searchQuery.trim().length < 3 || searchQuery.trim() === lastResolvedAddress.current) return;
    const timer = setTimeout(() => {
      void Location.geocodeAsync(searchQuery.trim()).then((results) => {
        const result = results[0];
        if (!result) return;
        const next = { latitude: result.latitude, longitude: result.longitude };
        setCoordinate(next);
        mapRef.current?.animateToRegion({ ...next, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 450);
      }).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [compact, searchQuery]);

  const resolveAddress = (next: { latitude: number; longitude: number }) => {
    if (!onAddressChange) return;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      void Location.reverseGeocodeAsync(next).then((results) => {
        const place = results[0];
        if (!place) return;
        const address = [place.name, place.street, place.district, place.city, place.region, place.postalCode].filter((part, index, all) => part && all.indexOf(part) === index).join(', ');
        if (!address) return;
        lastResolvedAddress.current = address;
        onAddressChange(address);
      }).catch(() => {});
    }, 350);
  };

  const select = (event: MapPressEvent) => setCoordinate(event.nativeEvent.coordinate);
  return (
    <View className={`${fill ? 'flex-1' : compact ? 'h-36' : 'h-[330px]'} overflow-hidden rounded-[16px] border border-border`}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={pune}
        onPress={compact ? undefined : select}
        onRegionChangeComplete={compact ? undefined : (region) => { const next = { latitude: region.latitude, longitude: region.longitude }; setCoordinate(next); resolveAddress(next); }}
        showsUserLocation={!compact}
        showsMyLocationButton={!compact}
        toolbarEnabled={false}
        pitchEnabled={!compact}
        rotateEnabled={!compact}
        scrollEnabled={!compact}
        zoomEnabled={!compact}
        liteMode={Platform.OS === 'android' && compact}
      >
        <Marker coordinate={coordinate} draggable={!compact} onDragEnd={compact ? undefined : (event) => { const next = event.nativeEvent.coordinate; setCoordinate(next); resolveAddress(next); }} pinColor="#9b4b3f" />
      </MapView>
    </View>
  );
}
