import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { Camera, FileText, ShieldCheck, Users } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface OnboardingScreenProps {
  onComplete: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const { t, isRTL } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const steps = [
    {
      icon: <FileText size={80} color="#10b981" />,
      title: t('onboarding.step1.title'),
      description: t('onboarding.step1.desc'),
    },
    {
      icon: <Camera size={80} color="#3b82f6" />,
      title: t('onboarding.step2.title'),
      description: t('onboarding.step2.desc'),
    },
    {
      icon: <ShieldCheck size={80} color="#8b5cf6" />,
      title: t('onboarding.step3.title'),
      description: t('onboarding.step3.desc'),
    },
    {
      icon: <Users size={80} color="#f59e0b" />,
      title: t('onboarding.step4.title'),
      description: t('onboarding.step4.desc'),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const styles = getStyles(isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onComplete}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {steps.map((step, index) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0] });
          const scale = scrollX.interpolate({ inputRange, outputRange: [0.8, 1, 0.8] });
          
          if (index !== currentStep) return null;

          return (
            <Animated.View key={index} style={[styles.stepContainer, { opacity, transform: [{ scale }] }]}>
              <View style={styles.iconContainer}>{step.icon}</View>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.description}>{step.description}</Text>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, currentStep === index && styles.activeDot]}
            />
          ))}
        </View>
        <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
          <Text style={styles.nextButtonText}>
            {currentStep === steps.length - 1 ? t('onboarding.done') : t('onboarding.next')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const getStyles = (isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { alignItems: isRTL ? 'flex-start' : 'flex-end', paddingHorizontal: 20, paddingTop: 10 },
  skipText: { color: '#6b7280', fontSize: 16 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  stepContainer: { alignItems: 'center', width: '100%' },
  iconContainer: { marginBottom: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', textAlign: 'center', marginBottom: 16 },
  description: { fontSize: 16, color: '#6b7280', textAlign: 'center', lineHeight: 24 },
  footer: { paddingHorizontal: 20, paddingBottom: 40 },
  pagination: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center', marginBottom: 30 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#d1d5db', marginHorizontal: 5 },
  activeDot: { backgroundColor: '#10b981', width: 20 },
  nextButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  nextButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
});

export default OnboardingScreen;