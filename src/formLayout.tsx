import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { headingDescriptionClass } from './typographyClasses';
import { SectionHeading } from './SectionHeading';

export { SectionHeading };

/** Title + description — 9px apart (`gap-auth-block`). */
export function FormHeader({
  title,
  subtitle,
  size = 'sheet',
}: {
  title: string;
  subtitle?: string;
  /** sheet = bottom sheets (heading-sm); page = full-screen steps (heading-md) */
  size?: 'sheet' | 'page';
}) {
  const titleClass =
    size === 'page'
      ? 'font-heading text-heading-md text-foreground'
      : 'font-heading text-heading-sm text-foreground';

  return (
    <View className="gap-auth-block">
      <Text className={titleClass}>{title}</Text>
      {subtitle ? <Text className={headingDescriptionClass}>{subtitle}</Text> : null}
    </View>
  );
}

/** Field + inline validation — 9px between siblings. */
export function FormFieldStack({ children }: { children: ReactNode }) {
  return <View className="gap-auth-block">{children}</View>;
}

/**
 * Full-page content block when `Shell` (or similar) owns the page title.
 * Subheading labels the cards/fields below — not part of the page header.
 * Rhythm: subheading → sheet-gap → content.
 */
export function FormPageSection({ subheading, children }: { subheading?: string; children: ReactNode }) {
  return (
    <View className="gap-sheet-gap">
      {subheading ? <Text className={headingDescriptionClass}>{subheading}</Text> : null}
      {children}
    </View>
  );
}

export function FormValidationText({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="alert" className="font-body text-body-xs text-destructive">
      {children}
    </Text>
  );
}

function FormActionStack({ primaryAction, secondaryAction }: { primaryAction?: ReactNode; secondaryAction?: ReactNode }) {
  if (!primaryAction && !secondaryAction) return null;
  if (primaryAction && secondaryAction) {
    return (
      <View className="gap-2">
        {primaryAction}
        {secondaryAction}
      </View>
    );
  }
  return (
    <>
      {primaryAction}
      {secondaryAction}
    </>
  );
}

export function FormFooterCopy({ children }: { children: ReactNode }) {
  return (
    <Text className="font-body text-body-xs text-center leading-5 text-foreground">{children}</Text>
  );
}

/**
 * Bottom-sheet form layout:
 * [title + description @ auth-gap] → sheet-gap → [fields @ auth-gap] → sheet-gap → [extra?] → sheet-gap → button → sheet-gap → footer
 *
 * Pass `title`/`subtitle` OR a custom `header` node (e.g. inline back + title toolbar).
 */
export function FormSheetLayout({
  title,
  subtitle,
  header,
  fields,
  extra,
  primaryAction,
  footer,
}: {
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  fields: ReactNode;
  extra?: ReactNode;
  primaryAction: ReactNode;
  footer?: ReactNode;
}) {
  const titleHeader = title ? <FormHeader title={title} subtitle={subtitle} size="sheet" /> : null;

  return (
    <View className="gap-sheet-gap">
      {header}
      {titleHeader}
      {fields ? <FormFieldStack>{fields}</FormFieldStack> : null}
      {extra}
      {primaryAction}
      {footer}
    </View>
  );
}

/**
 * When the sheet chrome already shows the title (SheetFrame / AdaptiveSheetFrame bar),
 * stack: subtitle → sheet-gap → fields → sheet-gap → actions → footer.
 */
export function FormChromeSheetLayout({
  subtitle,
  fields,
  extra,
  primaryAction,
  secondaryAction,
  footer,
}: {
  subtitle?: string;
  fields?: ReactNode;
  extra?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <View className="gap-sheet-gap">
      {subtitle ? <Text className={headingDescriptionClass}>{subtitle}</Text> : null}
      {fields}
      {extra}
      <FormActionStack primaryAction={primaryAction} secondaryAction={secondaryAction} />
      {footer}
    </View>
  );
}

/**
 * Card-style modal (Pause, change address/date, etc.):
 * [title + description @ auth-gap] → sheet-gap → fields → sheet-gap → actions → footer
 */
export function FormModalLayout({
  title,
  subtitle,
  headerAction,
  fields,
  extra,
  primaryAction,
  secondaryAction,
  footer,
}: {
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  fields?: ReactNode;
  extra?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  footer?: ReactNode;
}) {
  const header = headerAction ? (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <FormHeader title={title} subtitle={subtitle} size="sheet" />
      </View>
      {headerAction}
    </View>
  ) : (
    <FormHeader title={title} subtitle={subtitle} size="sheet" />
  );

  return (
    <View className="gap-sheet-gap">
      {header}
      {fields ? <FormFieldStack>{fields}</FormFieldStack> : null}
      {extra}
      <FormActionStack primaryAction={primaryAction} secondaryAction={secondaryAction} />
      {footer}
    </View>
  );
}

/**
 * Full-page body when Shell owns the title:
 * Same vertical rhythm: fields @ auth-gap → sheet-gap → optional mid content → CTA → footer.
 */
export function FormPageBody({
  fields,
  extra,
  primaryAction,
  footer,
}: {
  fields: ReactNode;
  extra?: ReactNode;
  primaryAction?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <View className="gap-sheet-gap">
      <FormFieldStack>{fields}</FormFieldStack>
      {extra}
      {primaryAction}
      {footer}
    </View>
  );
}
