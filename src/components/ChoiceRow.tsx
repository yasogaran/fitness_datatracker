import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

interface Props<T extends string> {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string;
}

export function ChoiceRow<T extends string>({ label, options, value, onChange, error }: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((o) => (
          <Pressable
            key={o}
            accessibilityRole="button"
            onPress={() => onChange(o)}
            style={[styles.chip, value === o && styles.chipOn]}
          >
            <Text style={[styles.chipText, value === o && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 16, color: colors.text, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.chip },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 16, color: colors.text },
  chipTextOn: { color: colors.primaryText, fontWeight: '700' },
  error: { color: colors.error, fontSize: 14 },
});
