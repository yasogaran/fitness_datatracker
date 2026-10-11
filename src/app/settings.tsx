import { router } from 'expo-router';
import { Text } from 'react-native';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { colors } from '@/utils/theme';

export default function Settings() {
  return (
    <Screen title="Settings">
      <BigButton label="Re-check setup" onPress={() => router.push('/onboarding')} />
      <Text style={{ color: colors.muted, fontSize: 16 }}>
        Reminder interval, units and delete-all-data are added in a later stage.
      </Text>
    </Screen>
  );
}
