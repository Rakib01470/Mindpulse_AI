import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Button, HelperText, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock, X } from 'lucide-react-native';
import type { TaskDraft } from '../../context/TasksContext';
import type { Priority } from '../../database/types';
import { FilterChip } from '../common/FilterChip';
import { LIMITS } from '../../utils/constants';
import { formatDisplayDate, formatTime12, toHHmm, toIsoDate } from '../../utils/formatting';
import { ThemeTokens } from '../../utils/theme';

const c = ThemeTokens.colors;

interface Props {
  value: TaskDraft;
  onChange: (next: TaskDraft) => void;
  categories: string[];
  showProgress?: boolean;
  titleError?: string | null;
}

function parseLocal(date: string | null, time: string | null): Date {
  const d = new Date();
  if (date) {
    const [y, m, day] = date.split('-').map(Number);
    d.setFullYear(y, m - 1, day);
  }
  if (time) {
    const [h, min] = time.split(':').map(Number);
    d.setHours(h, min, 0, 0);
  }
  return d;
}

export function TaskForm({ value, onChange, categories, showProgress, titleError }: Props) {
  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => onChange({ ...value, [k]: v });
  const [iosPicker, setIosPicker] = React.useState<'date' | 'time' | null>(null);

  const allCategories = categories.some((n) => n.toLowerCase() === value.category_name.toLowerCase())
    ? categories
    : [...categories, value.category_name];

  const openPicker = (mode: 'date' | 'time') => {
    const onPicked = (e: DateTimePickerEvent, d?: Date) => {
      setIosPicker(null);
      if (e.type !== 'set' || !d) return;
      if (mode === 'date') set('due_date', toIsoDate(d));
      else set('due_time', toHHmm(d));
    };
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: parseLocal(value.due_date, value.due_time), mode, is24Hour: false, onChange: onPicked });
    } else {
      setIosPicker(mode);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        label="Title"
        accessibilityLabel="Task title"
        value={value.title}
        onChangeText={(t) => set('title', t)}
        maxLength={LIMITS.taskTitle}
        style={styles.input}
        error={!!titleError}
      />
      <HelperText type={titleError ? 'error' : 'info'} visible>
        {titleError ?? `${value.title.trim().length}/${LIMITS.taskTitle}`}
      </HelperText>

      <Text variant="labelLarge" style={styles.label}>
        Category
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {allCategories.map((name) => (
          <FilterChip
            key={name}
            label={categories.includes(name) ? name : `${name} (new)`}
            selected={name.toLowerCase() === value.category_name.toLowerCase()}
            onPress={() => set('category_name', name)}
          />
        ))}
      </ScrollView>

      <Text variant="labelLarge" style={styles.label}>
        Priority
      </Text>
      <SegmentedButtons
        value={value.priority}
        onValueChange={(v) => set('priority', v as Priority)}
        buttons={(['High', 'Medium', 'Low'] as const).map((p) => ({ value: p, label: p, style: styles.segment }))}
      />

      <Text variant="labelLarge" style={styles.label}>
        Due
      </Text>
      <View style={styles.row}>
        <Button mode="outlined" icon={({ color }) => <CalendarDays color={color} size={18} />} onPress={() => openPicker('date')} style={styles.dueBtn}>
          {value.due_date ? formatDisplayDate(value.due_date) : 'Set date'}
        </Button>
        {value.due_date ? (
          <IconButton icon={({ size }) => <X color={c.textMuted} size={size} />} onPress={() => set('due_date', null)} style={styles.clearBtn} accessibilityLabel="Clear date" />
        ) : null}
        <Button mode="outlined" icon={({ color }) => <Clock color={color} size={18} />} onPress={() => openPicker('time')} style={styles.dueBtn}>
          {value.due_time ? formatTime12(value.due_time) : 'Set time'}
        </Button>
        {value.due_time ? (
          <IconButton icon={({ size }) => <X color={c.textMuted} size={size} />} onPress={() => set('due_time', null)} style={styles.clearBtn} accessibilityLabel="Clear time" />
        ) : null}
      </View>
      {iosPicker ? (
        <DateTimePicker
          value={parseLocal(value.due_date, value.due_time)}
          mode={iosPicker}
          onChange={(e, d) => {
            setIosPicker(null);
            if (e.type === 'set' && d) {
              if (iosPicker === 'date') set('due_date', toIsoDate(d));
              else set('due_time', toHHmm(d));
            }
          }}
        />
      ) : null}

      <TextInput
        mode="outlined"
        label="Summary"
        accessibilityLabel="Task summary"
        value={value.summary ?? ''}
        onChangeText={(t) => set('summary', t)}
        multiline
        style={[styles.input, styles.spaced]}
      />
      <TextInput
        mode="outlined"
        label="Details"
        accessibilityLabel="Task details"
        value={value.details ?? ''}
        onChangeText={(t) => set('details', t)}
        multiline
        style={[styles.input, styles.spaced]}
      />

      {showProgress ? (
        <View style={styles.spaced}>
          <Text variant="labelLarge" style={styles.label}>
            Progress: {value.progress_percent}%
          </Text>
          <Slider
            minimumValue={0}
            maximumValue={100}
            step={5}
            value={value.progress_percent}
            onValueChange={(v) => set('progress_percent', Math.round(v))}
            minimumTrackTintColor={c.accent}
            maximumTrackTintColor={c.border}
            thumbTintColor={c.accent}
            style={styles.slider}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  input: { backgroundColor: c.surface },
  label: { color: c.textMuted, marginTop: 8, marginBottom: 2 },
  segment: { minHeight: 48, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  dueBtn: { minHeight: 48, justifyContent: 'center' },
  clearBtn: { width: 48, height: 48, margin: 0 },
  spaced: { marginTop: 10 },
  slider: { height: 48 },
});
