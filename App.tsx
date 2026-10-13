import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { paperTheme, navTheme } from './src/utils/theme';
import { DatabaseProvider } from './src/context/DatabaseContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { TasksProvider } from './src/context/TasksContext';
import { ProjectsProvider } from './src/context/ProjectsContext';
import { StopTimerModal } from './src/components/projects/StopTimerModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <DatabaseProvider>
          <TasksProvider>
            <ProjectsProvider>
              <NavigationContainer theme={navTheme}>
                <AppNavigator />
                <StopTimerModal />
                <StatusBar style="light" />
              </NavigationContainer>
            </ProjectsProvider>
          </TasksProvider>
        </DatabaseProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
