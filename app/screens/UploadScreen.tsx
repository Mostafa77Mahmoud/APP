// app/screens/UploadScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession } from '../contexts/SessionContext';
import UploadArea from '../components/UploadArea';
import AnalyzingAnimation from '../components/AnalyzingAnimation'; // Import the animation
import { ArrowLeft, ArrowRight } from 'lucide-react-native';

interface UploadScreenProps {
  onAnalysisComplete: (sessionId: string) => void;
  onBack: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ onAnalysisComplete, onBack }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { isAnalyzingContract } = useSession(); // Get the analysis state
  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          {isRTL ? <ArrowRight size={24} color={styles.headerTitle.color} /> : <ArrowLeft size={24} color={styles.headerTitle.color} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('upload.title')}</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <UploadArea onAnalysisComplete={onAnalysisComplete} />
      </ScrollView>

      {/* --- MODIFICATION START --- */}
      {/* Show the AnalyzingAnimation as a full-screen overlay */}
      {isAnalyzingContract && <AnalyzingAnimation isAnalyzing={isAnalyzingContract} />}
      {/* --- MODIFICATION END --- */}

    </SafeAreaView>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#0a0a0a' : '#f8fafc',
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#27272a' : '#e5e7eb',
  },
  headerButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDark ? '#f9fafb' : '#111827',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

export default UploadScreen;
