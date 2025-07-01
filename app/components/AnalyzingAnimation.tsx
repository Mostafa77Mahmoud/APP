
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  FileText, Search, Brain, CheckCircle, AlertTriangle, 
  Sparkles, Zap, Eye, Shield, BookOpen, Scale 
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AnalyzingAnimationProps {
  isVisible: boolean;
  progress?: number;
  duration?: number; // Duration in seconds (26-38 seconds range)
}

const AnalyzingAnimation: React.FC<AnalyzingAnimationProps> = ({ 
  isVisible, 
  progress: externalProgress,
  duration = 32 // Default 32 seconds
}) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;

  // State
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLive, setIsLive] = useState(false);

  // Analysis stages with enhanced descriptions
  const stages = [
    {
      title: t('analyzing.stage1'),
      description: t('analyzing.stage1.desc'),
      icon: FileText,
      color: '#3b82f6',
      duration: 0.15, // 15% of total time
    },
    {
      title: t('analyzing.stage2'),
      description: t('analyzing.stage2.desc'),
      icon: Search,
      color: '#8b5cf6',
      duration: 0.25, // 25% of total time
    },
    {
      title: t('analyzing.stage3'),
      description: t('analyzing.stage3.desc'),
      icon: Brain,
      color: '#10b981',
      duration: 0.35, // 35% of total time
    },
    {
      title: t('analyzing.stage4'),
      description: t('analyzing.stage4.desc'),
      icon: Shield,
      color: '#f59e0b',
      duration: 0.20, // 20% of total time
    },
    {
      title: t('analyzing.stage5'),
      description: t('analyzing.stage5.desc'),
      icon: CheckCircle,
      color: '#059669',
      duration: 0.05, // 5% of total time
    },
  ];

  const getCurrentStage = (progress: number) => {
    let cumulativeDuration = 0;
    for (let i = 0; i < stages.length; i++) {
      cumulativeDuration += stages[i].duration;
      if (progress <= cumulativeDuration * 100) {
        return i;
      }
    }
    return stages.length - 1;
  };

  useEffect(() => {
    if (isVisible) {
      // Entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous animations
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );

      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );

      // Particle animations
      const particleAnimations = particleAnims.map((anim, index) => 
        Animated.loop(
          Animated.timing(anim, {
            toValue: 1,
            duration: 2000 + index * 200,
            useNativeDriver: true,
          })
        )
      );

      rotateAnimation.start();
      pulseAnimation.start();
      floatAnimation.start();
      particleAnimations.forEach(anim => anim.start());

      // Progress simulation or use external progress
      if (externalProgress === undefined) {
        let progressValue = 0;
        const progressInterval = setInterval(() => {
          progressValue += (100 / (duration * 10)); // Update every 100ms
          if (progressValue >= 100) {
            progressValue = 100;
            setIsLive(true);
            clearInterval(progressInterval);
          }
          setProgress(progressValue);
          setCurrentStage(getCurrentStage(progressValue));
        }, 100);

        return () => {
          clearInterval(progressInterval);
          rotateAnimation.stop();
          pulseAnimation.stop();
          floatAnimation.stop();
          particleAnimations.forEach(anim => anim.stop());
        };
      } else {
        setProgress(externalProgress);
        setCurrentStage(getCurrentStage(externalProgress));
        if (externalProgress >= 100) {
          setIsLive(true);
        }
      }

      return () => {
        rotateAnimation.stop();
        pulseAnimation.stop();
        floatAnimation.stop();
        particleAnimations.forEach(anim => anim.stop());
      };
    } else {
      // Exit animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, externalProgress, duration]);

  const styles = getStyles(isDark, isRTL);

  if (!isVisible) return null;

  const currentStageData = stages[currentStage] || stages[0];
  const StageIcon = currentStageData.icon;

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const float = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 10],
  });

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Background particles */}
        <View style={styles.particlesContainer}>
          {particleAnims.map((anim, index) => {
            const opacity = anim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.3, 1, 0.3],
            });
            const translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -50],
            });
            return (
              <Animated.View
                key={index}
                style={[
                  styles.particle,
                  {
                    opacity,
                    transform: [{ translateY }],
                    left: `${15 + index * 12}%`,
                    backgroundColor: currentStageData.color,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Main icon container */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${currentStageData.color}20`,
              borderColor: `${currentStageData.color}40`,
              transform: [
                { scale: pulseAnim },
                { translateY: float },
              ],
            },
          ]}
        >
          <Animated.View
            style={{
              transform: [{ rotate }],
            }}
          >
            <StageIcon size={48} color={currentStageData.color} />
          </Animated.View>
          
          {/* Orbiting elements */}
          <Animated.View
            style={[
              styles.orbitingElement,
              {
                transform: [
                  { rotate },
                  { translateX: 40 },
                  { rotate: rotate },
                ],
              },
            ]}
          >
            <Sparkles size={16} color={currentStageData.color} />
          </Animated.View>
          
          <Animated.View
            style={[
              styles.orbitingElement,
              {
                transform: [
                  { rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['180deg', '540deg'],
                  }) },
                  { translateX: 35 },
                  { rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['180deg', '540deg'],
                  }) },
                ],
              },
            ]}
          >
            <Zap size={12} color={currentStageData.color} />
          </Animated.View>
        </Animated.View>

        {/* Main title */}
        <Text style={styles.title}>
          {t('analyzing.title')}
        </Text>

        {/* Current stage */}
        <Animated.View
          style={[
            styles.stageContainer,
            {
              transform: [{ translateY: float }],
            },
          ]}
        >
          <Text style={[styles.stageTitle, { color: currentStageData.color }]}>
            {currentStageData.title}
          </Text>
          <Text style={styles.stageDescription}>
            {currentStageData.description}
          </Text>
        </Animated.View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: currentStageData.color,
                },
              ]}
            />
          </View>
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressText}>
              {isLive ? t('analyzing.live') : `${Math.round(progress)}%`}
            </Text>
            {isLive && (
              <Animated.View
                style={[
                  styles.liveIndicator,
                  {
                    opacity: pulseAnim,
                  },
                ]}
              />
            )}
          </View>
        </View>

        {/* Stage indicators */}
        <View style={styles.stageIndicators}>
          {stages.map((stage, index) => (
            <Animated.View
              key={index}
              style={[
                styles.stageIndicator,
                {
                  backgroundColor: index <= currentStage ? stage.color : '#e5e7eb',
                  transform: [
                    {
                      scale: index === currentStage ? pulseAnim : 1,
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>

        {/* Additional info */}
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Shield size={16} color={isDark ? '#10b981' : '#059669'} />
            <Text style={styles.infoText}>{t('analyzing.shariaCompliant')}</Text>
          </View>
          <View style={styles.infoItem}>
            <BookOpen size={16} color={isDark ? '#3b82f6' : '#2563eb'} />
            <Text style={styles.infoText}>{t('analyzing.aiPowered')}</Text>
          </View>
          <View style={styles.infoItem}>
            <Scale size={16} color={isDark ? '#f59e0b' : '#d97706'} />
            <Text style={styles.infoText}>{t('analyzing.expertReviewed')}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    container: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      width: screenWidth * 0.9,
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.3,
      shadowRadius: 30,
      elevation: 15,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#e5e7eb',
    },
    particlesContainer: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
      borderRadius: 24,
    },
    particle: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 2,
      top: '80%',
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      borderWidth: 2,
      position: 'relative',
    },
    orbitingElement: {
      position: 'absolute',
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#f9fafb' : '#111827',
      textAlign: 'center',
      marginBottom: 20,
    },
    stageContainer: {
      alignItems: 'center',
      marginBottom: 24,
      minHeight: 60,
    },
    stageTitle: {
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
    },
    stageDescription: {
      fontSize: 14,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 16,
    },
    progressContainer: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 24,
    },
    progressTrack: {
      width: '100%',
      height: 8,
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 12,
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    progressTextContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    progressText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#d1d5db' : '#374151',
    },
    liveIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
    },
    stageIndicators: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    stageIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    infoContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
    },
    infoItem: {
      alignItems: 'center',
      flex: 1,
      gap: 4,
    },
    infoText: {
      fontSize: 10,
      color: isDark ? '#9ca3af' : '#6b7280',
      textAlign: 'center',
      fontWeight: '500',
    },
  });
};

export default AnalyzingAnimation;
