import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { geocodeLocationQuery, formatPlaceLabel } from './locationGeocoding';
import { extractPincode } from './deliveryServiceability';

const pune: Region = { latitude: 18.559, longitude: 73.7868, latitudeDelta: 0.012, longitudeDelta: 0.012 };
const thumbnailRegionDelta = 0.018;

export default function SelectableMap({
  compact = false,
  thumbnail = false,
  searchQuery = '',
  fill = false,
  onAddressChange,
  onCoordinateChange,
}: {
  compact?: boolean;
  thumbnail?: boolean;
  searchQuery?: string;
  fill?: boolean;
  onAddressChange?: (address: string) => void;
  onCoordinateChange?: (coordinate: { latitude: number; longitude: number }) => void;
}) {
  const mapRef = useRef<MapView>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResolvedAddress = useRef('');
  const lastPincode = useRef('');
  const [coordinate, setCoordinate] = useState({ latitude: pune.latitude, longitude: pune.longitude });
  const preview = compact || thumbnail;
  const regionDelta = thumbnail ? thumbnailRegionDelta : 0.012;

  const publishCoordinate = (next: { latitude: number; longitude: number }) => {
    setCoordinate(next);
    onCoordinateChange?.(next);
  };

  useEffect(() => {
    const pincode = extractPincode(searchQuery);
    if (pincode) lastPincode.current = pincode;
  }, [searchQuery]);

  useEffect(() => {
    if (preview) return;
    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return;
      const result = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude };
      publishCoordinate(next);
      mapRef.current?.animateToRegion({ ...next, latitudeDelta: regionDelta, longitudeDelta: regionDelta }, 450);
    })();
  }, [preview, regionDelta]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3 || trimmed === lastResolvedAddress.current) return;
    const timer = setTimeout(() => {
      void geocodeLocationQuery(trimmed).then((resolved) => {
        if (!resolved) return;
        const next = { latitude: resolved.latitude, longitude: resolved.longitude };
        publishCoordinate(next);
        mapRef.current?.animateToRegion({ ...next, latitudeDelta: regionDelta, longitudeDelta: regionDelta }, thumbnail ? 0 : 450);
        if (onAddressChange && !thumbnail) {
          lastResolvedAddress.current = resolved.label;
          const pincode = extractPincode(resolved.label);
          if (pincode) lastPincode.current = pincode;
          onAddressChange(resolved.label);
        }
      }).catch(() => {});
    }, 450);
    return () => clearTimeout(timer);
  }, [preview, regionDelta, searchQuery, thumbnail, onAddressChange]);

  useEffect(() => {
    if (!thumbnail) return;
    mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: thumbnailRegionDelta, longitudeDelta: thumbnailRegionDelta }, 0);
  }, [coordinate, thumbnail]);

  const resolveAddress = (next: { latitude: number; longitude: number }) => {
    if (!onAddressChange) return;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      void Location.reverseGeocodeAsync(next).then((results) => {
        const place = results[0];
        if (!place) return;
        const address = formatPlaceLabel(place, lastPincode.current);
        if (!address) return;
        const pincode = extractPincode(address) || place.postalCode || lastPincode.current;
        if (pincode) lastPincode.current = pincode;
        lastResolvedAddress.current = address;
        onAddressChange(address);
      }).catch(() => {});
    }, 350);
  };

  const select = (event: MapPressEvent) => publishCoordinate(event.nativeEvent.coordinate);

  const marker = thumbnail ? (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View className="size-2 rounded-full border border-white bg-[#9b4b3f]" />
    </Marker>
  ) : (
    <Marker coordinate={coordinate} draggable={!preview} onDragEnd={preview ? undefined : (event) => { const next = event.nativeEvent.coordinate; publishCoordinate(next); resolveAddress(next); }} pinColor="#9b4b3f" />
  );

  if (thumbnail) {
    return (
      <View className="size-full overflow-hidden">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ width: 128, height: 128, marginLeft: -32, marginTop: -32 }}
          initialRegion={{ ...pune, latitudeDelta: thumbnailRegionDelta, longitudeDelta: thumbnailRegionDelta }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled={false}
          zoomEnabled={false}
          liteMode={Platform.OS === 'android'}
        >
          {marker}
        </MapView>
      </View>
    );
  }

  return (
    <View className={`${fill ? 'flex-1' : compact ? 'h-36' : 'h-[330px]'} overflow-hidden rounded-[16px] border border-border`}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={pune}
        onPress={preview ? undefined : select}
        onRegionChangeComplete={preview ? undefined : (region) => { const next = { latitude: region.latitude, longitude: region.longitude }; publishCoordinate(next); resolveAddress(next); }}
        showsUserLocation={!preview}
        showsMyLocationButton={!preview}
        toolbarEnabled={false}
        pitchEnabled={!preview}
        rotateEnabled={!preview}
        scrollEnabled={!preview}
        zoomEnabled={!preview}
        liteMode={Platform.OS === 'android' && compact}
      >
        {marker}
      </MapView>
    </View>
  );
}
