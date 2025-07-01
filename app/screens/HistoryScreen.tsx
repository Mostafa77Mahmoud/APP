// app/screens/HistoryScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession } from '../contexts/SessionContext';
import { getSessionHistory, getLocalSessions, deleteLocalSession, SessionDetailsApiResponse } from '../services/api'; // Corrected import
import { AlertDialog } from '../components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react-native';
import { ScreenType } from '../MobileApp';

interface HistoryScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenType, data?: any) => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack, onNavigate }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { loadSessionFromHistory } = useSession();
  
  const [sessions, setSessions] = useState<SessionDetailsApiResponse[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionDetailsApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'compliance'>('newest');
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const historyData = await getSessionHistory();
      setSessions(historyData);
    } catch (error) {
      console.error('Failed to load history:', error);
      const localHistory = await getLocalSessions();
      setSessions(localHistory);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let filtered = [...sessions];
    if (searchQuery.trim()) {
      filtered = filtered.filter(s => s.original_filename.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    filtered.sort((a, b) => {
      if (sortBy === 'compliance') {
        return (b.compliance_percentage || 0) - (a.compliance_percentage || 0);
      }
      return sortBy === 'newest'
        ? new Date(b.analysis_timestamp).getTime() - new Date(a.analysis_timestamp).getTime()
        : new Date(a.analysis_timestamp).getTime() - new Date(b.analysis_timestamp).getTime();
    });
    setFilteredSessions(filtered);
  }, [sessions, searchQuery, sortBy]);

  const handleSessionPress = (session: SessionDetailsApiResponse) => {
    loadSessionFromHistory(session);
    onNavigate('results');
  };

  const confirmDelete = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setIsDialogVisible(true);
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;
    await deleteLocalSession(sessionToDelete);
    setSessions(prev => prev.filter(s => s.session_id !== sessionToDelete));
    setSessionToDelete(null);
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  
  const getComplianceColor = (percentage: number) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          {isRTL ? <ArrowRight size={24} color={styles.headerTitle.color} /> : <ArrowLeft size={24} color={styles.headerTitle.color} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history.title')}</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.controlsContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('history.searchPlaceholder')}
          placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color={isDark ? '#10b981' : '#059669'} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {filteredSessions.length > 0 ? filteredSessions.map(session => (
            <TouchableOpacity key={session.session_id} style={styles.sessionCard} onPress={() => handleSessionPress(session)}>
              <View style={styles.cardMain}>
                <View style={[styles.complianceIndicator, { backgroundColor: getComplianceColor(session.compliance_percentage || 0) }]} />
                <View style={styles.cardText}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{session.original_filename}</Text>
                  <Text style={styles.sessionDate}>{formatDate(session.analysis_timestamp)}</Text>
                </View>
                <Text style={[styles.complianceText, { color: getComplianceColor(session.compliance_percentage || 0) }]}>
                  {Math.round(session.compliance_percentage || 0)}%
                </Text>
              </View>
              <TouchableOpacity onPress={() => confirmDelete(session.session_id)} style={styles.deleteButton}>
                <Trash2 size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            </TouchableOpacity>
          )) : (
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          )}
        </ScrollView>
      )}

      <AlertDialog
        isVisible={isDialogVisible}
        onClose={() => setIsDialogVisible(false)}
        title={t('common.delete')}
        description="Are you sure you want to delete this analysis? This action cannot be undone."
        actions={[
          { text: t('common.cancel'), onPress: () => {}, style: 'default' },
          { text: t('common.delete'), onPress: handleDelete, style: 'destructive' },
        ]}
      />
    </SafeAreaView>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: isDark ? '#1f2937' : '#ffffff', borderBottomWidth: 1, borderBottomColor: isDark ? '#27272a' : '#e5e7eb' },
  headerButton: { padding: 8, width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  controlsContainer: { padding: 16, backgroundColor: isDark ? '#1f2937' : '#ffffff' },
  searchInput: { backgroundColor: isDark ? '#374151' : '#f3f4f6', color: isDark ? '#f9fafb' : '#111827', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, textAlign: isRTL ? 'right' : 'left' },
  scrollContent: { padding: 16 },
  sessionCard: { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderRadius: 12, marginBottom: 12, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMain: { flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' },
  complianceIndicator: { width: 6, height: '100%', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, ...(isRTL && { borderTopRightRadius: 12, borderBottomRightRadius: 12, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }) },
  cardText: { flex: 1, padding: 16 },
  sessionTitle: { fontSize: 16, fontWeight: '600', color: isDark ? '#f9fafb' : '#111827', marginBottom: 4 },
  sessionDate: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280' },
  complianceText: { fontSize: 16, fontWeight: 'bold', paddingHorizontal: 16 },
  deleteButton: { padding: 16 },
  emptyText: { textAlign: 'center', color: isDark ? '#9ca3af' : '#6b7280', marginTop: 50, fontSize: 16 },
});

export default HistoryScreen;