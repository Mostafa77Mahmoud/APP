// app/components/QuestionAnimation.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Brain, Loader } from 'lucide-react-native';

interface QuestionAnimationProps {
  isVisible: boolean;
}

export const QuestionAnimation: React.FC<QuestionAnimationProps> = ({ isVisible }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const styles = getStyles(isDark);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = [
    t('questionAnimation.thinking'),
    t('questionAnimation.processing'),
    t('questionAnimation.analyzing'),
    t('questionAnimation.formulating'),
  ];

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]).start();

      intervalId = setInterval(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
      }, 2500);

    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    return () => clearInterval(intervalId);
  }, [isVisible]);

  // Use a state to control rendering to avoid flicker and errors
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      // Wait for fade out animation to complete before unmounting
      const timeoutId = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.iconContainer}>
            <Brain size={48} color={isDark ? '#6ee7b7' : '#10b981'} />
            <View style={styles.loaderBadge}>
                <Loader size={16} color="#fff" />
            </View>
        </View>
        <Text style={styles.title}>{messages[messageIndex]}</Text>
        <Text style={styles.description}>{t('questionAnimation.patience')}</Text>
      </Animated.View>
    </View>
  );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  container: { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderRadius: 16, padding: 32, margin: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8, gap: 16 },
  iconContainer: {
    padding: 16,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
    borderRadius: 999,
    position: 'relative',
  },
  loaderBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: isDark ? '#10b981' : '#059669',
    borderRadius: 999,
    padding: 4,
    borderWidth: 2,
    borderColor: isDark ? '#1f2937' : '#ffffff',
  },
  title: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  description: { fontSize: 14, color: isDark ? '#d1d5db' : '#6b7280', textAlign: 'center' },
});

export default QuestionAnimation;
