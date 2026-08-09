import { Text, View } from 'react-native';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { useUniwind } from 'uniwind';
import { themePalette } from './themeColors';

export default function SelectableMap({ compact = false, thumbnail = false, fill = false }: { compact?: boolean; thumbnail?: boolean; searchQuery?: string; fill?: boolean; onAddressChange?: (address: string) => void }) {
  const { theme } = useUniwind();
  const palette = themePalette[theme === 'dark' ? 'dark' : 'light'];
  if (thumbnail) {
    return (
      <View className="size-full items-center justify-center overflow-hidden bg-surface-raised">
        <View className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 bg-canvas" />
        <View className="absolute left-3 top-0 h-full w-5 rotate-12 bg-canvas" />
        <View className="size-2 rounded-full border border-white bg-[#9b4b3f]" />
      </View>
    );
  }
  return <View className={`${fill ? 'flex-1' : compact ? 'h-36' : 'h-[330px]'} items-center justify-center overflow-hidden rounded-[16px] border border-border bg-surface-raised`}><View className="absolute left-8 top-0 h-full w-12 rotate-12 bg-canvas" /><View className="absolute right-10 top-0 h-full w-8 -rotate-12 bg-canvas" /><View className="absolute inset-x-0 top-1/2 h-10 bg-canvas" /><View className="h-12 w-12 items-center justify-center rounded-full bg-accent"><MapPinIcon size={18} weight="bold" color={palette.accentForeground} /></View><Text className="mt-3 font-body-medium text-sm text-muted">Interactive Google Map is available on iOS and Android</Text></View>;
}
