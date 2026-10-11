import { Text } from 'react-native';
import { Screen } from './Screen';
import { colors } from '@/utils/theme';

export function Placeholder({ title, stage }: { title: string; stage: string }) {
  return (
    <Screen title={title}>
      <Text style={{ color: colors.muted, fontSize: 16 }}>Placeholder. Implemented in {stage}.</Text>
    </Screen>
  );
}
