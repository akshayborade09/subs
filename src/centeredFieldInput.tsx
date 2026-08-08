import { useRef, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { useFieldPlaceholderColor, useForegroundColor } from './themeColors';

export const FIELD_LINE_HEIGHT = 24;
export const FIELD_HEIGHT = 52;
export const fieldValueTextClass = 'font-body-medium text-body-md leading-6 tracking-body-md';

const fieldTypography = {
  fontFamily: 'InclusiveSans_500Medium',
  fontSize: 16,
  letterSpacing: -0.32,
} as const;

/**
 * Single-line field text. iOS repositions glyphs inside the line box once a TextInput
 * enters editing mode, so text set with an explicit `lineHeight` jumps on focus — it is
 * omitted there and the shell's `items-center` does the centring instead. Android still
 * needs `lineHeight` + `textAlignVertical` to centre correctly.
 */
export const centeredFieldInputStyle = StyleSheet.create({
  field: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
    ...fieldTypography,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as const, lineHeight: FIELD_LINE_HEIGHT }
      : { paddingVertical: 0 }),
  },
}).field;

export const multilineFieldInputStyle = StyleSheet.create({
  field: {
    minHeight: 92,
    paddingTop: 16,
    paddingBottom: 16,
    ...fieldTypography,
    lineHeight: FIELD_LINE_HEIGHT,
    textAlignVertical: 'top' as const,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
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
  suffix?: ReactNode;
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
  suffix,
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
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
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
        style={[centeredFieldInputStyle, { color: foregroundColor }]}
      />
      {suffix}
    </Pressable>
  );
}
