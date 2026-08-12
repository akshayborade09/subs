import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AccentSwitch, PrimaryShimmerButton } from '../primaryButton';
import { hapticPress } from '../haptics';
import { InfoNotice, NutritionSheet, SelectionChip, SheetCloseButton } from './nutritionComponents';
import { WaterGoalRuler } from './WaterGoalRuler';
import { track } from './nutritionAnalytics';
import { useNutrition } from './nutritionStore';
import {
  cancelWaterReminders,
  openNotificationSettings,
  requestWaterReminderPermission,
  scheduleWaterReminders,
} from './waterReminders';
import type { WaterReminderIntervalHours } from './types';

const reminderIntervals: WaterReminderIntervalHours[] = [2, 3, 4];

/** Post-onboarding editing for the water goal and reminder preferences. */
export function NutritionPreferencesSheet({ onClose }: { onClose: () => void }) {
  const { setup, updateSetup } = useNutrition();
  const [waterGoalMl, setWaterGoalMl] = useState(setup.waterGoalMl);
  const [remindersEnabled, setRemindersEnabled] = useState(setup.waterRemindersEnabled);
  const [intervalHours, setIntervalHours] = useState<WaterReminderIntervalHours>(
    setup.waterReminderIntervalHours ?? 3,
  );
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    let enabled = remindersEnabled;
    let denied = false;

    if (remindersEnabled) {
      const result = await requestWaterReminderPermission();
      if (result === 'granted') {
        await scheduleWaterReminders(intervalHours);
      } else {
        enabled = false;
        denied = result === 'denied';
      }
    } else {
      await cancelWaterReminders();
    }
    setPermissionDenied(denied);

    updateSetup({
      waterGoalMl,
      waterRemindersEnabled: enabled,
      waterReminderIntervalHours: enabled ? intervalHours : undefined,
    });
    track('nutrition_water_goal_changed', { waterGoalMl });
    track(enabled ? 'nutrition_water_reminder_enabled' : 'nutrition_water_reminder_disabled', {});
    setSaving(false);
    // Stay open on denial so the settings shortcut is reachable; the goal is saved either way.
    if (!denied) onClose();
  };

  return (
    <NutritionSheet onClose={onClose} closeLabel="Close water preferences">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-auth-block">
          <Text className="font-heading text-heading-sm text-foreground">Water preferences</Text>
          <Text className="font-body text-body-sm text-subtle">Change your goal or reminders any time.</Text>
        </View>
        <SheetCloseButton onPress={onClose} label="Close water preferences" />
      </View>

      <View className="mt-sheet-gap gap-sheet-gap">
        <WaterGoalRuler valueMl={waterGoalMl} onChange={setWaterGoalMl} />

        <View className="rounded-field border border-border bg-canvas p-sheet">
          <View className="flex-row items-center gap-3">
            <Text className="min-w-0 flex-1 font-mono-semibold text-body-md text-foreground">
              Remind me to drink water
            </Text>
            <AccentSwitch
              value={remindersEnabled}
              onValueChange={(value) => {
                setRemindersEnabled(value);
                setPermissionDenied(false);
              }}
            />
          </View>
          {remindersEnabled ? (
            <View className="mt-4 gap-2">
              <Text className="font-body text-body-sm text-muted">Reminder frequency</Text>
              <View className="flex-row flex-wrap gap-2">
                {reminderIntervals.map((hours) => (
                  <SelectionChip
                    key={hours}
                    label={`Every ${hours} hours`}
                    selected={intervalHours === hours}
                    onPress={() => setIntervalHours(hours)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {permissionDenied ? (
          <View className="gap-2">
            <InfoNotice tone="warning">
              Water reminders couldn&apos;t be enabled because notifications are turned off.
            </InfoNotice>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={hapticPress(openNotificationSettings, 'light')}
              className="min-h-11 justify-center self-start px-1"
            >
              <Text className="font-mono-semibold text-body-sm text-accent">Open settings</Text>
            </Pressable>
          </View>
        ) : null}

        <PrimaryShimmerButton label="Save preferences" enabled={!saving} loading={saving} onPress={() => void save()} />
      </View>
    </NutritionSheet>
  );
}
