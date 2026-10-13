import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { ThemeTokens } from '../../utils/theme';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text variant="headlineSmall" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyMedium" style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ThemeTokens.spacing.md,
    paddingTop: ThemeTokens.spacing.sm,
    paddingBottom: ThemeTokens.spacing.sm,
    minHeight: 56,
  },
  text: { flex: 1 },
  title: { color: ThemeTokens.colors.textPrimary, fontWeight: '700' },
  subtitle: { color: ThemeTokens.colors.textMuted },
});
