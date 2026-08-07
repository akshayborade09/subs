import { Platform, Text, type TextProps, type ViewProps } from 'react-native';

export function SectionHeading({ children, className, style }: { children: string; className?: string; style?: ViewProps['style'] }) {
  return (
    <Text
      accessibilityRole="header"
      className={`font-heading text-heading-sm text-foreground ${className ?? ''}`}
      style={[Platform.OS === 'android' ? { includeFontPadding: false } : undefined, style as TextProps['style']]}
    >
      {children}
    </Text>
  );
}
