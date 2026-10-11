import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { getActiveSession } from '@/db/sessions';
import { useRecordingStats } from '@/hooks/useRecordingStats';
import { ensureLocationUpdates, stopSession } from '@/services/recording';
import { ensureReminders } from '@/services/reminders';
import type { Session } from '@/types/models';
import { colors } from '@/utils/theme';

function formatElapsed(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function accuracyLabel(m: number | null): string {
  if (m === null) return 'waiting for GPS...';
  const q = m <= 10 ? 'good' : m <= 30 ? 'fair' : 'poor';
  return `${m.toFixed(0)} m (${q})`;
}

export default function Recording() {
  const db = useSQLiteContext();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    getActiveSession(db).then(async (s) => {
      setSession(s);
      setLoaded(true);
      if (!s) return;
      // After a crash or reboot the service is gone; make sure it is running again.
      try {
        await ensureLocationUpdates();
        await ensureReminders(s);
      } catch (e) {
        setStartError(e instanceof Error ? e.message : 'Could not start GPS.');
      }
    });
  }, [db]);

  if (!loaded) return <Screen title="Recording" />;
  if (!session) {
    return (
      <Screen title="Recording">
        <Text style={styles.label}>No active session.</Text>
        <BigButton label="Back to Home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <RecordingBody session={session} startError={startError} />;
}

function RecordingBody({ session, startError }: { session: Session; startError: string | null }) {
  const db = useSQLiteContext();
  const stats = useRecordingStats(session.session_id, session.start_utc);

  function confirmEnd() {
    Alert.alert('End session?', 'GPS recording will stop.', [
      { text: 'Keep recording', style: 'cancel' },
      {
        text: 'End session',
        style: 'destructive',
        onPress: async () => {
          await stopSession(db, session);
          router.replace({ pathname: '/sync', params: { sessionId: session.session_id } });
        },
      },
    ]);
  }

  return (
    <Screen title={`Recording ${session.session_id}`}>
      <Text style={styles.big}>{formatElapsed(stats.elapsedS)}</Text>
      <View style={styles.grid}>
        <Text style={styles.label}>Distance: {(stats.distanceM / 1000).toFixed(2)} km</Text>
        <Text style={styles.label}>
          Speed: {stats.speedMps === null ? '-' : `${(stats.speedMps * 3.6).toFixed(1)} km/h`}
        </Text>
        <Text style={styles.label}>GPS accuracy: {accuracyLabel(stats.accuracyM)}</Text>
        <Text style={styles.muted}>GPS points saved: {stats.pointCount}</Text>
      </View>
      {stats.poorGps ? (
        <Text style={styles.warn}>
          GPS accuracy has been poor for over 2 minutes. Move the phone to a chest or hip pocket with a clear sky view.
        </Text>
      ) : null}
      {startError ? <Text style={styles.warn}>GPS could not start: {startError}</Text> : null}
      <BigButton label="Answer now" onPress={() => router.push({ pathname: '/questions', params: { trigger: 'manual' } })} />
      <BigButton secondary label="End session" onPress={confirmEnd} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 56, fontWeight: '700', color: colors.text, textAlign: 'center', paddingVertical: 10 },
  grid: { gap: 8 },
  label: { fontSize: 20, color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
  warn: { fontSize: 16, color: colors.error, fontWeight: '600' },
});
