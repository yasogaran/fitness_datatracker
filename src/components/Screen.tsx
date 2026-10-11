import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '@/utils/theme';

export function Screen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, backgroundColor: colors.bg, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
});
