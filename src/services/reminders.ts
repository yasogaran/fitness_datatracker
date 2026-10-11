import * as Notifications from 'expo-notifications';
import type { Session } from '@/types/models';

export const REMINDER_CHANNEL_ID = 'reminders';

// Show the reminder even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Idempotent. Android 13+ also needs the channel to exist before the permission prompt.
export async function ensureReminderChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Question reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    enableVibrate: true,
  });
}

// FR-9: one repeating notification at the session's interval (first one fires one interval from now).
export async function scheduleReminders(session: Session): Promise<void> {
  await ensureReminderChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'HikeLogger',
      body: 'Time for your 5 quick questions.',
      sound: 'default',
      data: { sessionId: session.session_id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: session.reminder_interval_min * 60,
      repeats: true,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

// Used when resuming a recovered session: reschedule only if the schedule was lost (for example by a reboot).
export async function ensureReminders(session: Session): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.length === 0) await scheduleReminders(session);
}

// FR-12
export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}
