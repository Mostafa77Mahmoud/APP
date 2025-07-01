
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Loader, CheckCircle, FileText, Search, Scale, BrainCircuit, ListChecks, FileSignature, Sparkles } from 'lucide-react-native';
import { Progress } from './ui/progress';

interface AnalyzingAnimationProps {
  isAnalyzing: boolean;
  isLive?: boolean;
}

const AnalyzingAnimation: React.FC<AnalyzingAnimationProps> = ({ isAnalyzing, isLive = false }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const analysisSteps = [
    { nameKey: 'analyze.step.initial', icon: Search, durationFactor: 3.5, shouldSpin: true },
    { nameKey: 'analyze.step.extractText', icon: FileText, durationFactor: 5.2, shouldSpin: false },
    { nameKey: 'analyze.step.identifyTerms', icon: ListChecks, durationFactor: 6.8, shouldSpin: true },
    { nameKey: 'analyze.step.shariaComplianceCheck', icon: Scale, durationFactor: 8.5, shouldSpin: true },
    { nameKey: 'analyze.step.generateSuggestions', icon: BrainCircuit, durationFactor: 7.3, shouldSpin: true },
    { nameKey: 'analyze.step.compileResults', icon: FileSignature, durationFactor: 4.7, shouldSpin: false }
  ];

  const [currentVisualStepIndex, setCurrentVisualStepIndex] = useState(0);
  const [visualProgress, setVisualProgress] = useState(0);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [currentSubMessage, setCurrentSubMessage] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  const subMessages = [
    t('analyze.submessage.processing'),
    t('analyze.submessage.examining'),
    t('analyze.submessage.validating'),
    t('analyze.submessage.optimizing'),
  ];

  useEffect(() => {
    let stepTimeout: any = null;
    let progressInterval: any = null;
    let completionTimeout: any = null;
    let subMessageInterval: any = null;

    if (isAnalyzing) {
      setShowCompletionMessage(false);
      setCurrentVisualStepIndex(0);
      setVisualProgress(0);
      setCurrentSubMessage(0);

      // Enhanced entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, { 
          toValue: 1, 
          duration: 500, 
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true 
        }),
        Animated.spring(scaleAnim, { 
          toValue: 1, 
          tension: 50,
          friction: 7,
          useNativeDriver: true 
        }),
      ]).start();

      // Continuous pulse animation
      const createPulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]).start(() => {
          if (isAnalyzing) createPulse();
        });
      };
      createPulse();

      // Sparkle animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(sparkleAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();

      // Spinning animation for active step icons
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Calculate timing for 26-38 seconds
      const totalFactorSum = analysisSteps.reduce((sum, s) => sum + s.durationFactor, 0);
      const targetDuration = isLive ? 32000 : (26000 + Math.random() * 12000); // 26-38 seconds
      const visualUnitTime = targetDuration / totalFactorSum;

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
      
      // Progress update with more realistic increments
      const progressUpdateInterval = 150;
      let lastProgressTime = Date.now();
      progressInterval = setInterval(() => {
        const currentTime = Date.now();
        const deltaTime = currentTime - lastProgressTime;
        lastProgressTime = currentTime;
        
        setVisualProgress(prev => {
          const progressIncrement = (99 / targetDuration) * deltaTime;
          const nextProgress = prev + progressIncrement + (Math.random() * 0.5 - 0.25); // Add slight randomness
          if (nextProgress >= 99) {
            clearInterval(progressInterval!);
            return 99;
          }
          return Math.max(0, Math.min(99, nextProgress));
        });
      }, progressUpdateInterval);

      // Rotate sub-messages
      subMessageInterval = setInterval(() => {
        setCurrentSubMessage(prev => (prev + 1) % subMessages.length);
      }, 3000);

    } else {
      if (visualProgress > 0 && visualProgress < 100) {
        setVisualProgress(100);
        setCurrentVisualStepIndex(analysisSteps.length);
        setShowCompletionMessage(true);
        
        // Completion animation
        Animated.sequence([
          Animated.timing(sparkleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(sparkleAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
        
        completionTimeout = setTimeout(() => {
          setShowCompletionMessage(false);
        }, 4000);
      } else if (visualProgress === 0) {
        setShowCompletionMessage(false);
      }
      
      // Clear all intervals and timeouts
      if (stepTimeout) clearTimeout(stepTimeout);
      if (progressInterval) clearInterval(progressInterval);
      if (subMessageInterval) clearInterval(subMessageInterval);
    }
    
    return () => {
      if (stepTimeout) clearTimeout(stepTimeout);
      if (progressInterval) clearInterval(progressInterval);
      if (completionTimeout) clearTimeout(completionTimeout);
      if (subMessageInterval) clearInterval(subMessageInterval);
    };
  }, [isAnalyzing, isLive]);

  if (!isAnalyzing && !showCompletionMessage) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <Animated.View style={[
        styles.container, 
        { 
          opacity: fadeAnim, 
          transform: [{ scale: scaleAnim }] 
        }
      ]}>
        <View style={styles.header}>
          <View style={styles.iconRow}>
            <Animated.View style={[
              styles.iconContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}>
              {isAnalyzing ? (
                <Loader size={24} color={isDark ? '#6ee7b7' : '#10b981'} />
              ) : (
                <CheckCircle size={24} color={isDark ? '#6ee7b7' : '#10b981'} />
              )}
            </Animated.View>
            
            <Animated.View style={[
              styles.sparkleContainer,
              { 
                opacity: sparkleAnim,
                transform: [{
                  rotate: sparkleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  })
                }]
              }
            ]}>
              <Sparkles size={16} color={isDark ? '#fbbf24' : '#f59e0b'} />
            </Animated.View>
            
            <View style={styles.titleContainer}>
              <Text style={styles.title}>
                {isAnalyzing ? t('upload.analyzing') : t('analyze.complete')}
              </Text>
              {isAnalyzing && (
                <Text style={styles.subMessage}>
                  {subMessages[currentSubMessage]}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.progressInfo}>
            <Text style={styles.percentage}>
              {Math.round(isAnalyzing ? visualProgress : 100)}%
            </Text>
            {isLive && isAnalyzing && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('analyze.live')}</Text>
              </View>
            )}
          </View>
        </View>
        
        <Progress 
          value={isAnalyzing ? visualProgress : 100} 
          style={styles.progressBar}
          indicatorStyle={{ backgroundColor: isDark ? '#6ee7b7' : '#10b981' }}
        />

        <View style={styles.stepsContainer}>
          {analysisSteps.map((step, index) => {
            const StepIcon = step.icon;
            const isStepCompleted = index < currentVisualStepIndex || (!isAnalyzing && showCompletionMessage);
            const isStepActive = index === currentVisualStepIndex && isAnalyzing;
            
            const spin = spinAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            });
            
            return (
              <Animated.View 
                key={step.nameKey} 
                style={[
                  styles.stepItem, 
                  { 
                    opacity: isStepCompleted || isStepActive ? 1 : 0.4,
                    transform: [{
                      translateX: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      })
                    }]
                  }
                ]}
              >
                <Animated.View style={[
                  styles.stepIconContainer, 
                  isStepCompleted ? styles.completedStepIcon : 
                  isStepActive ? styles.activeStepIcon : {},
                  isStepActive && {
                    transform: [
                      { scale: pulseAnim },
                      ...(step.shouldSpin ? [{ rotate: spin }] : [])
                    ]
                  }
                ]}>
                  {isStepCompleted ? (
                    <CheckCircle size={20} color={isDark ? '#6ee7b7' : '#10b981'} />
                  ) : (
                    <Animated.View style={isStepActive && step.shouldSpin ? { transform: [{ rotate: spin }] } : {}}>
                      <StepIcon 
                        size={20} 
                        color={isStepActive ? (isDark ? '#6ee7b7' : '#10b981') : (isDark ? '#9ca3af' : '#6b7280')} 
                      />
                    </Animated.View>
                  )}
                </Animated.View>
                <Text style={[
                  styles.stepText, 
                  isStepCompleted ? styles.completedStepText : 
                  isStepActive ? styles.activeStepText : {}
                ]}>
                  {t(step.nameKey)}
                </Text>
                {isStepActive && (
                  <Animated.View style={[
                    styles.activeIndicator,
                    { opacity: pulseAnim }
                  ]} />
                )}
              </Animated.View>
            );
          })}
        </View>
        
        {showCompletionMessage && (
          <Animated.View style={[
            styles.completionContainer,
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}>
            <Text style={styles.completionMessage}>{t('analyze.viewResults')}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
  overlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0, 0, 0, 0.9)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 100 
  },
  container: { 
    backgroundColor: isDark ? '#1f2937' : '#ffffff', 
    borderRadius: 20, 
    padding: 28, 
    width: '92%', 
    maxWidth: 420, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 16, 
    elevation: 12 
  },
  header: { 
    marginBottom: 24 
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleContainer: {
    position: 'absolute',
    top: -2,
    left: 30,
  },
  titleContainer: {
    flex: 1,
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: isDark ? '#f9fafb' : '#111827' 
  },
  subMessage: {
    fontSize: 14,
    color: isDark ? '#d1d5db' : '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  progressInfo: {
    alignItems: 'flex-end',
  },
  percentage: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: isDark ? '#6ee7b7' : '#10b981' 
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  progressBar: {
    marginBottom: 28,
    height: 8,
    borderRadius: 4,
  },
  stepsContainer: { 
    gap: 16 
  },
  stepItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16,
    position: 'relative',
  },
  stepIconContainer: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: isDark ? '#374151' : '#f3f4f6' 
  },
  activeStepIcon: { 
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.15)',
    borderWidth: 2,
    borderColor: isDark ? '#6ee7b7' : '#10b981',
  },
  completedStepIcon: { 
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.15)' 
  },
  stepText: { 
    fontSize: 15, 
    color: isDark ? '#9ca3af' : '#6b7280',
    flex: 1,
  },
  activeStepText: { 
    color: isDark ? '#f9fafb' : '#111827', 
    fontWeight: '600' 
  },
  completedStepText: { 
    color: isDark ? '#6ee7b7' : '#10b981', 
    fontWeight: '500' 
  },
  activeIndicator: {
    position: 'absolute',
    right: 0,
    width: 4,
    height: 20,
    backgroundColor: isDark ? '#6ee7b7' : '#10b981',
    borderRadius: 2,
  },
  completionContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
  },
  completionMessage: { 
    textAlign: 'center', 
    fontSize: 15, 
    color: isDark ? '#6ee7b7' : '#10b981', 
    fontWeight: '600' 
  },
});

export default AnalyzingAnimation;
