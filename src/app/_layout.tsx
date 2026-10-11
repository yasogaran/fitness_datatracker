import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { NotificationRouter } from '@/components/NotificationRouter';
import { migrate } from '@/db/migrations';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="hikelogger.db" onInit={migrate}>
      <StatusBar style="dark" />
      <NotificationRouter />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'HikeLogger' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Setup checklist' }} />
        <Stack.Screen name="consent" options={{ title: 'Consent' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="pre-session" options={{ title: 'New session' }} />
        <Stack.Screen name="recording" options={{ title: 'Recording', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="questions" options={{ title: 'Questions' }} />
        <Stack.Screen name="sync" options={{ title: 'Sync watch data' }} />
        <Stack.Screen name="data-check" options={{ title: 'Data check' }} />
        <Stack.Screen name="export" options={{ title: 'Export' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </SQLiteProvider>
  );
}
