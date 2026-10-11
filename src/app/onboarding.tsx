import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { BigButton } from '@/components/BigButton';
import { Screen } from '@/components/Screen';
import { SETTING_KEYS, getSetting, setSetting } from '@/db/appSettings';
import {
  fixHealthConnectAvailability,
  fixHealthConnectPermissions,
  fixLocation,
  fixNotifications,
  hcAvailability,
  hcPermissionsGranted,
  locationGranted,
  notificationsGranted,
  openBatterySettings,
} from '@/services/setupChecks';
import { nowUtcIso } from '@/utils/time';
import { colors } from '@/utils/theme';

interface Status {
  hcAvailable: boolean;
  hcAvailabilityNote: string;
  hcPermissions: boolean;
  location: boolean;
  notifications: boolean;
  battery: boolean;
  samsung: boolean;
  checkedAt: string | null;
}

interface RowProps {
  label: string;
  ok: boolean;
  note?: string;
  fixLabel?: string;
  onFix?: () => void;
  confirmLabel?: string;
  onToggle?: () => void;
}

function Row({ label, ok, note, fixLabel = 'Fix', onFix, confirmLabel, onToggle }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {ok ? '✅' : '⬜'} {label}
      </Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {onFix && !ok ? <BigButton secondary label={fixLabel} onPress={onFix} /> : null}
      {onToggle ? <BigButton secondary label={ok ? 'Untick' : (confirmLabel ?? 'Confirm')} onPress={onToggle} /> : null}
    </View>
  );
}

export default function Onboarding() {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const availability = await hcAvailability();
      const [hcPermissions, location, notifications, battery, samsung] = await Promise.all([
        availability === 'available' ? hcPermissionsGranted() : Promise.resolve(false),
        locationGranted(),
        notificationsGranted(),
        getSetting(db, SETTING_KEYS.batteryConfirmed),
        getSetting(db, SETTING_KEYS.samsungSharingConfirmed),
      ]);
      const checkedAt = nowUtcIso();
      await setSetting(db, SETTING_KEYS.lastCheckedAt, checkedAt);
      setStatus({
        hcAvailable: availability === 'available',
        hcAvailabilityNote:
          availability === 'update_required'
            ? 'Health Connect needs an update from the Play Store.'
            : availability === 'unavailable'
              ? 'Not found. Android 13 or older needs the Health Connect app from the Play Store.'
              : '',
        hcPermissions,
        location,
        notifications,
        battery: battery === '1',
        samsung: samsung === '1',
        checkedAt,
      });
    } finally {
      setBusy(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Fix flows leave the app (system dialog or settings), so re-check afterwards.
  async function runFix(fix: () => Promise<void>) {
    try {
      await fix();
    } finally {
      await refresh();
    }
  }

  async function toggle(key: string, current: boolean) {
    await setSetting(db, key, current ? '0' : '1');
    await refresh();
  }

  if (!status) {
    return (
      <Screen title="Setup checklist">
        <Text style={styles.note}>Checking...</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Setup checklist">
      <Row
        label="Health Connect available"
        ok={status.hcAvailable}
        note={status.hcAvailabilityNote}
        fixLabel="Open Play Store"
        onFix={() => runFix(fixHealthConnectAvailability)}
      />
      <Row
        label="Health Connect permissions (heart rate, steps, exercise)"
        ok={status.hcPermissions}
        note={status.hcAvailable ? 'Heart rate and steps are required.' : 'Needs Health Connect first.'}
        onFix={status.hcAvailable ? () => runFix(fixHealthConnectPermissions) : undefined}
      />
      <Row
        label="Location (including background)"
        ok={status.location}
        note='Choose "Allow all the time" on the settings page that opens.'
        onFix={() => runFix(fixLocation)}
      />
      <Row label="Notifications" ok={status.notifications} onFix={() => runFix(fixNotifications)} />
      <Row
        label="Battery optimization: set HikeLogger to Unrestricted"
        ok={status.battery}
        note="Android cannot tell this app the result, so tick it yourself after changing it."
        fixLabel="Open battery settings"
        onFix={() => runFix(async () => void (await openBatterySettings()))}
        confirmLabel="I did this"
        onToggle={() => toggle(SETTING_KEYS.batteryConfirmed, status.battery)}
      />
      <Row
        label="Samsung Health shares data to Health Connect"
        ok={status.samsung}
        note="In Samsung Health: Settings, Health Connect (menu names vary). Allow heart rate, steps and exercise."
        confirmLabel="I did this"
        onToggle={() => toggle(SETTING_KEYS.samsungSharingConfirmed, status.samsung)}
      />
      <BigButton label={busy ? 'Checking...' : 'Re-check'} onPress={refresh} disabled={busy} />
      <Text style={styles.note}>Last checked: {status.checkedAt}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { fontSize: 18, fontWeight: '600', color: colors.text },
  note: { fontSize: 14, color: colors.muted },
});
