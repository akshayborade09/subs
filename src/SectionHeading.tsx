import { useId, useState } from 'react';
import { Text, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useUniwind } from 'uniwind';

const HEADING_LINE_HEIGHT = 28;
const HEADING_FONT_SIZE = 20;

export function SectionHeading({ children, className, style }: { children: string; className?: string; style?: ViewProps['style'] }) {
  const { theme } = useUniwind();
  const dark = theme === 'dark';
  const [width, setWidth] = useState(0);
  const gradientId = useId().replace(/:/g, '');
  const startColor = dark ? '#ffffff' : '#101010';
  const endColor = dark ? '#ababab' : '#5e5e5e';

  return (
    <View className={className} style={[{ minHeight: HEADING_LINE_HEIGHT }, style]}>
      <Text
        accessibilityRole="header"
        className="font-heading text-heading-sm text-transparent"
        onLayout={(event) => setWidth(Math.ceil(event.nativeEvent.layout.width))}
      >
        {children}
      </Text>
      {width > 0 ? (
        <Svg pointerEvents="none" width={width} height={HEADING_LINE_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={startColor} />
              <Stop offset="1" stopColor={endColor} />
            </LinearGradient>
          </Defs>
          <SvgText fill={`url(#${gradientId})`} fontSize={HEADING_FONT_SIZE} fontFamily="AbrilFatface_400Regular" y={HEADING_FONT_SIZE}>
            {children}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}
