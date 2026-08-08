import { Text, type TextProps } from 'react-native';
import { formatRupee } from './formatCurrency';

export function isMoneyText(value: string) {
  return value.includes('₹');
}

/** Apply Inclusive Sans semibold to monetary values while keeping surrounding typography classes. */
export function moneyValueTypography(value: string, sizeClass: string, toneClass = 'text-foreground') {
  if (!isMoneyText(value)) {
    return `text-right font-body-medium leading-6 ${toneClass} ${sizeClass}`;
  }
  return `text-right font-mono-semibold leading-6 ${toneClass} ${sizeClass}`;
}

type MoneyTextProps = TextProps & {
  amount: number;
  className?: string;
};

export function MoneyText({ amount, className = '', ...props }: MoneyTextProps) {
  return (
    <Text {...props} className={`${className} font-mono-semibold`.trim()}>
      {formatRupee(amount)}
    </Text>
  );
}

type MoneyInlineProps = {
  children: string;
  className?: string;
};

/** Renders plain text with monetary segments in Inclusive Sans semibold. */
export function MoneyInline({ children, className = '' }: MoneyInlineProps) {
  const parts = children.split(/(₹[\d,]+(?:\.\d+)?)/g);
  if (parts.length === 1) {
    return <Text className={className}>{children}</Text>;
  }
  return (
    <Text className={className}>
      {parts.map((part, index) =>
        part.startsWith('₹') ? (
          <Text key={`${part}-${index}`} className="font-mono-semibold">
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
