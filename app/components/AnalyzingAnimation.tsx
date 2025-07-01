import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { FileText, Search, CheckCircle, Sparkles, Loader, Eye, Brain } from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AnalyzingAnimationProps {
  isVisible: boolean;
  stage?: number;
  progress?: number;
}

const AnalyzingAnimation: React.FC<AnalyzingAnimationProps> = ({ 
  isVisible, 
  stage = 1, 
  progress = 0 
}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const isDark = theme === 'dark';

  useEffect(() => {
    if (isVisible) {
      // Entry animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
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
            toValue: 1.2,
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

      rotateAnimation.start();
      pulseAnimation.start();

      return () => {
        rotateAnimation.stop();
        pulseAnimation.stop();
      };
    } else {
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
  }, [isVisible]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const stages = [
    { 
      key: 'stage1', 
      icon: FileText, 
      color: '#3b82f6',
      title: t('analyzing.stage1'),
      desc: t('analyzing.stage1.desc')
    },
    { 
      key: 'stage2', 
      icon: Search, 
      color: '#8b5cf6',
      title: t('analyzing.stage2'),
      desc: t('analyzing.stage2.desc')
    },
    { 
      key: 'stage3', 
      icon: Brain, 
      color: '#10b981',
      title: t('analyzing.stage3'),
      desc: t('analyzing.stage3.desc')
    },
    { 
      key: 'stage4', 
      icon: CheckCircle, 
      color: '#059669',
      title: t('analyzing.stage4'),
      desc: t('analyzing.stage4.desc')
    },
    { 
      key: 'stage5', 
      icon: Sparkles, 
      color: '#f59e0b',
      title: t('analyzing.stage5'),
      desc: t('analyzing.stage5.desc')
    },
  ];

  const currentStage = stages[Math.min(stage - 1, stages.length - 1)];
  const StageIcon = currentStage.icon;

  if (!isVisible) return null;

  const styles = getStyles(isDark);

  return (
    <View style={styles.overlay}>
      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: slideAnim }
            ],
          }
        ]}
      >
        {/* Main Icon with Enhanced Animation */}
        <Animated.View 
          style={[
            styles.iconContainer,
            { 
              backgroundColor: `${currentStage.color}20`,
              borderColor: `${currentStage.color}40`,
              transform: [
                { rotate: spin },
                { scale: pulseAnim }
              ]
            }
          ]}
        >
          <StageIcon size={36} color={currentStage.color} />

          {/* Orbiting dots */}
          <Animated.View style={[styles.orbitingDot, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.dot, { backgroundColor: currentStage.color }]} />
          </Animated.View>
          <Animated.View style={[styles.orbitingDot2, { transform: [{ rotate: spin }] }]}>
            <View style={[styles.dot, { backgroundColor: currentStage.color }]} />
          </Animated.View>
        </Animated.View>

        {/* Live Indicator */}
        <View style={styles.liveContainer}>
          <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.liveText}>{t('analyzing.live')}</Text>
        </View>

        <Text style={styles.title}>{t('analyzing.title')}</Text>

        <Animated.Text 
          style={[
            styles.stageTitle, 
            { 
              color: currentStage.color,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {currentStage.title}
        </Animated.Text>

        <Text style={styles.stageDesc}>
          {currentStage.desc}
        </Text>

        {/* Enhanced Progress Bar */}
        {progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${progress}%`, 
                    backgroundColor: currentStage.color,
                    shadowColor: currentStage.color,
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: currentStage.color }]}>
              {Math.round(progress)}%
            </Text>
          </View>
        )}

        {/* Stage Indicators */}
        <View style={styles.stageIndicators}>
          {stages.map((stageItem, index) => (
            <Animated.View 
              key={stageItem.key}
              style={[
                styles.stageIndicator,
                { 
                  backgroundColor: index < stage ? stageItem.color : (isDark ? '#374151' : '#e5e7eb'),
                  transform: [{ scale: index === stage - 1 ? pulseAnim : 1 }]
                }
              ]} 
            />
          ))}
        </View>

        {/* Enhanced Badges */}
        <View style={styles.badgeContainer}>
          <Animated.View style={[styles.badge, { transform: [{ scale: pulseAnim }] }]}>
            <CheckCircle size={12} color="#ffffff" />
            <Text style={styles.badgeText}>{t('analyzing.shariaCompliant')}</Text>
          </Animated.View>
          <View style={styles.badge}>
            <Brain size={12} color="#ffffff" />
            <Text style={styles.badgeText}>{t('analyzing.aiPowered')}</Text>
          </View>
          <View style={styles.badge}>
            <Eye size={12} color="#ffffff" />
            <Text style={styles.badgeText}>{t('analyzing.expertReviewed')}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: screenWidth * 0.9,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 15,
    borderWidth: 1,
    borderColor: isDark ? '#374151' : '#e5e7eb',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    position: 'relative',
  },
  orbitingDot: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  orbitingDot2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ef4444',
    borderRadius: 15,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },
  liveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: isDark ? '#f9fafb' : '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  stageTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  stageDesc: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressBar: {
    width: '100%',
    height: 10,
    backgroundColor: isDark ? '#374151' : '#e5e7eb',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stageIndicators: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  stageIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: isDark ? '#10b981' : '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default AnalyzingAnimation;