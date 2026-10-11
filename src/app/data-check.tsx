import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { getSession } from '@/db/healthData';
import { computeDataCheck } from '@/services/dataCheck';
import type { DataCheck, Light } from '@/services/dataCheck';
import type { Session } from '@/types/models';
import { colors } from '@/utils/theme';

const LIGHTS: Record<Light, { label: string; color: string }> = {
  good: { label: 'Good', color: '#2E7D32' },
  sparse: { label: 'Sparse HR', color: '#F9A825' },
  missing: { label: 'Missing', color: '#C62828' },
};

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function DataCheckScreen() {
  const db = useSQLiteContext();
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [check, setCheck] = useState<DataCheck | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = sessionId ? await getSession(db, sessionId) : null;
        setSession(s);
        setCheck(s ? await computeDataCheck(db, s) : null);
        setLoaded(true);
      })();
    }, [db, sessionId]),
  );

  if (!loaded) return <Screen title="Data check" />;
  if (!session || !check) {
    return (
      <Screen title="Data check">
        <Text style={styles.label}>Open a session from Home first.</Text>
        <BigButton label="Back to Home" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const light = LIGHTS[check.light];
  return (
    <Screen title={`Data check ${session.session_id}`}>
      <View style={[styles.light, { backgroundColor: light.color }]}>
        <Text style={styles.lightText}>{light.label}</Text>
        <Text style={styles.lightSub}>{check.hrBinPct.toFixed(0)}% of 10 s bins have heart rate</Text>
      </View>
      {!check.synced ? (
        <Text style={styles.warn}>Watch data has not been pulled yet. Use the Sync watch data button below.</Text>
      ) : null}
      <Line label="Heart rate samples" value={String(check.hrSampleCount)} />
      <Line label="Average HR gap" value={check.avgHrGapS === null ? '-' : `${check.avgHrGapS.toFixed(1)} s`} />
      <Line label="Steps total (within session)" value={String(check.stepsTotal)} />
      <Line label="GPS points" value={String(check.gpsPointCount)} />
      <Line
        label="GPS median accuracy"
        value={check.gpsMedianAccuracyM === null ? '-' : `${check.gpsMedianAccuracyM.toFixed(1)} m`}
      />
      <Line label="Labels answered / prompts" value={`${check.labelsAnswered} / ${check.labelsTotal}`} />
      <Line label="Weather rows" value={String(check.weatherRows)} />
      <Line
        label="Watch workout found"
        value={check.workoutFound === null ? 'unknown' : check.workoutFound ? 'yes' : 'no'}
      />
      <BigButton
        label="Sync watch data"
        onPress={() => router.push({ pathname: '/sync', params: { sessionId: session.session_id } })}
      />
      <BigButton secondary label="Back to Home" onPress={() => router.replace('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  light: { borderRadius: 12, padding: 18, alignItems: 'center' },
  lightText: { fontSize: 32, fontWeight: '700', color: '#FFFFFF' },
  lightSub: { fontSize: 15, color: '#FFFFFF' },
  warn: { fontSize: 16, color: colors.error, fontWeight: '600' },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  label: { fontSize: 17, color: colors.text, flexShrink: 1 },
  value: { fontSize: 17, fontWeight: '700', color: colors.text },
});
