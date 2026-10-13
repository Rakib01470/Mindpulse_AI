import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LayoutDashboard, ListChecks, Timer, NotebookPen, Settings as SettingsIcon } from 'lucide-react-native';
import type { RootStackParamList, TabParamList } from './types';
import { ThemeTokens } from '../utils/theme';
import { DashboardScreen } from '../screens/DashboardScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VoiceCaptureScreen } from '../screens/VoiceCaptureScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const c = ThemeTokens.colors;

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarItemStyle: { minHeight: 48 },
        sceneStyle: { backgroundColor: c.background },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} /> }} />
      <Tab.Screen name="Projects" component={ProjectsScreen} options={{ tabBarIcon: ({ color, size }) => <Timer color={color} size={size} /> }} />
      <Tab.Screen name="Notes" component={NotesScreen} options={{ tabBarIcon: ({ color, size }) => <NotebookPen color={color} size={size} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.textPrimary,
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="VoiceCapture"
        component={VoiceCaptureScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Task' }} />
    </Stack.Navigator>
  );
}
