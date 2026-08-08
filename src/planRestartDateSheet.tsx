import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useUniwind } from 'uniwind';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { FormModalLayout } from './formLayout';
import { PrimaryShimmerButton } from './primaryButton';
import { SheetBackdrop } from './sheetOverlay';
import { hapticPress } from './haptics';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function restartDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function restartDateShortLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
}

export function restartDateFromKey(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Next weekday on or after tomorrow — used for restart previews when no date is chosen yet. */
export function nextWeekdayDateKey(from = new Date()) {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor.getDay() === 0 || cursor.getDay() === 6) {
    cursor.setDate(cursor.getDate() + 1);
  }
  return dateKey(cursor);
}

function CalendarBottomSheet({ onClose, closeLabel, children }: { onClose: () => void; closeLabel: string; children: ReactNode }) {
  return (
    <View className="absolute inset-0 z-[60]">
      <SheetBackdrop />
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} className="absolute inset-0" onPress={onClose} />
      <View pointerEvents="box-none" className="flex-1 justify-end">
        <Animated.View className="mx-4 mb-4 overflow-hidden rounded-sheet bg-canvas">
          <Animated.View entering={FadeInUp.duration(220)} className="p-sheet">
            {children}
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

function SheetCloseButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { theme } = useUniwind();
  const iconColor = theme === 'dark' ? '#ffffff' : '#101010';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={hapticPress(onPress, 'light')} hitSlop={8} className="size-icon-button shrink-0 items-center justify-center">
      <XIcon size={24} weight="regular" color={iconColor} />
    </Pressable>
  );
}

export function PlanRestartDateSheet({
  initialDate,
  onClose,
  onConfirm,
}: {
  initialDate?: string;
  onClose: () => void;
  onConfirm: (dateKey: string) => void;
}) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(240, width - 64);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parsedInitial = initialDate ? new Date(`${initialDate}T00:00:00`) : null;
  const [selectedKey, setSelectedKey] = useState<string | null>(
    parsedInitial && !Number.isNaN(parsedInitial.getTime()) ? dateKey(parsedInitial) : null,
  );
  const months = Array.from({ length: 6 }, (_, index) => new Date(today.getFullYear(), today.getMonth() + index, 1));
  const initialMonthIndex = parsedInitial && !Number.isNaN(parsedInitial.getTime())
    ? Math.max(0, Math.min(months.length - 1, (parsedInitial.getFullYear() - today.getFullYear()) * 12 + parsedInitial.getMonth() - today.getMonth()))
    : 0;
  const calendarPagerRef = useRef<any>(null);
  const visibleMonthIndex = useRef(initialMonthIndex);

  useEffect(() => {
    const timer = setTimeout(() => calendarPagerRef.current?.scrollTo({ x: visibleMonthIndex.current * pageWidth, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [pageWidth]);

  const toggleDate = (date: Date) => {
    if (date < today) return;
    const key = dateKey(date);
    setSelectedKey((current) => (current === key ? null : key));
  };

  const renderMonth = (month: Date) => {
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const dates = Array.from({ length: totalDays }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
    return (
      <View key={`${month.getFullYear()}-${month.getMonth()}`} style={{ width: pageWidth, overflow: 'hidden' }}>
        <Text className="mb-4 px-5 font-heading text-body-md text-foreground">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
        <View className="flex-row">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <Text key={`${day}-${index}`} className="w-[14.285%] text-center font-body text-body-xs text-muted">{day}</Text>
          ))}
        </View>
        <View className="mt-2 flex-row flex-wrap">
          {Array.from({ length: month.getDay() }, (_, index) => (
            <View key={`blank-${index}`} className="w-[14.285%]" />
          ))}
          {dates.map((date) => {
            const key = dateKey(date);
            const selected = selectedKey === key;
            const disabled = date < today;
            return (
              <View key={key} className="w-[14.285%] items-center py-1.5">
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled }}
                  disabled={disabled}
                  onPress={hapticPress(() => toggleDate(date), 'selection')}
                  className={`h-8 w-8 items-center justify-center rounded-full border ${selected ? 'border-2 border-accent bg-accent ring-2 ring-accent ring-offset-[3px] ring-offset-sheet' : 'border-border bg-canvas'} ${disabled ? 'opacity-30' : ''}`}
                >
                  <Text className={`font-mono-semibold text-body-sm ${selected ? 'text-accent-foreground' : 'text-foreground'}`}>{date.getDate()}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <CalendarBottomSheet onClose={onClose} closeLabel="Close restart date calendar">
      <FormModalLayout
        title="Select date to restart the plan"
        subtitle="Choose the first delivery day after your plan resumes."
        headerAction={<SheetCloseButton onPress={onClose} label="Close restart date calendar" />}
        fields={(
          <Animated.ScrollView
            ref={calendarPagerRef}
            horizontal
            pagingEnabled
            snapToInterval={pageWidth}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={{ width: pageWidth, alignSelf: 'center', overflow: 'hidden' }}
            layout={LinearTransition.duration(180).easing(Easing.inOut(Easing.quad))}
            contentOffset={{ x: initialMonthIndex * pageWidth, y: 0 }}
            onMomentumScrollEnd={(event) => {
              visibleMonthIndex.current = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
            }}
          >
            {months.map(renderMonth)}
          </Animated.ScrollView>
        )}
        primaryAction={(
          <PrimaryShimmerButton
            label="Confirm date"
            enabled={!!selectedKey}
            onPress={() => {
              if (!selectedKey) return;
              onConfirm(selectedKey);
            }}
          />
        )}
      />
    </CalendarBottomSheet>
  );
}
