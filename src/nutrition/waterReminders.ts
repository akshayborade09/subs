/**
 * Water reminders. Permission is requested only after the user opts in, and a
 * denial never blocks onboarding — the caller shows an inline notice instead.
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { WaterReminderIntervalHours } from './types';

const REMINDER_CATEGORY = 'nutrition-water-reminder';

export type ReminderPermissionResult = 'granted' | 'denied' | 'unsupported';

export async function requestWaterReminderPermission(): Promise<ReminderPermissionResult> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return 'granted';
    if (!existing.canAskAgain) return 'denied';
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

export async function cancelWaterReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((notification) => notification.content.data?.category === REMINDER_CATEGORY)
        .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
    );
  } catch {
    // Nothing scheduled, or notifications unavailable on this device.
  }
}

export async function scheduleWaterReminders(intervalHours: WaterReminderIntervalHours): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelWaterReminders();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for water',
        body: 'A quick glass keeps you on track for your daily goal.',
        data: { category: REMINDER_CATEGORY },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: intervalHours * 60 * 60,
        repeats: true,
      },
    });
  } catch {
    // Scheduling failures are non-fatal; tracking continues without reminders.
  }
}

export function openNotificationSettings() {
  void Linking.openSettings();
}
