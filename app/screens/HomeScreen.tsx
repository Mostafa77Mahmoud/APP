// app/screens/HomeScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getStats, getSessionHistory, getLocalSessions, SessionDetailsApiResponse } from '../services/api';
import { useContract } from '../contexts/ContractContext';
import { Camera, Upload, BarChart2, CheckSquare, FileText } from 'lucide-react-native';
import { ScreenType } from '../MobileApp';

interface HomeScreenProps {
  onNavigate: (screen: ScreenType, data?: any) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { user, isGuestMode } = useAuth();
  const { contracts, isLoading: contractsLoading } = useContract();
  
  const [timeOfDay, setTimeOfDay] = useState('');
  const [userStats, setUserStats] = useState<any>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<SessionDetailsApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      if (isGuestMode || contractsLoading) {
        // Use contracts from context for guest mode or while loading
        const totalAnalyses = contracts.length;
        const avgCompliance = contracts.length > 0 
          ? contracts.reduce((sum, contract) => sum + contract.complianceScore, 0) / contracts.length
          : 0;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const analysesThisMonth = contracts.filter(contract => {
          const contractDate = new Date(contract.analysisDate);
          return contractDate.getMonth() === currentMonth && contractDate.getFullYear() === currentYear;
        }).length;

        setUserStats({ 
          total_analyses: totalAnalyses, 
          compliance_rate: Math.round(avgCompliance), 
          analyses_this_month: analysesThisMonth 
        });

        // Convert contracts to session format for recent analyses
        const recentContractAnalyses = contracts
          .sort((a, b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime())
          .slice(0, 3)
          .map(contract => ({
            session_id: contract.sessionId,
            original_filename: contract.name,
            analysis_timestamp: contract.analysisDate,
            compliance_percentage: contract.complianceScore,
            analysis_results: []
          }));

        setRecentAnalyses(recentContractAnalyses);
      } else {
        const [stats, history] = await Promise.all([
          getStats().catch(() => ({ total_analyses: 0, compliance_rate: 0, analyses_this_month: 0 })),
          getSessionHistory().catch(() => [])
        ]);
        setUserStats(stats);
        setRecentAnalyses(history.slice(0, 3));
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // Fallback to contracts data
      const totalAnalyses = contracts.length;
      const avgCompliance = contracts.length > 0 
        ? contracts.reduce((sum, contract) => sum + contract.complianceScore, 0) / contracts.length
        : 0;
      setUserStats({ 
        total_analyses: totalAnalyses, 
        compliance_rate: Math.round(avgCompliance), 
        analyses_this_month: 0 
      });
    } finally {
      setLoading(false);
    }
  }, [isGuestMode, contracts, contractsLoading]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setTimeOfDay(t('home.goodMorning'));
    else if (hour < 17) setTimeOfDay(t('home.goodAfternoon'));
    else setTimeOfDay(t('home.goodEvening'));
    
    loadDashboardData();
  }, [loadDashboardData, t]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData().then(() => setRefreshing(false));
  }, [loadDashboardData]);

  const StatCard = ({ icon, value, label }: { icon: React.ReactNode, value: string, label: string }) => (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#fff' : '#000'} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingText}>{timeOfDay},</Text>
            <Text style={styles.userName}>
              {isGuestMode ? t('home.guestUser') : user?.username || user?.email?.split('@')[0]}
            </Text>
          </View>
          <TouchableOpacity style={styles.avatarButton} onPress={() => onNavigate('profile')}>
            <Text style={styles.avatarText}>
              {isGuestMode ? 'G' : (user?.username?.charAt(0) || 'U').toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actionCard, styles.primaryAction]} onPress={() => onNavigate('camera')}>
            <Camera size={28} color="#fff" />
            <Text style={styles.actionTitle}>{t('home.scanDocument')}</Text>
            <Text style={styles.actionSubtitle}>{t('home.useCamera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCard, styles.secondaryAction]} onPress={() => onNavigate('upload')}>
            <Upload size={28} color="#fff" />
            <Text style={styles.actionTitle}>{t('home.uploadFile')}</Text>
            <Text style={styles.actionSubtitle}>{t('home.fromDevice')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.analytics')}</Text>
          {loading ? (
            <ActivityIndicator color={isDark ? '#fff' : '#000'} />
          ) : (
            <View style={styles.statsGrid}>
              <StatCard icon={<FileText size={24} color={styles.statValue.color} />} value={userStats?.total_analyses?.toString() || '0'} label={t('home.totalAnalyses')} />
              <StatCard icon={<CheckSquare size={24} color={styles.statValue.color} />} value={`${Math.round(userStats?.compliance_rate || 0)}%`} label={t('home.complianceRate')} />
              <StatCard icon={<BarChart2 size={24} color={styles.statValue.color} />} value={userStats?.analyses_this_month?.toString() || '0'} label={t('home.thisMonth')} />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.recentAnalyses')}</Text>
            <TouchableOpacity onPress={() => onNavigate('history')}>
              <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={isDark ? '#fff' : '#000'} />
          ) : recentAnalyses.length > 0 ? (
            <View style={styles.recentList}>
              {recentAnalyses.map(analysis => (
                <TouchableOpacity key={analysis.session_id} style={styles.recentCard} onPress={() => onNavigate('results', { sessionId: analysis.session_id })}>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTitle} numberOfLines={1}>{analysis.original_filename}</Text>
                    <Text style={styles.recentDate}>{new Date(analysis.analysis_timestamp).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.recentCompliance}>{Math.round(analysis.compliance_percentage || 0)}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>{t('home.noAnalyses')}</Text>
              <Text style={styles.emptyStateSubtext}>{t('home.startFirst')}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greetingText: { fontSize: 24, color: isDark ? '#9ca3af' : '#6b7280' },
  userName: { fontSize: 28, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  avatarButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? '#374151' : '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  actionsGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 16, marginBottom: 24 },
  actionCard: { flex: 1, borderRadius: 16, padding: 20, height: 150, justifyContent: 'space-between' },
  primaryAction: { backgroundColor: '#10b981' },
  secondaryAction: { backgroundColor: '#3b82f6' },
  actionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  actionSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  viewAllText: { color: '#10b981', fontSize: 14, fontWeight: '600' },
  statsGrid: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: isDark ? '#1f2937' : '#ffffff', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  statLabel: { fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', textAlign: 'center' },
  recentList: { gap: 12 },
  recentCard: { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: isDark ? '#1f2937' : '#ffffff', padding: 16, borderRadius: 12, alignItems: 'center' },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 16, fontWeight: '600', color: isDark ? '#f9fafb' : '#111827' },
  recentDate: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 4 },
  recentCompliance: { fontSize: 16, fontWeight: 'bold', color: '#10b981' },
  emptyState: { alignItems: 'center', paddingVertical: 20, backgroundColor: isDark ? '#1f2937' : '#ffffff', borderRadius: 12 },
  emptyStateText: { fontSize: 16, fontWeight: '500', color: isDark ? '#d1d5db' : '#6b7280' },
  emptyStateSubtext: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 4 },
});

export default HomeScreen;