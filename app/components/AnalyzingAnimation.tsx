import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface AnalyzingAnimationProps {
  uploadProgress: number;
  isAnalyzing: boolean;
}

const AnalyzingAnimation: React.FC<AnalyzingAnimationProps> = ({ uploadProgress, isAnalyzing }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentStage, setCurrentStage] = useState(0);
  const [stageProgress, setStageProgress] = useState(new Animated.Value(0));

  const analysisStages = [
    { key: 'analyzing.uploading', duration: 2000 },
    { key: 'analyzing.extracting', duration: 3000 },
    { key: 'analyzing.identifying', duration: 4000 },
    { key: 'analyzing.generating', duration: 3000 },
    { key: 'analyzing.finalizing', duration: 2000 },
  ];

  useEffect(() => {
    if (!isAnalyzing) return;

    const animateStage = (stageIndex: number) => {
      if (stageIndex >= analysisStages.length) return;

      setCurrentStage(stageIndex);
      stageProgress.setValue(0);

      Animated.timing(stageProgress, {
        toValue: 1,
        duration: analysisStages[stageIndex].duration,
        useNativeDriver: false,
      }).start(() => {
        animateStage(stageIndex + 1);
      });
    };

    animateStage(0);
  }, [isAnalyzing]);

  const styles = getStyles(isDark, isRTL);

  const renderStatusBadges = () => (
    <View style={styles.statusBadges}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('analyzing.shariaCompliant')}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('analyzing.aiPowered')}</Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{t('analyzing.expertReviewed')}</Text>
      </View>
    </View>
  );

  if (!isAnalyzing && uploadProgress < 100) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('upload.uploading')}</Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            <Text style={styles.statusText}>{Math.round(uploadProgress)}%</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('analyzing.title')}</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('analyzing.live')}</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Animated.View 
            style={[
              styles.progressBar,
              {
                width: stageProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
          <Text style={styles.statusText}>
            {currentStage < analysisStages.length ? t(analysisStages[currentStage].key) : t('analyzing.finalizing')}
          </Text>
        </View>

        {renderStatusBadges()}
      </View>
    </View>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    content: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderRadius: 12,
      padding: 24,
      width: screenWidth * 0.8,
      maxWidth: 400,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: isDark ? '#f9fafb' : '#111827',
    },
    liveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ef4444',
      borderRadius: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
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
      fontWeight: 'bold',
    },
    progressContainer: {
      width: '100%',
      position: 'relative',
      marginVertical: 20,
    },
    progressBar: {
      height: 8,
      backgroundColor: '#10b981',
      borderRadius: 4,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#10b981' : '#059669',
      textAlign: 'center',
      marginTop: 12,
    },
    statusBadges: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 20,
    },
    badge: {
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
      borderRadius: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
      marginHorizontal: 4,
    },
    badgeText: {
      fontSize: 12,
      color: isDark ? '#9ca3af' : '#6b7280',
    },
  });

export default AnalyzingAnimation;