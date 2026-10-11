import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/utils/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}

export function BigButton({ label, onPress, disabled, secondary }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.primary },
  disabled: { opacity: 0.4 },
  label: { color: colors.primaryText, fontSize: 18, fontWeight: '700' },
  secondaryLabel: { color: colors.primary },
});
