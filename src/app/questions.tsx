import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { answerPrompt, listScheduledPrompts, reconcileScheduledPrompts } from '@/db/prompts';
import { getActiveSession } from '@/db/sessions';
import type { Session } from '@/types/models';
import { nowUtcIso } from '@/utils/time';
import { colors } from '@/utils/theme';

// Spec section 2.1
const RPE_HINTS: Record<number, string> = {
  1: 'very easy',
  3: 'easy',
  5: 'moderate',
  7: 'hard',
  9: 'very hard',
  10: 'maximum',
};
const SAFETY_MESSAGE = 'Please slow down, rest and drink water. You can end the session any time.';

type YesNo = 0 | 1 | null;

interface Target {
  session: Session;
  promptId: string;
  promptedAt: string;
  trigger: 'scheduled' | 'manual';
}

function Choice({ label, hint, on, onPress }: { label: string; hint?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>
      <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label}</Text>
      {hint ? <Text style={[styles.hint, on && styles.choiceTextOn]}>{hint}</Text> : null}
    </Pressable>
  );
}

function YesNoRow({ label, value, onChange }: { label: string; value: YesNo; onChange: (v: 0 | 1) => void }) {
  return (
    <View style={styles.block}>
      <Text style={styles.question}>{label}</Text>
      <View style={styles.row}>
        <Choice label="Yes" on={value === 1} onPress={() => onChange(1)} />
        <Choice label="No" on={value === 0} onPress={() => onChange(0)} />
      </View>
    </View>
  );
}

export default function Questions() {
  const db = useSQLiteContext();
  const { trigger, notifiedAt } = useLocalSearchParams<{ trigger?: string; notifiedAt?: string }>();
  const [target, setTarget] = useState<Target | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [thirst, setThirst] = useState<number | null>(null);
  const [dizzy, setDizzy] = useState<YesNo>(null);
  const [water, setWater] = useState<YesNo>(null);
  const [rested, setRested] = useState<YesNo>(null);
  const [saved, setSaved] = useState(false);

  // Work out which prompt this sheet answers.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getActiveSession(db);
      if (cancelled) return;
      if (!session) {
        setProblem('There is no active session.');
        return;
      }
      if (trigger !== 'scheduled') {
        setTarget({
          session,
          promptId: `${session.session_id}-M${Date.now()}`,
          promptedAt: nowUtcIso(),
          trigger: 'manual',
        });
        return;
      }
      await reconcileScheduledPrompts(db, session, nowUtcIso());
      const prompts = await listScheduledPrompts(db, session.session_id);
      if (cancelled) return;
      if (prompts.length === 0) {
        setProblem('No reminder was due yet.');
        return;
      }
      // Match the tapped notification to the closest scheduled prompt.
      const at = notifiedAt ? Number(notifiedAt) : Date.now();
      const match = prompts.reduce((best, p) =>
        Math.abs(Date.parse(p.prompted_at_utc) - at) < Math.abs(Date.parse(best.prompted_at_utc) - at) ? p : best,
      );
      if (match.status === 'answered' || match.status === 'skipped') {
        setProblem('This reminder was already handled.');
        return;
      }
      setTarget({
        session,
        promptId: match.prompt_id,
        promptedAt: notifiedAt ? new Date(at).toISOString() : match.prompted_at_utc,
        trigger: 'scheduled',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [db, trigger, notifiedAt]);

  const showSafety = (rpe !== null && rpe >= 9) || dizzy === 1;
  const complete = rpe !== null && thirst !== null && dizzy !== null && water !== null && rested !== null;

  async function save(answers: Parameters<typeof answerPrompt>[1]['answers']) {
    if (!target) return;
    await answerPrompt(db, {
      prompt_id: target.promptId,
      session_id: target.session.session_id,
      prompted_at_utc: target.promptedAt,
      answered_at_utc: nowUtcIso(),
      trigger: target.trigger,
      answers,
    });
  }

  async function onSubmit() {
    if (!complete) return;
    await save({
      rpe: rpe as number,
      thirst: thirst as number,
      felt_dizzy_or_cramp: dizzy as 0 | 1,
      drank_water: water as 0 | 1,
      rested: rested as 0 | 1,
    });
    if (showSafety) setSaved(true);
    else router.back();
  }

  async function onSkip() {
    await save(null);
    router.back();
  }

  if (problem) {
    return (
      <Screen title="Questions">
        <Text style={styles.question}>{problem}</Text>
        <BigButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    );
  }

  if (saved) {
    return (
      <Screen title="Saved">
        <Text style={styles.safety}>{SAFETY_MESSAGE}</Text>
        <BigButton label="OK" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title="Quick check">
      <View style={styles.block}>
        <Text style={styles.question}>How hard does this feel right now?</Text>
        <View style={styles.row}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Choice key={n} label={String(n)} hint={RPE_HINTS[n]} on={rpe === n} onPress={() => setRpe(n)} />
          ))}
        </View>
      </View>
      <View style={styles.block}>
        <Text style={styles.question}>How thirsty are you? (1 not at all, 5 very)</Text>
        <View style={styles.row}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Choice key={n} label={String(n)} on={thirst === n} onPress={() => setThirst(n)} />
          ))}
        </View>
      </View>
      <YesNoRow label="Dizzy, cramping or unwell?" value={dizzy} onChange={setDizzy} />
      <YesNoRow label="Drank water since the last prompt?" value={water} onChange={setWater} />
      <YesNoRow label="Rested since the last prompt?" value={rested} onChange={setRested} />
      {showSafety ? <Text style={styles.safety}>{SAFETY_MESSAGE}</Text> : null}
      <BigButton label="Submit" onPress={onSubmit} disabled={!complete || !target} />
      <BigButton secondary label="Skip" onPress={onSkip} disabled={!target} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  question: { fontSize: 20, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minWidth: 64,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.chip,
    alignItems: 'center',
  },
  choiceOn: { backgroundColor: colors.primary },
  choiceText: { fontSize: 22, fontWeight: '700', color: colors.text },
  choiceTextOn: { color: colors.primaryText },
  hint: { fontSize: 12, color: colors.muted },
  safety: { fontSize: 18, fontWeight: '600', color: colors.error, lineHeight: 26 },
});
