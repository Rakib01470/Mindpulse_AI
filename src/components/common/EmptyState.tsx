import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { ThemeTokens } from '../../utils/theme';

export function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <View style={styles.wrap}>
      {icon}
      <Text variant="bodyLarge" style={styles.text}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: ThemeTokens.spacing.xl, gap: 12 },
  text: { color: ThemeTokens.colors.textMuted, textAlign: 'center' },
});
