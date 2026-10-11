import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { ChoiceRow } from '@/components/ChoiceRow';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { getProfile, saveProfile } from '@/db/profile';
import type { FitnessLevel, Sex } from '@/types/models';

const SEXES = ['female', 'male', 'other'] as const;
const LEVELS = ['Beginner', 'Regular', 'Athlete'] as const;

type Errors = Partial<Record<string, string>>;

function num(s: string): number | null {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
}

export default function Profile() {
  const db = useSQLiteContext();
  const [code, setCode] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [restingHr, setRestingHr] = useState('');
  const [maxHr, setMaxHr] = useState('');
  const [maxHrEdited, setMaxHrEdited] = useState(false);
  const [level, setLevel] = useState<FitnessLevel | null>(null);
  const [pace, setPace] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [hasConsent, setHasConsent] = useState(false);
  const [isExisting, setIsExisting] = useState(false);

  useEffect(() => {
    getProfile(db).then((p) => {
      if (!p) return;
      setIsExisting(true);
      setCode(p.user_id);
      setAge(String(p.age));
      setSex(p.sex);
      setWeight(String(p.weight_kg));
      setHeight(String(p.height_cm));
      setRestingHr(String(p.resting_hr));
      setMaxHr(String(p.max_hr_est));
      setMaxHrEdited(true);
      setLevel(p.fitness_level);
      setPace(String(p.usual_pace_kmh));
      setHasConsent(p.consent_at != null);
    });
  }, [db]);

  function onAgeChange(v: string) {
    setAge(v);
    const a = num(v);
    if (!maxHrEdited && a !== null && a > 0) setMaxHr(String(220 - Math.round(a)));
  }

  async function onSave() {
    const e: Errors = {};
    const codeTrim = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,10}$/.test(codeTrim)) e.code = 'Use a short code like U01 (no names).';
    const a = num(age);
    if (a === null || a < 10 || a > 100) e.age = 'Enter age 10 to 100.';
    if (!sex) e.sex = 'Choose one.';
    const w = num(weight);
    if (w === null || w < 20 || w > 300) e.weight = 'Enter weight in kg.';
    const h = num(height);
    if (h === null || h < 100 || h > 250) e.height = 'Enter height in cm.';
    const r = num(restingHr);
    if (r === null || r < 30 || r > 120) e.resting = 'Enter resting HR 30 to 120.';
    const m = num(maxHr);
    if (m === null || m < 100 || m > 230) e.max = 'Enter max HR 100 to 230.';
    if (!level) e.level = 'Choose one.';
    const p = num(pace);
    if (p === null || p <= 0 || p > 15) e.pace = 'Enter usual pace in km/h.';
    setErrors(e);
    if (Object.keys(e).length > 0 || !sex || !level) return;

    await saveProfile(db, {
      user_id: codeTrim,
      age: Math.round(a as number),
      sex,
      weight_kg: w as number,
      height_cm: h as number,
      resting_hr: Math.round(r as number),
      max_hr_est: Math.round(m as number),
      fitness_level: level,
      usual_pace_kmh: p as number,
    });
    router.replace(hasConsent ? '/' : '/consent');
  }

  return (
    <Screen title="Profile">
      <Field
        label="Participant code (anonymous, e.g. U01)"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        error={errors.code}
      />
      <Field label="Age" value={age} onChangeText={onAgeChange} keyboardType="numeric" error={errors.age} />
      <ChoiceRow label="Sex" options={SEXES} value={sex} onChange={setSex} error={errors.sex} />
      <Field label="Weight (kg)" value={weight} onChangeText={setWeight} keyboardType="numeric" error={errors.weight} />
      <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" error={errors.height} />
      <Field
        label="Resting heart rate (bpm)"
        value={restingHr}
        onChangeText={setRestingHr}
        keyboardType="numeric"
        error={errors.resting}
      />
      <Field
        label="Max heart rate estimate (bpm, default 220 minus age)"
        value={maxHr}
        onChangeText={(v) => {
          setMaxHr(v);
          setMaxHrEdited(true);
        }}
        keyboardType="numeric"
        error={errors.max}
      />
      <ChoiceRow label="Fitness level" options={LEVELS} value={level} onChange={setLevel} error={errors.level} />
      <Field label="Usual hiking pace (km/h)" value={pace} onChangeText={setPace} keyboardType="numeric" error={errors.pace} />
      <BigButton label={isExisting ? 'Save profile' : 'Save and continue'} onPress={onSave} />
    </Screen>
  );
}
