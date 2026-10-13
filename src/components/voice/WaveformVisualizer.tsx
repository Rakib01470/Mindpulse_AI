import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Mic } from 'lucide-react-native';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;
const BAR_WEIGHTS = [0.45, 0.75, 1, 0.75, 0.45];

/** Pulsing microphone with live level bars driven by the recognizer's volume events (-2..10). */
export function WaveformVisualizer({ active, volume }: { active: boolean; volume: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const bars = useRef(BAR_WEIGHTS.map(() => new Animated.Value(0.15))).current;

  useEffect(() => {
    if (!active) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  useEffect(() => {
    const level = active ? Math.max(0, Math.min(10, volume)) / 10 : 0;
    Animated.parallel(
      bars.map((b, i) =>
        Animated.timing(b, {
          toValue: 0.15 + level * BAR_WEIGHTS[i] * 0.85,
          duration: 110,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [volume, active, bars]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.wrap}>
      <View style={styles.micWrap}>
        <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
        <View style={[styles.mic, !active && styles.micIdle]}>
          <Mic color={active ? '#002233' : c.textPrimary} size={40} />
        </View>
      </View>
      <View style={styles.bars}>
        {bars.map((b, i) => (
          <Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: b }] }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 24, paddingVertical: 16 },
  micWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: c.accent },
  mic: { width: 96, height: 96, borderRadius: 48, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  micIdle: { backgroundColor: c.surfaceVariant },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48 },
  bar: { width: 8, height: 48, borderRadius: 4, backgroundColor: c.accent },
});
