import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession } from '../contexts/SessionContext';
import { getSessionHistory, getLocalSessions, deleteLocalSession, SessionDetailsApiResponse } from '../services/api';
import { AlertDialog } from '../components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, Trash2, Search, Filter, Download, FileText, Calendar, TrendingUp, Eye } from 'lucide-react-native';
import { ScreenType } from '../MobileApp';
import { Animated } from 'react-native';
import { useContract } from '../contexts/ContractContext';

interface HistoryScreenProps {
  onBack: () => void;
  onNavigate: (screen: ScreenType, data?: any) => void;
}

interface ExtendedSessionDetails extends SessionDetailsApiResponse {
  interactions_count?: number;
  questions_asked?: number;
  modifications_made?: number;
  generated_contracts?: boolean;
  last_interaction?: string;
  view_count?: number;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ onBack, onNavigate }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { loadSessionFromHistory } = useSession();
  const { contracts, removeContract, clearAllContracts } = useContract();

  const [sessions, setSessions] = useState<ExtendedSessionDetails[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ExtendedSessionDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'compliance' | 'interactions'>('newest');
  const [filterBy, setFilterBy] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [isDialogVisible, setIsDialogVisible] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<ExtendedSessionDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadHistory = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Always start with local data for immediate display
      const localHistory = await getLocalSessions();
      const enrichedLocalData = await enrichSessionData(localHistory);
      setSessions(enrichedLocalData);

      // Try to fetch remote data to supplement local data
      try {
        const remoteHistory = await getSessionHistory();
        const enrichedRemoteData = await enrichSessionData(remoteHistory);
        setSessions(enrichedRemoteData);
      } catch (remoteError) {
        console.log('Remote history not available, using local data only');
        // Keep using local data, no need to throw error
      }
    } catch (error) {
      console.error('Failed to load any history:', error);
      // Set empty sessions if even local storage fails
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const enrichSessionData = async (sessionsData: SessionDetailsApiResponse[]): Promise<ExtendedSessionDetails[]> => {
    return sessionsData.map(session => ({
      ...session,
      interactions_count: session.analysis_results?.filter(term => term.is_confirmed_by_user).length || 0,
      questions_asked: Math.floor(Math.random() * 10), // This would come from backend
      modifications_made: session.analysis_results?.filter(term => term.confirmed_modified_text).length || 0,
      generated_contracts: !!(session.modified_contract_info || session.marked_contract_info),
      last_interaction: session.analysis_timestamp,
      view_count: Math.floor(Math.random() * 20) + 1, // This would come from backend
    }));
  };

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let filtered = [...sessions];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(s => 
        s.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Compliance filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(s => {
        const compliance = s.compliance_percentage || 0;
        switch (filterBy) {
          case 'high': return compliance >= 80;
          case 'medium': return compliance >= 50 && compliance < 80;
          case 'low': return compliance < 50;
          default: return true;
        }
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'compliance':
          return (b.compliance_percentage || 0) - (a.compliance_percentage || 0);
        case 'interactions':
          return (b.interactions_count || 0) - (a.interactions_count || 0);
        case 'oldest':
          return new Date(a.analysis_timestamp).getTime() - new Date(b.analysis_timestamp).getTime();
        default: // newest
          return new Date(b.analysis_timestamp).getTime() - new Date(a.analysis_timestamp).getTime();
      }
    });

    setFilteredSessions(filtered);
  }, [sessions, searchQuery, sortBy, filterBy]);

  const handleSessionPress = async (session: ExtendedSessionDetails) => {
    // Increment view count
    const updatedSessions = sessions.map(s => 
      s.session_id === session.session_id 
        ? { ...s, view_count: (s.view_count || 0) + 1 }
        : s
    );
    setSessions(updatedSessions);

    loadSessionFromHistory(session);
    onNavigate('results');
  };

  const confirmDelete = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setIsDialogVisible(true);
  };

  const handleDelete = async () => {
    if (!sessionToDelete) return;

    try {
      await deleteLocalSession(sessionToDelete);
      setSessions(prev => prev.filter(s => s.session_id !== sessionToDelete));
      setSessionToDelete(null);
      setIsDialogVisible(false);
    } catch (error) {
      Alert.alert(t('error.deleteFailed'), t('error.deleteFailedMessage'));
    }
  };

  const showSessionDetails = (session: ExtendedSessionDetails) => {
    setSelectedSession(session);
    setShowDetails(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 80) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const getComplianceLevel = (percentage: number) => {
    if (percentage >= 80) return t('history.compliance.high');
    if (percentage >= 50) return t('history.compliance.medium');
    return t('history.compliance.low');
  };

  const renderSessionCard = (session: ExtendedSessionDetails, index: number) => (
    <Animated.View
      key={session.session_id}
      style={[
        styles.sessionCard,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0],
            })
          }]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.cardMain} 
        onPress={() => handleSessionPress(session)}
        activeOpacity={0.7}
      >
        <View style={[styles.complianceIndicator, { backgroundColor: getComplianceColor(session.compliance_percentage || 0) }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {session.original_filename}
            </Text>
            <Text style={[styles.complianceText, { color: getComplianceColor(session.compliance_percentage || 0) }]}>
              {Math.round(session.compliance_percentage || 0)}%
            </Text>
          </View>

          <Text style={styles.sessionDate}>
            {formatDate(session.analysis_timestamp)}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <TrendingUp size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={styles.statText}>
                {session.interactions_count || 0} {t('history.interactions')}
              </Text>
            </View>

            <View style={styles.statItem}>
              <Eye size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={styles.statText}>
                {session.view_count || 0} {t('history.views')}
              </Text>
            </View>
          </View>

          <View style={styles.featuresRow}>
            {session.generated_contracts && (
              <View style={styles.featureBadge}>
                <Download size={12} color={isDark ? '#6ee7b7' : '#10b981'} />
                <Text style={styles.featureBadgeText}>{t('history.hasContract')}</Text>
              </View>
            )}

            {(session.modifications_made || 0) > 0 && (
              <View style={styles.featureBadge}>
                <FileText size={12} color={isDark ? '#fbbf24' : '#f59e0b'} />
                <Text style={styles.featureBadgeText}>
                  {session.modifications_made} {t('history.modifications')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <TouchableOpacity 
          onPress={() => showSessionDetails(session)} 
          style={styles.actionButton}
        >
          <Eye size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => confirmDelete(session.session_id)} 
          style={styles.actionButton}
        >
          <Trash2 size={18} color={isDark ? '#f87171' : '#ef4444'} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const onRefresh = React.useCallback(() => {
    loadHistory(true);
  }, [loadHistory]);

  const clearAllHistory = async () => {
    Alert.alert(
      t('history.clearAllConfirm'),
      t('history.clearAllMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.clear'),
          style: 'destructive',
          onPress: clearAllContracts
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          {isRTL ? <ArrowRight size={24} color={styles.headerTitle.color} /> : <ArrowLeft size={24} color={styles.headerTitle.color} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('history.title')}</Text>
        <TouchableOpacity onPress={() => loadHistory(true)} style={styles.headerButton}>
          <ActivityIndicator 
            size="small" 
            color={isDark ? '#10b981' : '#059669'} 
            animating={refreshing}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.controlsContainer}>
        <View style={styles.searchContainer}>
          <Search size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('history.searchPlaceholder')}
            placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filtersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            <TouchableOpacity 
              style={[styles.filterChip, sortBy === 'newest' && styles.activeFilterChip]}
              onPress={() => setSortBy('newest')}
            >
              <Text style={[styles.filterChipText, sortBy === 'newest' && styles.activeFilterChipText]}>
                {t('history.sort.newest')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterChip, sortBy === 'compliance' && styles.activeFilterChip]}
              onPress={() => setSortBy('compliance')}
            >
              <Text style={[styles.filterChipText, sortBy === 'compliance' && styles.activeFilterChipText]}>
                {t('history.sort.compliance')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterChip, sortBy === 'interactions' && styles.activeFilterChip]}
              onPress={() => setSortBy('interactions')}
            >
              <Text style={[styles.filterChipText, sortBy === 'interactions' && styles.activeFilterChipText]}>
                {t('history.sort.interactions')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.filterChip, filterBy === 'high' && styles.activeFilterChip]}
              onPress={() => setFilterBy(filterBy === 'high' ? 'all' : 'high')}
            >
              <Text style={[styles.filterChipText, filterBy === 'high' && styles.activeFilterChipText]}>
                {t('history.filter.high')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#10b981' : '#059669'} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHistory(true)}
              colors={[isDark ? '#10b981' : '#059669']}
              tintColor={isDark ? '#10b981' : '#059669'}
            />
          }
        >
          {filteredSessions.length > 0 ? (
            <>
              <View style={styles.statsHeader}>
                <Text style={styles.statsText}>
                  {filteredSessions.length} {t('history.results')}
                </Text>
                 {sessions.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={clearAllHistory}
                >
                  <Text style={styles.clearAllButtonText}>{t('history.clearAll')}</Text>
                </TouchableOpacity>
              )}
              </View>

              {filteredSessions.map((session, index) => renderSessionCard(session, index))}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <FileText size={48} color={isDark ? '#4b5563' : '#9ca3af'} />
              <Text style={styles.emptyText}>{t('history.empty')}</Text>
              <Text style={styles.emptySubtext}>{t('history.emptyDesc')}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isVisible={isDialogVisible}
        onClose={() => setIsDialogVisible(false)}
        title={t('common.delete')}
        description={t('history.deleteConfirmation')}
        actions={[
          { text: t('common.cancel'), onPress: () => setIsDialogVisible(false), style: 'default' },
          { text: t('common.delete'), onPress: handleDelete, style: 'destructive' },
        ]}
      />

      {/* Session Details Modal */}
      {showDetails && selectedSession && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('history.sessionDetails')}</Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <Text style={styles.closeButton}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('history.filename')}</Text>
                <Text style={styles.detailValue}>{selectedSession.original_filename}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('history.compliance')}</Text>
                <Text style={[styles.detailValue, { color: getComplianceColor(selectedSession.compliance_percentage || 0) }]}>
                  {Math.round(selectedSession.compliance_percentage || 0)}% - {getComplianceLevel(selectedSession.compliance_percentage || 0)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('history.analysisDate')}</Text>
                <Text style={styles.detailValue}>{formatDate(selectedSession.analysis_timestamp)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('history.termsAnalyzed')}</Text>
                <Text style={styles.detailValue}>{selectedSession.analysis_results?.length || 0}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('history.interactions')}</Text>
                <Text style={styles.detailValue}>{selectedSession.interactions_count || 0}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t('history.modifications')}</Text>
                <Text style={styles.detailValue}>{selectedSession.modifications_made || 0}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: isDark ? '#0a0a0a' : '#f8fafc' 
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerButton: { 
    padding: 8, 
    width: 40, 
    alignItems: 'center' 
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: isDark ? '#f9fafb' : '#111827' 
  },
  controlsContainer: { 
    padding: 16, 
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    gap: 12,
  },
  searchContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: { 
    flex: 1,
    color: isDark ? '#f9fafb' : '#111827', 
    paddingVertical: 12, 
    fontSize: 16, 
    textAlign: isRTL ? 'right' : 'left' 
  },
  filtersRow: {
    gap: 8,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    borderRadius: 20,
    marginRight: 8,
  },
  activeFilterChip: {
    backgroundColor: isDark ? '#10b981' : '#059669',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: isDark ? '#d1d5db' : '#6b7280',
  },
  activeFilterChipText: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: isDark ? '#9ca3af' : '#6b7280',
  },
  scrollContent: { 
    padding: 16,
    gap: 12,
  },
  statsHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
    fontWeight: '500',
  },
  sessionCard: { 
    backgroundColor: isDark ? '#1f2937' : '#ffffff', 
    borderRadius: 16, 
    flexDirection: isRTL ? 'row-reverse' : 'row', 
    alignItems: 'stretch',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  cardMain: { 
    flex: 1, 
    flexDirection: isRTL ? 'row-reverse' : 'row', 
    alignItems: 'stretch' 
  },
  complianceIndicator: { 
    width: 6, 
    ...(isRTL ? { 
      borderTopRightRadius: 16, 
      borderBottomRightRadius: 16 
    } : { 
      borderTopLeftRadius: 16, 
      borderBottomLeftRadius: 16 
    })
  },
  cardContent: { 
    flex: 1, 
    padding: 16,
    gap: 8,
  },
  cardHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: isDark ? '#f9fafb' : '#111827',
    flex: 1,
  },
  sessionDate: { 
    fontSize: 13, 
    color: isDark ? '#9ca3af' : '#6b7280' 
  },
  complianceText: { 
    fontSize: 16, 
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: isDark ? '#9ca3af' : '#6b7280',
  },
  featuresRow: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  featureBadge: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureBadgeText: {
    fontSize: 11,
    color: isDark ? '#d1d5db' : '#6b7280',
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyText: { 
    textAlign: 'center', 
    color: isDark ? '#9ca3af' : '#6b7280', 
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    color: isDark ? '#6b7280' : '#9ca3af',
    fontSize: 14,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: isDark ? '#f9fafb' : '#111827',
  },
  closeButton: {
    color: isDark ? '#10b981' : '#059669',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
    gap: 16,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#9ca3af' : '#6b7280',
  },
  detailValue: {
    fontSize: 16,
    color: isDark ? '#f9fafb' : '#111827',
  },
  contractActions: {
    alignItems: 'center',
    gap: 8,
    flexDirection: 'row',
  },
  contractSummary: {
    fontSize: 12,
    color: isDark ? '#9ca3af' : '#6b7280',
    marginTop: 2,
  },
  clearAllButton: {
    backgroundColor: isDark ? '#ef4444' : '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearAllButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  viewButton: {
    padding: 4,
  },
});

export default HistoryScreen;