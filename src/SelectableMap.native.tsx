import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type MapPressEvent, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { geocodeLocationQuery, formatPlaceLabel, pincodeCentroid } from './locationGeocoding';
import { extractPincode } from './deliveryServiceability';

const defaultRegion: Region = { latitude: 19.076, longitude: 72.8777, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const thumbnailRegionDelta = 0.018;

export default function SelectableMap({
  compact = false,
  thumbnail = false,
  searchQuery = '',
  preferredPincode = '',
  fill = false,
  fullWidth = false,
  onAddressChange,
  onCoordinateChange,
}: {
  compact?: boolean;
  thumbnail?: boolean;
  searchQuery?: string;
  preferredPincode?: string;
  fill?: boolean;
  fullWidth?: boolean;
  onAddressChange?: (address: string) => void;
  onCoordinateChange?: (coordinate: { latitude: number; longitude: number }) => void;
}) {
  const mapRef = useRef<MapView>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResolvedAddress = useRef('');
  const lastPincode = useRef('');
  const suppressReverseGeocodeUntil = useRef(Date.now() + 900);
  const hasCenteredOnQuery = useRef(false);
  const preferredSeed = preferredPincode.replace(/\D/g, '').slice(0, 6);
  const preferredCenter = preferredSeed.length === 6 ? pincodeCentroid(preferredSeed) : null;
  const initialCoordinate = preferredCenter
    ? { latitude: preferredCenter.latitude, longitude: preferredCenter.longitude }
    : { latitude: defaultRegion.latitude, longitude: defaultRegion.longitude };
  const [coordinate, setCoordinate] = useState(initialCoordinate);
  const preview = compact || thumbnail;
  const regionDelta = thumbnail ? thumbnailRegionDelta : 0.012;

  const publishCoordinate = (next: { latitude: number; longitude: number }) => {
    setCoordinate(next);
    onCoordinateChange?.(next);
  };

  const animateToCoordinate = (next: { latitude: number; longitude: number }, duration = 450) => {
    suppressReverseGeocodeUntil.current = Date.now() + Math.max(duration + 120, 500);
    publishCoordinate(next);
    mapRef.current?.animateToRegion({ ...next, latitudeDelta: regionDelta, longitudeDelta: regionDelta }, duration);
  };

  useEffect(() => {
    const pincode = extractPincode(searchQuery) || preferredSeed;
    if (pincode) lastPincode.current = pincode;
  }, [preferredSeed, searchQuery]);

  useEffect(() => {
    if (preview || searchQuery.trim().length >= 3 || hasCenteredOnQuery.current) return;
    if (preferredCenter) {
      hasCenteredOnQuery.current = true;
      animateToCoordinate(
        { latitude: preferredCenter.latitude, longitude: preferredCenter.longitude },
        0,
      );
      return;
    }
    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) return;
      const result = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (searchQuery.trim().length >= 3 || hasCenteredOnQuery.current) return;
      animateToCoordinate({ latitude: result.coords.latitude, longitude: result.coords.longitude });
    })();
  }, [preferredCenter, preview, searchQuery]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) return;
    if (trimmed === lastResolvedAddress.current) return;
    const timer = setTimeout(() => {
      void geocodeLocationQuery(trimmed).then((resolved) => {
        if (!resolved) return;
        hasCenteredOnQuery.current = true;
        lastResolvedAddress.current = trimmed;
        const next = { latitude: resolved.latitude, longitude: resolved.longitude };
        animateToCoordinate(next, thumbnail ? 0 : 450);
        const pincode = extractPincode(resolved.label);
        if (pincode) lastPincode.current = pincode;
        // Do not push geocoded labels back into the parent here — SearchLocationScreen /
        // LOCATION_SELECTED already owns the chosen address. Pushing labels caused Baner
        // overwrites when map region callbacks raced the selection.
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
    if (Date.now() < suppressReverseGeocodeUntil.current) return;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      if (Date.now() < suppressReverseGeocodeUntil.current) return;
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

  const select = (event: MapPressEvent) => {
    const next = event.nativeEvent.coordinate;
    hasCenteredOnQuery.current = true;
    publishCoordinate(next);
    resolveAddress(next);
  };

  const marker = thumbnail ? (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View className="size-2 rounded-full border border-white bg-[#9b4b3f]" />
    </Marker>
  ) : (
    <Marker
      coordinate={coordinate}
      draggable={!preview}
      onDragEnd={preview ? undefined : (event) => {
        const next = event.nativeEvent.coordinate;
        hasCenteredOnQuery.current = true;
        publishCoordinate(next);
        resolveAddress(next);
      }}
      pinColor="#9b4b3f"
    />
  );

  const startingRegion: Region = {
    ...initialCoordinate,
    latitudeDelta: preferredCenter ? 0.02 : defaultRegion.latitudeDelta,
    longitudeDelta: preferredCenter ? 0.02 : defaultRegion.longitudeDelta,
  };

  if (thumbnail) {
    return (
      <View className="size-full overflow-hidden">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ width: 128, height: 128, marginLeft: -32, marginTop: -32 }}
          initialRegion={{ ...startingRegion, latitudeDelta: thumbnailRegionDelta, longitudeDelta: thumbnailRegionDelta }}
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
    <View className={`${fill ? 'flex-1' : fullWidth ? 'h-[280px]' : compact ? 'h-36' : 'h-[330px]'} overflow-hidden ${fullWidth ? '' : 'rounded-[16px] border border-border'}`}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={startingRegion}
        onPress={preview ? undefined : select}
        onRegionChangeComplete={preview ? undefined : (region) => {
          const next = { latitude: region.latitude, longitude: region.longitude };
          publishCoordinate(next);
          resolveAddress(next);
        }}
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
