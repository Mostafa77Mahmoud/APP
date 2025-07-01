// app/components/AnalyzingAnimation.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Loader, CheckCircle, FileText, Search, Scale, BrainCircuit, ListChecks, FileSignature } from 'lucide-react-native';
import { Progress } from './ui/progress';

interface AnalyzingAnimationProps {
  isAnalyzing: boolean;
}

const AnalyzingAnimation: React.FC<AnalyzingAnimationProps> = ({ isAnalyzing }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const analysisSteps = [
    { nameKey: 'analyze.step.initial', icon: Search, durationFactor: 2.5 },
    { nameKey: 'analyze.step.extractText', icon: FileText, durationFactor: 4.5 },
    { nameKey: 'analyze.step.identifyTerms', icon: ListChecks, durationFactor: 5 },
    { nameKey: 'analyze.step.shariaComplianceCheck', icon: Scale, durationFactor: 6 },
    { nameKey: 'analyze.step.generateSuggestions', icon: BrainCircuit, durationFactor: 5 },
    { nameKey: 'analyze.step.compileResults', icon: FileSignature, durationFactor: 4 }
  ];

  const [currentVisualStepIndex, setCurrentVisualStepIndex] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // --- FIX: Changed NodeJS.Timeout to 'any' to match React Native's timer return type ---
    let stepTimeout: any = null;
    let progressInterval: any = null;
    let completionTimeout: any = null;

    if (isAnalyzing) {
      setShowCompletionMessage(false);
      setCurrentVisualStepIndex(0);
      setVisualProgress(0);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]).start();

      const totalFactorSum = analysisSteps.reduce((sum, s) => sum + s.durationFactor, 0);
      const visualUnitTime = 180; // Adjusted for a faster feel on mobile
      const totalVisualDuration = totalFactorSum * visualUnitTime;

      let currentStepCounter = 0;
      const advanceVisualStep = () => {
        if (currentStepCounter < analysisSteps.length - 1) {
          const stepSpecificDuration = analysisSteps[currentStepCounter].durationFactor * visualUnitTime;
          setCurrentVisualStepIndex(prev => prev + 1);
          currentStepCounter++;
          stepTimeout = setTimeout(advanceVisualStep, stepSpecificDuration);
        } else {
          if (progressInterval) clearInterval(progressInterval);
          setVisualProgress(99);
        }
      };
      
      const firstStepDuration = analysisSteps[0].durationFactor * visualUnitTime;
      stepTimeout = setTimeout(advanceVisualStep, firstStepDuration);
      
      const progressUpdateInterval = 100;
      progressInterval = setInterval(() => {
        setVisualProgress(prev => {
          const nextProgress = prev + (99 / (totalVisualDuration / progressUpdateInterval));
          if (nextProgress >= 99) {
            clearInterval(progressInterval!);
            return 99;
          }
          return nextProgress;
        });
      }, progressUpdateInterval);

    } else {
      if (visualProgress > 0 && visualProgress < 100) {
        setVisualProgress(100);
        setCurrentVisualStepIndex(analysisSteps.length);
        setShowCompletionMessage(true);
        completionTimeout = setTimeout(() => {
            setShowCompletionMessage(false);
        }, 3500);
      } else if (visualProgress === 0) {
        setShowCompletionMessage(false);
      }
      if (stepTimeout) clearTimeout(stepTimeout);
      if (progressInterval) clearInterval(progressInterval);
    }
    
    return () => {
      if (stepTimeout) clearTimeout(stepTimeout);
      if (progressInterval) clearInterval(progressInterval);
      if (completionTimeout) clearTimeout(completionTimeout);
    };
  }, [isAnalyzing]);

  if (!isAnalyzing && !showCompletionMessage) {
      return null;
  }

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.header}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            {isAnalyzing ? (
              <Loader size={24} color={isDark ? '#6ee7b7' : '#10b981'} />
            ) : (
              <CheckCircle size={24} color={isDark ? '#6ee7b7' : '#10b981'} />
            )}
            <Text style={styles.title}>{isAnalyzing ? t('upload.analyzing') : t('analyze.complete')}</Text>
          </View>
          <Text style={styles.percentage}>{Math.round(isAnalyzing ? visualProgress : 100)}%</Text>
        </View>
        
        <Progress value={isAnalyzing ? visualProgress : 100} style={{ marginBottom: 24 }} />

        <View style={styles.stepsContainer}>
          {analysisSteps.map((step, index) => {
            const StepIcon = step.icon;
            const isStepCompleted = index < currentVisualStepIndex || (!isAnalyzing && showCompletionMessage);
            const isStepActive = index === currentVisualStepIndex && isAnalyzing;
            
            return (
              <View key={step.nameKey} style={[styles.stepItem, { opacity: isStepCompleted || isStepActive ? 1 : 0.6 }]}>
                <View style={[styles.stepIconContainer, isStepCompleted ? styles.completedStepIcon : isStepActive ? styles.activeStepIcon : {}]}>
                  {isStepCompleted ? (
                    <CheckCircle size={20} color={isDark ? '#6ee7b7' : '#10b981'} />
                  ) : (
                    <StepIcon size={20} color={isStepActive ? (isDark ? '#6ee7b7' : '#10b981') : (isDark ? '#9ca3af' : '#6b7280')} />
                  )}
                </View>
                <Text style={[styles.stepText, isStepCompleted ? styles.completedStepText : isStepActive ? styles.activeStepText : {}]}>
                  {t(step.nameKey)}
                </Text>
              </View>
            );
          })}
        </View>
        
        {showCompletionMessage && (
          <Text style={styles.completionMessage}>{t('analyze.viewResults')}</Text>
        )}
      </Animated.View>
    </View>
  );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  container: { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '600', color: isDark ? '#f9fafb' : '#111827' },
  percentage: { fontSize: 16, fontWeight: 'bold', color: isDark ? '#6ee7b7' : '#10b981' },
  stepsContainer: { gap: 12 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#374151' : '#f3f4f6' },
  activeStepIcon: { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' },
  completedStepIcon: { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' },
  stepText: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280' },
  activeStepText: { color: isDark ? '#f9fafb' : '#111827', fontWeight: 'bold' },
  completedStepText: { color: isDark ? '#6ee7b7' : '#10b981', fontWeight: '500' },
  completionMessage: { textAlign: 'center', marginTop: 20, fontSize: 14, color: isDark ? '#6ee7b7' : '#10b981', fontWeight: '500' },
});

export default AnalyzingAnimation;
