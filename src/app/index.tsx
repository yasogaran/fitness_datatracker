import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { countAllGpsPoints } from '@/db/gps';
import { getProfile } from '@/db/profile';
import { getActiveSession, listSessions } from '@/db/sessions';
import { finishRecoveredSession } from '@/services/recording';
import type { Profile, Session } from '@/types/models';
import { colors } from '@/utils/theme';

function duration(s: Session): string {
  if (!s.end_utc) return 'in progress';
  const min = Math.round((Date.parse(s.end_utc) - Date.parse(s.start_utc)) / 60000);
  return `${min} min`;
}

export default function Home() {
  const db = useSQLiteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [gpsCount, setGpsCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [p, s, a, n] = await Promise.all([
      getProfile(db),
      listSessions(db),
      getActiveSession(db),
      countAllGpsPoints(db),
    ]);
    setProfile(p);
    setSessions(s);
    setActive(a);
    setGpsCount(n);
    setLoaded(true);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmFinish(session: Session) {
    Alert.alert(
      'Finish previous session?',
      'It will end at the time of its last saved GPS point.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          style: 'destructive',
          onPress: async () => {
            await finishRecoveredSession(db, session);
            await load();
          },
        },
      ],
    );
  }

  const ready = profile?.consent_at != null;

  return (
    <View style={styles.container}>
      {active ? (
        <View style={styles.recovery}>
          <Text style={styles.recoveryTitle}>Session {active.session_id} was not finished</Text>
          <BigButton label="Resume" onPress={() => router.push('/recording')} />
          <BigButton secondary label="Finish it" onPress={() => confirmFinish(active)} />
        </View>
      ) : loaded && !profile ? (
        <BigButton label="Set up profile" onPress={() => router.push('/profile')} />
      ) : loaded && !ready ? (
        <BigButton label="Give consent" onPress={() => router.push('/consent')} />
      ) : (
        <BigButton label="Start session" onPress={() => router.push('/pre-session')} disabled={!ready} />
      )}
      <Text style={styles.heading}>Past sessions</Text>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.session_id}
        ListEmptyComponent={<Text style={styles.muted}>No sessions yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.row}
            onPress={() => router.push({ pathname: '/data-check', params: { sessionId: item.session_id } })}
          >
            <Text style={styles.rowTitle}>
              {item.session_id} · {item.start_utc.slice(0, 10)}
            </Text>
            <Text style={styles.muted}>
              {duration(item)} · {item.status}
            </Text>
          </Pressable>
        )}
      />
      <Text style={styles.debug}>DEBUG (temporary): gps_point rows = {gpsCount}</Text>
      <View style={styles.footer}>
        {profile ? <BigButton secondary label="Edit profile" onPress={() => router.push('/profile')} /> : null}
        <BigButton secondary label="Setup checklist" onPress={() => router.push('/onboarding')} />
        <BigButton secondary label="Settings" onPress={() => router.push('/settings')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 14, backgroundColor: colors.bg },
  recovery: { gap: 10, padding: 14, borderRadius: 10, backgroundColor: colors.chip },
  recoveryTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
  debug: { fontSize: 14, color: colors.error },
  footer: { gap: 10 },
});
