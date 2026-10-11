import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { getProfile } from '@/db/profile';
import { listSessions } from '@/db/sessions';
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
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getProfile(db), listSessions(db)]).then(([p, s]) => {
        setProfile(p);
        setSessions(s);
        setLoaded(true);
      });
    }, [db]),
  );

  const ready = profile?.consent_at != null;

  return (
    <View style={styles.container}>
      {loaded && !profile ? (
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
          <View style={styles.row}>
            <Text style={styles.rowTitle}>
              {item.session_id} · {item.start_utc.slice(0, 10)}
            </Text>
            <Text style={styles.muted}>
              {duration(item)} · {item.status}
            </Text>
          </View>
        )}
      />
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
  heading: { fontSize: 20, fontWeight: '700', color: colors.text },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  muted: { fontSize: 15, color: colors.muted },
  footer: { gap: 10 },
});
