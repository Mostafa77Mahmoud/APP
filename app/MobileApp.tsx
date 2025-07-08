// app/MobileApp.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import HistoryScreen from './screens/HistoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import ResultsScreen from './screens/ResultsScreen';
import UploadScreen from './screens/UploadScreen'; // Correctly imported
import MobileNavigation from './components/MobileNavigation';

import { useLanguage } from './contexts/LanguageContext';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { ContractProvider } from './contexts/ContractContext';

const { width } = Dimensions.get('window');

export type ScreenType = 'onboarding' | 'home' | 'camera' | 'history' | 'profile' | 'upload' | 'results';

interface NavigationData {
  sessionId?: string;
  [key: string]: any;
}

const MobileApp = () => {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const { isLoading: isAuthLoading } = useAuth();

  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [navigationData, setNavigationData] = useState<NavigationData>({});
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const onboardingSeen = await AsyncStorage.getItem('shariaa_onboarding_seen');
        if (onboardingSeen === 'true') {
          setHasSeenOnboarding(true);
          setCurrentScreen('home');
        } else {
          setCurrentScreen('onboarding');
        }
      } catch (e) {
        console.error("Failed to load onboarding status", e);
        setCurrentScreen('onboarding');
      } finally {
        setIsAppLoading(false);
      }
    };
    initializeApp();
  }, []);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('shariaa_onboarding_seen', 'true');
      setHasSeenOnboarding(true);
      handleNavigate('home');
    } catch (e) {
      console.error("Failed to save onboarding status", e);
    }
  };

  const handleNavigate = (screen: ScreenType, data?: NavigationData) => {
    const isNavigatingForward = screen !== 'home';
    const slideToValue = isNavigatingForward ? (isRTL ? -width : width) : (isRTL ? width : -width);

    Animated.timing(slideAnim, {
      toValue: slideToValue,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentScreen(screen);
      setNavigationData(data || {});
      slideAnim.setValue(-slideToValue);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleBack = () => {
    handleNavigate('home');
  };

  const handleAnalysisComplete = (sessionId: string) => {
    handleNavigate('results', { sessionId });
  };

  const renderScreen = () => {
    const screenProps = {
      onNavigate: handleNavigate,
      onBack: handleBack,
      ...navigationData,
    };

    switch (currentScreen) {
      case 'onboarding':
        return <OnboardingScreen onComplete={handleOnboardingComplete} />;
      case 'home':
        return <HomeScreen {...screenProps} />;
      case 'camera':
        return <CameraScreen {...screenProps} />;
      case 'history':
        return <HistoryScreen {...screenProps} />;
      case 'profile':
        return <ProfileScreen {...screenProps} />;
      case 'upload':
        return (
          <UploadScreen
            onAnalysisComplete={handleAnalysisComplete}
            onBack={handleBack}
            preSelectedFile={navigationData?.preSelectedFile}
            fromCamera={navigationData?.fromCamera}
            pageCount={navigationData?.pageCount}
            autoUpload={navigationData?.autoUpload}
          />
        );
      case 'results':
        return <ResultsScreen {...screenProps} />;
      default:
        return <HomeScreen {...screenProps} />;
    }
  };

  const isDarkMode = theme === 'dark';
  const containerStyle = {
    ...styles.container,
    backgroundColor: isDarkMode ? '#0a0a0a' : '#f8fafc',
  };

  if (isAppLoading || isAuthLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" backgroundColor="#10b981" />
      </View>
    );
  }

  const showNavigation = ['home', 'history', 'profile'].includes(currentScreen);

  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={containerStyle.backgroundColor} 
      />
      <SafeAreaView style={containerStyle}>
        <Animated.View style={[styles.screenContainer, { transform: [{ translateX: slideAnim }] }]}>
          {renderScreen()}
        </Animated.View>

        {showNavigation && (
          <MobileNavigation 
            currentScreen={currentScreen} 
            onNavigate={handleNavigate}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10b981',
  },
  screenContainer: {
    flex: 1,
  },
});

export default MobileApp;