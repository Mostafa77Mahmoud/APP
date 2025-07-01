import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession } from '../contexts/SessionContext';
import ComplianceBanner from '../components/ComplianceBanner';
import ContractTermsList from '../components/ContractTermsList';
import { Button } from '../components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { ScreenType } from '../MobileApp';

interface ResultsScreenProps {
  onNavigate: (screen: ScreenType, data?: any) => void;
  onBack: () => void;
}

const ResultsScreen: React.FC<ResultsScreenProps> = ({ onNavigate, onBack }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { 
    isFetchingSession, 
    isAnalyzingContract,
    generateModifiedContract,
    isGeneratingContract,
  } = useSession();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const handleGenerateContract = async () => {
    const result = await generateModifiedContract();
    if (result?.success) {
      Alert.alert(
        t('contract.generated'),
        t('contract.generatedMessage')
      );
    } else {
      Alert.alert(
        t('error.generationFailed'),
        result?.message || 'Could not generate the contract.'
      );
    }
  };

  if (isFetchingSession || isAnalyzingContract) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#10b981' : '#059669'} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          {isRTL ? <ArrowRight size={24} color={isDark ? '#fff' : '#000'} /> : <ArrowLeft size={24} color={isDark ? '#fff' : '#000'} />}
        </TouchableOpacity>
        <Text style={styles.title}>{t('results.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ComplianceBanner />
        
        <ContractTermsList />

        <View style={styles.actionsContainer}>
          <Button onPress={handleGenerateContract} disabled={isGeneratingContract} style={{ marginBottom: 12 }}>
            {isGeneratingContract ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('results.generateContract')}</Text>}
          </Button>
          <Button variant="outline" onPress={() => onNavigate('home')}>
            <Text style={[styles.buttonText, { color: isDark ? '#fff' : '#000' }]}>{t('results.newAnalysis')}</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#0a0a0a' : '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: isDark ? '#d1d5db' : '#6b7280',
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#27272a' : '#e5e7eb',
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: isDark ? '#f9fafb' : '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResultsScreen;