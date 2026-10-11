import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import {
  SdkAvailabilityStatus,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
} from 'react-native-health-connect';
import type { Permission } from 'react-native-health-connect';
import { ensureReminderChannel } from './reminders';

export const APP_PACKAGE = 'com.hikelogger.app';
const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

// Spec 5.5: HeartRateRecord and StepsRecord are required, ExerciseSessionRecord is optional.
// The checklist asks for all three in one prompt (spec 8.1) but only the first two must be granted.
const REQUIRED_HC: Permission[] = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'Steps' },
];
const OPTIONAL_HC: Permission[] = [{ accessType: 'read', recordType: 'ExerciseSession' }];

export type HcAvailability = 'available' | 'update_required' | 'unavailable';

export async function hcAvailability(): Promise<HcAvailability> {
  try {
    const s = await getSdkStatus();
    if (s === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (s === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function hcPermissionsGranted(): Promise<boolean> {
  try {
    if (!(await initialize())) return false;
    const granted = await getGrantedPermissions();
    return REQUIRED_HC.every((r) =>
      granted.some((g) => 'recordType' in g && g.accessType === 'read' && g.recordType === r.recordType),
    );
  } catch {
    return false;
  }
}

export async function locationGranted(): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return fg.granted && bg.granted;
}

export async function notificationsGranted(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

function openAppDetails(): Promise<unknown> {
  return IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
    data: `package:${APP_PACKAGE}`,
  });
}

export async function fixHealthConnectAvailability(): Promise<void> {
  // Android 13 and older: Health Connect is a separate Play Store app.
  await Linking.openURL(`market://details?id=${HEALTH_CONNECT_PACKAGE}`);
}

export async function fixHealthConnectPermissions(): Promise<void> {
  if (!(await initialize())) return;
  await requestPermission([...REQUIRED_HC, ...OPTIONAL_HC]);
  // Android stops showing the dialog after repeated denials, so fall back to Health Connect's own settings.
  if (!(await hcPermissionsGranted())) openHealthConnectSettings();
}

export async function fixLocation(): Promise<void> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) {
    if (!fg.canAskAgain) await openAppDetails();
    return;
  }
  // On Android 11+ this opens the system settings page, where the user picks "Allow all the time".
  await Location.requestBackgroundPermissionsAsync();
}

export async function fixNotifications(): Promise<void> {
  await ensureReminderChannel();
  const res = await Notifications.requestPermissionsAsync();
  if (!res.granted && !res.canAskAgain) await openAppDetails();
}

export function openBatterySettings(): Promise<unknown> {
  return IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
}

export function openAppSettings(): Promise<unknown> {
  return openAppDetails();
}
