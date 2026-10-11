import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { getProfile, saveConsent } from '@/db/profile';
import { nowUtcIso } from '@/utils/time';
import { colors } from '@/utils/theme';

// PLACEHOLDER: the researcher replaces this text (and bumps the version) after ethics approval.
const CONSENT_VERSION = 'PLACEHOLDER-v0';
const CONSENT_TEXT =
  '[PLACEHOLDER CONSENT TEXT - TO BE REPLACED AFTER ETHICS APPROVAL]\n\n' +
  'This app records your location, heart rate, steps, local weather and your answers to ' +
  'short questions during a hike. Your data is stored on this phone under an anonymous ' +
  'code and is only shared when you choose to export it. You can stop at any time.';

export default function Consent() {
  const db = useSQLiteContext();
  const [userId, setUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    getProfile(db).then((p) => {
      setUserId(p?.user_id ?? null);
      setAgreed(p?.consent_at != null);
      setLoaded(true);
    });
  }, [db]);

  async function onSubmit() {
    if (!userId) return;
    await saveConsent(db, userId, CONSENT_VERSION, nowUtcIso());
    router.replace('/');
  }

  if (loaded && !userId) {
    return (
      <Screen title="Consent">
        <Text style={styles.body}>Please create your profile first.</Text>
        <BigButton label="Go to profile" onPress={() => router.replace('/profile')} />
      </Screen>
    );
  }

  return (
    <Screen title="Consent">
      <Text style={styles.body}>{CONSENT_TEXT}</Text>
      <Text style={styles.meta}>Version: {CONSENT_VERSION}</Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed((a) => !a)}
        style={styles.checkRow}
      >
        <View style={[styles.box, agreed && styles.boxOn]}>
          {agreed ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text style={styles.checkLabel}>I agree</Text>
      </Pressable>
      <BigButton label="Continue" onPress={onSubmit} disabled={!agreed || !userId} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 17, lineHeight: 24, color: colors.text },
  meta: { fontSize: 14, color: colors.muted },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  box: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary },
  tick: { color: colors.primaryText, fontSize: 22, fontWeight: '700' },
  checkLabel: { fontSize: 20, fontWeight: '600', color: colors.text },
});
