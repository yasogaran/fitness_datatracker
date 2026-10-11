import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

// Opens the questions sheet when a reminder is tapped, including when the tap launched the app.
export function NotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = `${response.notification.request.identifier}:${response.notification.date}`;
    if (handled.current === key) return;
    handled.current = key;
    router.push({
      pathname: '/questions',
      params: { trigger: 'scheduled', notifiedAt: String(response.notification.date) },
    });
  }, [response]);

  return null;
}
