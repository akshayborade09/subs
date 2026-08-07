import { useRef, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useFieldPlaceholderColor, useForegroundColor } from './themeColors';

export const FIELD_LINE_HEIGHT = 24;
export const fieldValueTextClass = 'font-body-medium text-body-md leading-6 tracking-body-md';

export const centeredFieldInputStyle = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFillObject,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    fontFamily: 'InclusiveSans_500Medium',
    fontSize: 16,
    lineHeight: FIELD_LINE_HEIGHT,
    letterSpacing: -0.32,
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' as const } : {}),
  },
}).field;

type CenteredFieldInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  selectionColor: string;
  shellClassName: string;
  inputRef?: RefObject<TextInput | null>;
  onFocus?: () => void;
  onBlur?: () => void;
  prefix?: ReactNode;
} & Pick<TextInputProps, 'autoFocus' | 'returnKeyType' | 'onSubmitEditing' | 'keyboardType' | 'inputMode' | 'maxLength' | 'accessibilityLabel' | 'textContentType' | 'autoComplete' | 'autoCapitalize'>;

export function CenteredFieldInput({
  value,
  onChangeText,
  placeholder,
  selectionColor,
  shellClassName,
  inputRef,
  onFocus,
  onBlur,
  prefix,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  keyboardType,
  inputMode,
  maxLength,
  accessibilityLabel,
  textContentType,
  autoComplete,
  autoCapitalize,
}: CenteredFieldInputProps) {
  const localRef = useRef<TextInput>(null);
  const focusInput = () => (inputRef?.current ?? localRef.current)?.focus();
  const placeholderColor = useFieldPlaceholderColor();
  const foregroundColor = useForegroundColor();

  return (
    <Pressable
      accessibilityRole="none"
      focusable={false}
      onPress={focusInput}
      className={`h-field flex-row items-center gap-field-inline rounded-field px-sheet ${shellClassName}`}
    >
      {prefix}
      <View className="relative h-6 min-w-0 flex-1">
        <Text
          pointerEvents="none"
          numberOfLines={1}
          className={`${fieldValueTextClass} ${value ? 'text-foreground' : ''}`}
          style={value ? undefined : { color: placeholderColor }}
        >
          {value || placeholder}
        </Text>
        <TextInput
          ref={(node) => {
            localRef.current = node;
            if (inputRef) inputRef.current = node;
          }}
          autoFocus={autoFocus}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder=""
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          keyboardType={keyboardType}
          inputMode={inputMode}
          maxLength={maxLength}
          textContentType={textContentType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          selectionColor={selectionColor}
          textAlignVertical="center"
          style={[centeredFieldInputStyle, { color: 'transparent' }]}
        />
      </View>
    </Pressable>
  );
}
