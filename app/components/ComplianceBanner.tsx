import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react-native';
import { Progress } from './ui/progress';

const ComplianceBanner: React.FC = () => {
  const { t } = useLanguage();
  const { complianceStats } = useSession();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const styles = getStyles(isDark);

  if (!complianceStats) {
    return (
      <View style={styles.loadingContainer}>
        <View style={[styles.loadingBar, { width: '75%' }]} />
        <View style={[styles.loadingBar, { width: '50%', marginTop: 8 }]} />
        <View style={styles.loadingStatsContainer}>
          <View style={styles.loadingStatBox} />
          <View style={styles.loadingStatBox} />
        </View>
        <View style={[styles.loadingBar, { height: 12, marginTop: 16 }]} />
      </View>
    );
  }

  const {
    currentUserEffectiveCompliantCount,
    currentUserEffectiveNonCompliantCount,
    overallCompliancePercentage
  } = complianceStats;

  const getComplianceColors = () => {
    if (overallCompliancePercentage >= 80) return {
      bg: isDark ? 'rgba(16, 185, 129, 0.1)' : '#dcfce7',
      border: isDark ? 'rgba(16, 185, 129, 0.3)' : '#86efac',
      text: isDark ? '#6ee7b7' : '#15803d',
      iconBg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#a7f3d0',
      progressFill: isDark ? '#34d399' : '#10b981',
    };
    if (overallCompliancePercentage >= 50) return {
      bg: isDark ? 'rgba(245, 158, 11, 0.1)' : '#fef3c7',
      border: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
      text: isDark ? '#fcd34d' : '#b45309',
      iconBg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#fef9c3',
      progressFill: isDark ? '#f59e0b' : '#f59e0b',
    };
    return {
      bg: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2',
      border: isDark ? 'rgba(239, 68, 68, 0.3)' : '#fecaca',
      text: isDark ? '#fca5a5' : '#b91c1c',
      iconBg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
      progressFill: isDark ? '#ef4444' : '#ef4444',
    };
  };

  const colors = getComplianceColors();
  const ComplianceIcon = overallCompliancePercentage >= 80 ? CheckCircle : 
                         overallCompliancePercentage >= 50 ? Info : AlertTriangle;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
          <ComplianceIcon color={colors.text} size={24} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {overallCompliancePercentage >= 100 ? t('compliance.full') : 
           overallCompliancePercentage >= 50 ? t('compliance.partial') : 
           t('compliance.non')}
        </Text>
      </View>

      <Text style={styles.description}>{t('compliance.terms')}</Text>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: isDark ? '#6ee7b7' : '#15803d' }]}>{currentUserEffectiveCompliantCount}</Text>
          <Text style={styles.statLabel}>{t('compliance.compliantTerms')}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: isDark ? '#fca5a5' : '#b91c1c' }]}>{currentUserEffectiveNonCompliantCount}</Text>
          <Text style={styles.statLabel}>{t('compliance.nonCompliantTerms')}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <Progress value={overallCompliancePercentage} indicatorStyle={{ backgroundColor: colors.progressFill }} />
        <Text style={[styles.progressText, { color: colors.text }]}>
          {overallCompliancePercentage.toFixed(0)}%
        </Text>
      </View>
    </View>
  );
};

const getStyles = (isDark: boolean) => StyleSheet.create({
  loadingContainer: { backgroundColor: isDark ? '#1f2937' : '#f9fafb', borderRadius: 12, padding: 20, marginHorizontal: 16, marginVertical: 16, borderWidth: 1, borderColor: isDark ? '#374151' : '#e5e7eb' },
  loadingBar: { height: 16, backgroundColor: isDark ? '#374151' : '#e5e7eb', borderRadius: 8 },
  loadingStatsContainer: { flexDirection: 'row', gap: 16, marginTop: 16 },
  loadingStatBox: { flex: 1, height: 60, backgroundColor: isDark ? '#374151' : '#e5e7eb', borderRadius: 8 },
  container: { borderRadius: 12, padding: 20, marginHorizontal: 16, marginVertical: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  title: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  description: { fontSize: 14, color: isDark ? '#d1d5db' : '#6b7280', marginBottom: 16, lineHeight: 20 },
  statsContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.7)', padding: 12, borderRadius: 8, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', textAlign: 'center', marginTop: 4 },
  progressContainer: { marginTop: 8 },
  progressText: { textAlign: 'right', fontSize: 14, fontWeight: 'bold', marginTop: 6 },
});

export default ComplianceBanner;