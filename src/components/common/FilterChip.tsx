import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MIN_TOUCH, ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  icon?: React.ReactNode;
  accessibilityHint?: string;
}

/** Pill-shaped filter chip with a full 48px touch target (Section 6). */
export function FilterChip({ label, selected, onPress, onLongPress, icon, accessibilityHint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityHint={accessibilityHint}
      style={styles.touch}
    >
      <View style={[styles.chip, selected && styles.selected]}>
        {icon}
        <Text style={[styles.label, selected && styles.selectedLabel]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: MIN_TOUCH, justifyContent: 'center', marginRight: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  selected: { backgroundColor: c.accent, borderColor: c.accent },
  label: { color: c.textPrimary, fontSize: 14 },
  selectedLabel: { color: '#002233', fontWeight: '700' },
});
