import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { getSession } from '@/db/healthData';
import { pullFromHealthConnect } from '@/services/healthConnect';
import type { PullResult } from '@/services/healthConnect';
import type { Session } from '@/types/models';
import { colors } from '@/utils/theme';

function summary(r: PullResult): string[] {
  if (r.status !== 'ok') return [r.message];
  return [
    `Heart rate samples read: ${r.hrTotalRead} (${r.hrNew} new)`,
    `Step records read: ${r.stepsTotalRead} (${r.stepsNew} new)`,
    `Watch workout found: ${r.workoutFound === null ? 'not checked' : r.workoutFound ? 'yes' : 'no'}`,
  ];
}

export default function Sync() {
  const db = useSQLiteContext();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<PullResult | null>(null);

  useEffect(() => {
    getSession(db, sessionId ?? '').then((s) => {
      setSession(s);
      setLoaded(true);
    });
  }, [db, sessionId]);

  async function onPull() {
    if (!session) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await pullFromHealthConnect(db, session, setProgress));
    } finally {
      setRunning(false);
      setProgress('');
    }
  }

  if (!loaded) return <Screen title="Sync watch data" />;
  if (!session) {
    return (
      <Screen title="Sync watch data">
        <Text style={styles.text}>Open a session from Home first.</Text>
        <BigButton label="Back to Home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen title={`Sync ${session.session_id}`}>
      <Text style={styles.text}>1. Finish the workout on your watch.</Text>
      <Text style={styles.text}>2. Open Samsung Health on the phone and wait for the watch to sync.</Text>
      <Text style={styles.text}>3. Come back here and tap the button below.</Text>
      <Text style={styles.muted}>
        Samsung Health can take a few minutes to pass data to Health Connect. If the numbers look low, wait and pull
        again. Pulling again never creates duplicates.
      </Text>
      <BigButton label={running ? 'Pulling...' : 'Pull from Health Connect'} onPress={onPull} disabled={running} />
      {running ? <Text style={styles.muted}>{progress}</Text> : null}
      {result ? (
        <>
          {summary(result).map((line) => (
            <Text key={line} style={result.status === 'ok' ? styles.text : styles.error}>
              {line}
            </Text>
          ))}
          {result.status === 'denied' ? (
            <BigButton secondary label="Open setup checklist" onPress={() => router.push('/onboarding')} />
          ) : null}
        </>
      ) : null}
      <BigButton
        secondary
        label="Open Data check"
        onPress={() => router.push({ pathname: '/data-check', params: { sessionId: session.session_id } })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 18, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  error: { fontSize: 18, color: colors.error, fontWeight: '600' },
});
