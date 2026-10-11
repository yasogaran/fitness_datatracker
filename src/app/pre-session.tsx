import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getNetworkStateAsync } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { ChoiceRow } from '@/components/ChoiceRow';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { insertEnvReading } from '@/db/env';
import { getProfile } from '@/db/profile';
import { locationGranted } from '@/services/setupChecks';
import { startSession } from '@/services/recording';
import { nowUtcIso, utcOffsetMin } from '@/utils/time';
import { colors } from '@/utils/theme';

const SLEEP = ['1', '2', '3', '4', '5'] as const;
const INTERVALS = ['5', '10', '15'] as const;

export default function PreSession() {
  const db = useSQLiteContext();
  const [sleep, setSleep] = useState<(typeof SLEEP)[number] | null>(null);
  const [water, setWater] = useState('');
  const [clothing, setClothing] = useState('');
  const [note, setNote] = useState('');
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>('10');
  const [offline, setOffline] = useState(false);
  const [temp, setTemp] = useState('');
  const [humidity, setHumidity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getNetworkStateAsync()
      .then((n) => setOffline(n.isConnected === false || n.isInternetReachable === false))
      .catch(() => setOffline(false));
  }, []);

  async function onStart() {
    setError(null);
    if (!sleep) {
      setError('Please rate last night\'s sleep (1 to 5).');
      return;
    }
    const waterNum = water.trim() === '' ? null : Number(water.replace(',', '.'));
    if (waterNum !== null && (!Number.isFinite(waterNum) || waterNum < 0)) {
      setError('Water carried must be a number in ml, or empty.');
      return;
    }
    const tempNum = temp.trim() === '' ? null : Number(temp.replace(',', '.'));
    const humNum = humidity.trim() === '' ? null : Number(humidity.replace(',', '.'));
    if (tempNum !== null && (!Number.isFinite(tempNum) || tempNum < -50 || tempNum > 60)) {
      setError('Temperature must be between -50 and 60 C, or empty.');
      return;
    }
    if (humNum !== null && (!Number.isFinite(humNum) || humNum < 0 || humNum > 100)) {
      setError('Humidity must be between 0 and 100 %, or empty.');
      return;
    }
    setBusy(true);
    try {
      const profile = await getProfile(db);
      if (!profile) throw new Error('Create your profile first.');
      if (!(await locationGranted())) {
        throw new Error('Location permission is missing. Open the Setup checklist from Home.');
      }
      const startUtc = nowUtcIso();
      const session = await startSession(db, {
        user_id: profile.user_id,
        start_utc: startUtc,
        utc_offset_min: utcOffsetMin(),
        reminder_interval_min: Number(interval),
        sleep_quality: Number(sleep),
        water_carried_ml: waterNum,
        clothing_note: clothing.trim() || null,
        session_note: note.trim() || null,
      });
      if (offline && (tempNum !== null || humNum !== null)) {
        // FR-14: manual entry, flagged source = manual.
        await insertEnvReading(db, {
          session_id: session.session_id,
          ts_utc: startUtc,
          air_temp_c: tempNum,
          humidity_pct: humNum,
          source: 'manual',
        });
      }
      router.replace('/recording');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the session.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="New session">
      <View style={styles.card}>
        <Text style={styles.cardText}>Start a HIKING workout on your Galaxy Watch now.</Text>
      </View>
      <ChoiceRow label="How well did you sleep? (1 poor, 5 great)" options={SLEEP} value={sleep} onChange={setSleep} />
      <Field label="Water carried (ml, optional)" value={water} onChangeText={setWater} keyboardType="numeric" />
      <Field label="Clothing note (optional)" value={clothing} onChangeText={setClothing} />
      <Field label="Session note (optional)" value={note} onChangeText={setNote} />
      <ChoiceRow label="Remind me every (minutes)" options={INTERVALS} value={interval} onChange={setInterval} />
      {offline ? (
        <View style={styles.card}>
          <Text style={styles.cardText}>You seem to be offline.</Text>
          <Text style={styles.cardSub}>
            Optional: enter the weather yourself. Weather is fetched automatically once the phone is online.
          </Text>
          <Field label="Air temperature (C, optional)" value={temp} onChangeText={setTemp} keyboardType="numeric" />
          <Field label="Humidity (%, optional)" value={humidity} onChangeText={setHumidity} keyboardType="numeric" />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BigButton label={busy ? 'Starting...' : 'Start'} onPress={onStart} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.chip, borderRadius: 10, padding: 16 },
  cardText: { fontSize: 18, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 14, color: colors.muted, marginBottom: 8 },
  error: { color: colors.error, fontSize: 16 },
});
