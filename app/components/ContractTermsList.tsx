
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  ActivityIndicator, 
  StyleSheet, 
  Animated, 
  Alert 
} from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession, FrontendAnalysisTerm } from '../contexts/SessionContext';
import type { GenerateModifiedContractApiResponse, GenerateMarkedContractApiResponse, CloudinaryFileInfo } from '../services/api';
import * as apiService from '../services/api';
import ContractPreviewModal from './ContractPreviewModal';
import { 
  CheckCircle, 
  Send, 
  Loader, 
  ChevronDown, 
  AlertCircle,
  MessageSquare, 
  ThumbsUp, 
  Edit3, 
  XCircle, 
  FileWarning,
  FileCheck2, 
  FileTextIcon, 
  Info, 
  HelpCircle, 
  RefreshCw, 
  Sparkles,
  UserCheck as ExpertIcon, 
  Edit, 
  FileSearch, 
  Eye 
} from 'lucide-react-native';

interface ExpertFeedbackData {
  aiAnalysisApproved: boolean | null;
  expertIsValidSharia?: boolean;
  expertComment: string;
  expertCorrectedShariaIssue?: string;
  expertCorrectedReference?: string;
  expertCorrectedSuggestion?: string;
}

const GeneratingContractAnimation: React.FC<{progress: number, type?: 'modified' | 'marked'}> = ({progress, type = 'modified'}) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const title = type === 'marked' ? t('term.generatingMarkedContract') : t('term.generatingContract');
  const stages = [
    { name: t('generate.stage1'), threshold: 0 },
    { name: t('generate.stage2'), threshold: 30 },
    { name: t('generate.stage3'), threshold: 60 },
    { name: t('generate.stage4'), threshold: 90 },
  ];
  const currentStage = stages.slice().reverse().find(s => progress >= s.threshold) || stages[0];
  
  return (
    <View style={[styles.generatingModal, { backgroundColor: isDark ? '#1f2937' : '#ffffff' }]}>
      <View style={styles.generatingContent}>
        <View style={[styles.generatingIcon, { backgroundColor: isDark ? '#374151' : '#f3f4f6' }]}>
          <FileTextIcon size={32} color={isDark ? '#10b981' : '#059669'} />
        </View>
        <Text style={[styles.generatingTitle, { color: isDark ? '#f9fafb' : '#111827' }]}>{title}</Text>
        <Text style={[styles.generatingStage, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{currentStage.name}</Text>
        <View style={[styles.progressBar, { backgroundColor: isDark ? '#374151' : '#e5e7eb' }]}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>
    </View>
  );
};

const ContractTermsList: React.FC = () => {
  const { t, dir, isRTL } = useLanguage();
  const { theme } = useTheme();
  const {
    analysisTerms,
    isFetchingSession,
    isTermProcessing,
    isGeneratingContract,
    isGeneratingMarkedContract,
    isProcessingGeneralQuestion,
    isReviewingModification,
    error: sessionError,
    askQuestionAboutTerm,
    askGeneralContractQuestion,
    reviewUserModification,
    confirmTermModification,
    generateModifiedContract,
    generateMarkedContract,
    sessionId,
    sessionDetails,
    updateTermLocally,
    isAnalyzingContract,
    clearSession,
    currentUserRole,
    setPreviewLoading,
    updatePdfPreviewInfo,
  } = useSession();

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedTerms, setExpandedTerms] = useState<Record<string, boolean>>({});
  const [termQuestions, setTermQuestions] = useState<Record<string, string>>({});

  const [generationVisualProgress, setGenerationVisualProgress] = useState(0);
  const [generationType, setGenerationType] = useState<'modified' | 'marked' | null>(null);

  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [currentEditText, setCurrentEditText] = useState<string>("");
  const [askingQuestionForTermId, setAskingQuestionForTermId] = useState<string | null>(null);

  const [isGeneralQuestionModalOpen, setIsGeneralQuestionModalOpen] = useState(false);
  const [generalQuestionText, setGeneralQuestionText] = useState("");
  const [generalQuestionAnswerDisplay, setGeneralQuestionAnswerDisplay] = useState<string | null>(null);

  const [expertFeedbackTermId, setExpertFeedbackTermId] = useState<string | null>(null);
  const [currentExpertFeedback, setCurrentExpertFeedback] = useState<Partial<ExpertFeedbackData>>({});
  const [isSubmittingExpertFeedback, setIsSubmittingExpertFeedback] = useState<Record<string, boolean>>({});

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFileType, setPreviewFileType] = useState<'modified' | 'marked' | null>(null);

  useEffect(() => {
    if (sessionError) {
      Alert.alert(t('error.generic'), sessionError);
    }
  }, [sessionError, t]);

  const toggleTerm = useCallback((termId: string) => {
    setExpandedTerms(prev => {
      const isOpen = !!prev[termId];
      const newState: Record<string, boolean> = {};
      if (!isOpen) { newState[termId] = true; }
      return newState;
    });
  }, []);

  const handleQuestionChange = useCallback((termId: string, value: string) => {
    setTermQuestions(prev => ({ ...prev, [termId]: value }));
  }, []);

  const handleSendQuestion = useCallback(async (termId: string) => {
    const questionText = termQuestions[termId]?.trim();
    if (!questionText || (isTermProcessing && isTermProcessing[termId])) return;
    setAskingQuestionForTermId(termId);
    const answer = await askQuestionAboutTerm(termId, questionText);
    setAskingQuestionForTermId(null);
    if (answer) {
      Alert.alert(t('term.answerReceived'), t('term.answerReceivedMessage'));
    } else {
      Alert.alert(t('error.interactionFailed'));
    }
  }, [termQuestions, isTermProcessing, askQuestionAboutTerm, t]);

  const handleSendGeneralQuestion = useCallback(async () => {
    if (!generalQuestionText.trim()) return;
    setGeneralQuestionAnswerDisplay(null);
    const answer = await askGeneralContractQuestion(generalQuestionText.trim());
    if (answer) { 
      setGeneralQuestionAnswerDisplay(answer); 
    } else { 
      Alert.alert(t('error.interactionFailed')); 
    }
  }, [generalQuestionText, askGeneralContractQuestion, t]);

  const handleUseAnswerAsSuggestion = useCallback(async (term: FrontendAnalysisTerm) => {
    if (term.currentQaAnswer && term.term_text) {
      const success = await reviewUserModification(term.term_id, term.currentQaAnswer, term.term_text);
      if (success) {
        Alert.alert(t('review.suggestionReviewed'), t('review.suggestionReviewedDesc'));
        if (editingTermId === term.term_id) {
          const updatedTerm = analysisTerms?.find(t_ => t_.term_id === term.term_id);
          setCurrentEditText(updatedTerm?.userModifiedText || updatedTerm?.reviewedSuggestion || "");
        }
      } else {
        Alert.alert(t('review.reviewFailed'), t('review.reviewFailedDesc'));
      }
    }
  }, [reviewUserModification, editingTermId, analysisTerms, t]);

  const handleConfirmChanges = useCallback(async (term: FrontendAnalysisTerm) => {
    if ((isTermProcessing && isTermProcessing[term.term_id]) || (isReviewingModification && isReviewingModification[term.term_id])) return;
    const textToConfirm = term.userModifiedText ?? term.reviewedSuggestion ?? term.modified_term ?? term.term_text;
    const success = await confirmTermModification(term.term_id, textToConfirm);
    if (success) {
      Alert.alert(t('term.confirmed'), t('term.confirmedMessage'));
      setEditingTermId(null);
    } else {
      Alert.alert(t('error.confirmationFailed'));
    }
  }, [isTermProcessing, isReviewingModification, confirmTermModification, t]);

  const handleEditSuggestion = useCallback((term: FrontendAnalysisTerm) => {
    setEditingTermId(term.term_id);
    setCurrentEditText(
      (term.isUserConfirmed && term.userModifiedText) ? term.userModifiedText :
      term.userModifiedText ??
      term.reviewedSuggestion ??
      term.modified_term ??
      term.term_text
    );
  }, []);

  const handleSaveAndReviewEditedSuggestion = useCallback(async (termId: string) => {
    const term = analysisTerms?.find(t_ => t_.term_id === termId);
    if (!term || !currentEditText.trim()) return;
    const success = await reviewUserModification(termId, currentEditText, term.term_text);
    if (success) {
      setEditingTermId(null);
      Alert.alert(t('review.editSentForReview'), t('review.editSentForReviewDesc'));
    } else {
      Alert.alert(t('review.reviewFailed'), t('review.couldNotReviewEdit'));
    }
  }, [analysisTerms, currentEditText, reviewUserModification, t]);

  const handleStartNewAnalysis = useCallback(() => { 
    clearSession(); 
  }, [clearSession]);

  const runGenerationProcess = async (
    generatorFn: () => Promise<GenerateModifiedContractApiResponse | GenerateMarkedContractApiResponse | null>,
    type: 'modified' | 'marked'
  ) => {
    setGenerationVisualProgress(0);
    setGenerationType(type);

    const totalVisualDuration = 15 * 1000;
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += (100 / (totalVisualDuration / 100));
      if (currentProgress >= 99) {
        setGenerationVisualProgress(99);
        clearInterval(progressInterval);
      } else {
        setGenerationVisualProgress(currentProgress);
      }
    }, 100);

    const response = await generatorFn();
    clearInterval(progressInterval);
    setGenerationVisualProgress(100);

    if (response && response.success) {
      Alert.alert(
        type === 'modified' ? t('contract.generated') : t('contract.markedGenerated'),
        type === 'modified' ? t('contract.generatedMessage') : t('contract.markedGeneratedMessage')
      );
    } else {
      Alert.alert(
        t('error.generationFailed'),
        response?.message || (type === 'modified' ? "Could not generate the contract." : "Could not generate marked contract.")
      );
      setGenerationVisualProgress(0);
    }
    setTimeout(() => setGenerationType(null), 1500);
  };

  const handleGenerateContract = useCallback(() => {
    if (isGeneratingContract || isGeneratingMarkedContract) return;
    runGenerationProcess(generateModifiedContract, 'modified');
  }, [isGeneratingContract, isGeneratingMarkedContract, generateModifiedContract]);

  const handleGenerateMarkedContract = useCallback(() => {
    if (isGeneratingContract || isGeneratingMarkedContract) return;
    runGenerationProcess(generateMarkedContract, 'marked');
  }, [isGeneratingContract, isGeneratingMarkedContract, generateMarkedContract]);

  const openPreviewModalWithType = async (type: 'modified' | 'marked') => {
    setIsPreviewModalOpen(true);
    setPreviewFileType(type);
  };

  const filteredTerms = useMemo(() => {
    if (!analysisTerms) return [];
    
    return analysisTerms.filter(term => {
      if (activeFilter === 'all') return true;
      let isEffectivelyCompliant = term.is_valid_sharia;
      
      if (term.expert_override_is_valid_sharia !== null && term.expert_override_is_valid_sharia !== undefined) {
        isEffectivelyCompliant = term.expert_override_is_valid_sharia;
      } else if (term.isUserConfirmed) {
        isEffectivelyCompliant = term.isReviewedSuggestionValid !== null ? term.isReviewedSuggestionValid : true;
      } else if (term.isReviewedSuggestionValid !== null && term.isReviewedSuggestionValid !== undefined) {
        isEffectivelyCompliant = term.isReviewedSuggestionValid;
      }

      if (activeFilter === 'compliant') return isEffectivelyCompliant;
      if (activeFilter === 'non-compliant') return !isEffectivelyCompliant;
      return true;
    });
  }, [analysisTerms, activeFilter]);

  if ((isFetchingSession || isAnalyzingContract) && (!analysisTerms || analysisTerms.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={isDark ? '#10b981' : '#059669'} />
        <Text style={[styles.loadingText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{t('loading')}</Text>
      </View>
    );
  }
  
  if (!sessionId && !isAnalyzingContract) {
    return (
      <View style={styles.emptyContainer}>
        <FileTextIcon size={48} color={isDark ? '#9ca3af' : '#6b7280'} />
        <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{t('term.noSession')}</Text>
      </View>
    );
  }
  
  if (sessionId && analysisTerms === null && !isAnalyzingContract && !isFetchingSession) {
    return (
      <View style={styles.emptyContainer}>
        <FileWarning size={48} color="#f59e0b" />
        <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{sessionError || t('term.noResults')}</Text>
      </View>
    );
  }
  
  if (sessionId && Array.isArray(analysisTerms) && analysisTerms.length === 0 && !isAnalyzingContract && !isFetchingSession) {
    return (
      <View style={styles.emptyContainer}>
        <FileWarning size={48} color="#f59e0b" />
        <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{t('term.noTermsExtracted')}</Text>
      </View>
    );
  }
  
  if (!Array.isArray(analysisTerms) && !isAnalyzingContract && !isFetchingSession && sessionId) {
    console.error("ContractTermsList: analysisTerms is not an array and not loading.", analysisTerms);
    return (
      <View style={styles.emptyContainer}>
        <FileWarning size={48} color="#f59e0b" />
        <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>{t('error.generic')}</Text>
      </View>
    );
  }

  const renderTerm = (term: FrontendAnalysisTerm, index: number) => {
    let isEffectivelyCompliant = term.is_valid_sharia;
    if (term.expert_override_is_valid_sharia !== null && term.expert_override_is_valid_sharia !== undefined) {
      isEffectivelyCompliant = term.expert_override_is_valid_sharia;
    } else if (term.isUserConfirmed) {
      isEffectivelyCompliant = term.isReviewedSuggestionValid !== null ? term.isReviewedSuggestionValid : true;
    } else if (term.isReviewedSuggestionValid !== null && term.isReviewedSuggestionValid !== undefined) {
      isEffectivelyCompliant = term.isReviewedSuggestionValid;
    }

    const textInSuggestionOrEditBox =
      editingTermId === term.term_id
        ? currentEditText
        : term.userModifiedText ?? term.reviewedSuggestion ?? term.modified_term ?? "";

    const isExpanded = expandedTerms[term.term_id] || false;

    return (
      <View key={term.term_id} style={styles.termCard}>
        <TouchableOpacity
          style={styles.termHeader}
          onPress={() => toggleTerm(term.term_id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.termText, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={isExpanded ? undefined : 3}>
            {term.term_text}
          </Text>
          <View style={styles.termHeaderRight}>
            <View style={[
              styles.complianceTag,
              { backgroundColor: isEffectivelyCompliant ? '#10b981' : '#ef4444' }
            ]}>
              <Text style={styles.complianceTagText}>
                {isEffectivelyCompliant ? t('term.compliant') : t('term.non-compliant')}
              </Text>
            </View>
            <ChevronDown 
              size={20} 
              color={isDark ? '#9ca3af' : '#6b7280'} 
              style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.termContent}>
            <View style={styles.termDetails}>
              <Text style={styles.sectionTitle}>{t('term.fullText')}</Text>
              <Text style={[styles.fullText, { textAlign: isRTL ? 'right' : 'left' }]}>
                {term.term_text}
              </Text>

              {term.is_valid_sharia === false && !term.isUserConfirmed && term.sharia_issue && (
                <View style={styles.issueContainer}>
                  <View style={styles.issueHeader}>
                    <AlertCircle size={15} color="#dc2626" />
                    <Text style={styles.issueTitle}>{t('term.why')}</Text>
                  </View>
                  <Text style={[styles.issueText, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {term.sharia_issue}
                  </Text>
                </View>
              )}

              {term.reference_number && (
                <View style={[styles.referenceContainer, { 
                  backgroundColor: isEffectivelyCompliant ? '#dbeafe' : '#fef3c7',
                  borderLeftColor: isEffectivelyCompliant ? '#3b82f6' : '#f59e0b'
                }]}>
                  <View style={styles.referenceHeader}>
                    <Info size={15} color={isEffectivelyCompliant ? '#1d4ed8' : '#d97706'} />
                    <Text style={[styles.referenceTitle, { 
                      color: isEffectivelyCompliant ? '#1d4ed8' : '#d97706' 
                    }]}>
                      {t('term.reference')}
                    </Text>
                  </View>
                  <Text style={[styles.referenceText, { 
                    color: isEffectivelyCompliant ? '#1e40af' : '#b45309',
                    textAlign: isRTL ? 'right' : 'left'
                  }]}>
                    {term.reference_number}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.suggestionSection}>
              {editingTermId === term.term_id ? (
                <View style={styles.editContainer}>
                  <Text style={styles.sectionTitle}>{t('term.editSuggestion')}</Text>
                  <TextInput
                    style={[styles.editInput, { textAlign: isRTL ? 'right' : 'left' }]}
                    value={currentEditText}
                    onChangeText={setCurrentEditText}
                    multiline
                    placeholder={t('term.editSuggestion')}
                    placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setEditingTermId(null)}
                    >
                      <XCircle size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                      <Text style={styles.cancelButtonText}>{t('term.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => handleSaveAndReviewEditedSuggestion(term.term_id)}
                      disabled={isReviewingModification && isReviewingModification[term.term_id]}
                    >
                      {(isReviewingModification && isReviewingModification[term.term_id]) ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Sparkles size={16} color="#ffffff" />
                      )}
                      <Text style={styles.saveButtonText}>
                        {(isReviewingModification && isReviewingModification[term.term_id]) ? t('processing') : t('term.saveAndReview')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : term.isUserConfirmed && term.userModifiedText ? (
                <View style={styles.confirmedContainer}>
                  <Text style={styles.sectionTitle}>{t('term.confirmed')}</Text>
                  <View style={styles.confirmedTextContainer}>
                    <Text style={[styles.confirmedText, { textAlign: isRTL ? 'right' : 'left' }]}>
                      {term.userModifiedText}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editConfirmedButton}
                    onPress={() => handleEditSuggestion(term)}
                  >
                    <Edit3 size={14} color={isDark ? '#10b981' : '#059669'} />
                    <Text style={styles.editConfirmedButtonText}>{t('term.editConfirmed')}</Text>
                  </TouchableOpacity>
                </View>
              ) : textInSuggestionOrEditBox && (!term.is_valid_sharia || term.userModifiedText || term.reviewedSuggestion) ? (
                <View style={styles.suggestionContainer}>
                  <Text style={styles.sectionTitle}>{t('term.initialSuggestion')}</Text>
                  <View style={styles.suggestionTextContainer}>
                    <Text style={[styles.suggestionText, { textAlign: isRTL ? 'right' : 'left' }]}>
                      {textInSuggestionOrEditBox}
                    </Text>
                  </View>
                  <View style={styles.suggestionButtons}>
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={() => handleConfirmChanges(term)}
                      disabled={(isTermProcessing && isTermProcessing[term.term_id]) || (isReviewingModification && isReviewingModification[term.term_id])}
                    >
                      {(isTermProcessing && isTermProcessing[term.term_id]) ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <ThumbsUp size={16} color="#ffffff" />
                      )}
                      <Text style={styles.confirmButtonText}>
                        {(isTermProcessing && isTermProcessing[term.term_id]) ? t('processing') : t('button.confirm')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditSuggestion(term)}
                      disabled={(isTermProcessing && isTermProcessing[term.term_id]) || (isReviewingModification && isReviewingModification[term.term_id])}
                    >
                      <Edit3 size={16} color={isDark ? '#10b981' : '#059669'} />
                      <Text style={styles.editButtonText}>{t('term.editSuggestion')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : term.is_valid_sharia ? (
                <View style={styles.compliantContainer}>
                  <Text style={[styles.compliantText, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {t('term.alreadyCompliant')}
                  </Text>
                </View>
              ) : null}

              {!term.isUserConfirmed && (
                <View style={styles.questionSection}>
                  <TouchableOpacity
                    style={styles.questionToggle}
                    onPress={() => setAskingQuestionForTermId(askingQuestionForTermId === term.term_id ? null : term.term_id)}
                  >
                    <MessageSquare size={16} color="#3b82f6" />
                    <Text style={styles.questionToggleText}>{t('term.askQuestion')}</Text>
                    <ChevronDown 
                      size={16} 
                      color="#3b82f6" 
                      style={{ 
                        transform: [{ rotate: askingQuestionForTermId === term.term_id ? '180deg' : '0deg' }],
                        marginLeft: 'auto'
                      }}
                    />
                  </TouchableOpacity>

                  {askingQuestionForTermId === term.term_id && (
                    <View style={styles.questionInput}>
                      <TextInput
                        style={[styles.questionTextInput, { textAlign: isRTL ? 'right' : 'left' }]}
                        placeholder={t('term.questionPlaceholder')}
                        placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                        value={termQuestions[term.term_id] || ''}
                        onChangeText={(text) => handleQuestionChange(term.term_id, text)}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.sendButton}
                        onPress={() => handleSendQuestion(term.term_id)}
                        disabled={(isTermProcessing && isTermProcessing[term.term_id]) || !termQuestions[term.term_id]?.trim()}
                      >
                        {(isTermProcessing && isTermProcessing[term.term_id]) ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Send size={16} color="#ffffff" />
                        )}
                        <Text style={styles.sendButtonText}>{t('button.send')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Generation Animation Overlay */}
      {(isGeneratingContract || isGeneratingMarkedContract) && generationType && (
        <Modal transparent visible animationType="fade">
          <View style={styles.overlay}>
            <GeneratingContractAnimation progress={generationVisualProgress} type={generationType} />
          </View>
        </Modal>
      )}

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('contract.terms')}</Text>
          {sessionId && Array.isArray(analysisTerms) && analysisTerms.length > 0 && (
            <TouchableOpacity
              style={styles.generalQuestionButton}
              onPress={() => setIsGeneralQuestionModalOpen(true)}
            >
              <HelpCircle size={16} color={isDark ? '#10b981' : '#059669'} />
              <Text style={styles.generalQuestionButtonText}>{t('term.askGeneralQuestion')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {['all', 'compliant', 'non-compliant'].map(filterValue => (
            <TouchableOpacity
              key={filterValue}
              style={[
                styles.filterTab,
                activeFilter === filterValue && styles.filterTabActive
              ]}
              onPress={() => setActiveFilter(filterValue)}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === filterValue && styles.filterTabTextActive
              ]}>
                {t(`filter.${filterValue}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Terms List */}
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {Array.isArray(analysisTerms) && filteredTerms.length > 0 ? (
            <View style={styles.termsList}>
              {filteredTerms.map((term, index) => renderTerm(term, index))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                {t('term.noTermsForFilter')}
              </Text>
            </View>
          )}

          {/* Contract Generation Section */}
          {Array.isArray(analysisTerms) && analysisTerms.length > 0 && (
            <View style={styles.generationSection}>
              <Text style={styles.generationTitle}>{t('contract.reviewContract')}</Text>
              <Text style={styles.generationSubtitle}>{t('contract.generateInfo')}</Text>
              
              <View style={styles.generationButtons}>
                <TouchableOpacity
                  style={[styles.generateButton, styles.generateModifiedButton]}
                  onPress={handleGenerateContract}
                  disabled={isGeneratingContract || isGeneratingMarkedContract || isFetchingSession || isAnalyzingContract}
                >
                  {isGeneratingContract ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <FileCheck2 size={16} color="#ffffff" />
                  )}
                  <Text style={styles.generateButtonText}>
                    {isGeneratingContract ? t('processing') : t('contract.generateButton')}
                  </Text>
                </TouchableOpacity>

                {sessionDetails?.modified_contract_info?.docx_cloudinary_info?.url && !isGeneratingContract && (
                  <TouchableOpacity
                    style={styles.previewButton}
                    onPress={() => openPreviewModalWithType('modified')}
                  >
                    <Eye size={16} color={isDark ? '#10b981' : '#059669'} />
                    <Text style={styles.previewButtonText}>{t('contract.preview.modifiedTitle')}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.generateButton, styles.generateMarkedButton]}
                  onPress={handleGenerateMarkedContract}
                  disabled={isGeneratingContract || isGeneratingMarkedContract || isFetchingSession || isAnalyzingContract}
                >
                  {isGeneratingMarkedContract ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <FileSearch size={16} color="#ffffff" />
                  )}
                  <Text style={styles.generateButtonText}>
                    {isGeneratingMarkedContract ? t('processing') : t('contract.generateMarkedButton')}
                  </Text>
                </TouchableOpacity>

                {sessionDetails?.marked_contract_info?.docx_cloudinary_info?.url && !isGeneratingMarkedContract && (
                  <TouchableOpacity
                    style={styles.previewButton}
                    onPress={() => openPreviewModalWithType('marked')}
                  >
                    <Eye size={16} color="#3b82f6" />
                    <Text style={styles.previewButtonText}>{t('contract.preview.markedTitle')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {sessionId && (
                <TouchableOpacity
                  style={styles.newAnalysisButton}
                  onPress={handleStartNewAnalysis}
                >
                  <RefreshCw size={16} color="#ef4444" />
                  <Text style={styles.newAnalysisButtonText}>
                    {t('upload.newAnalysis') || "Start New Analysis"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* General Question Modal */}
      <Modal
        visible={isGeneralQuestionModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsGeneralQuestionModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('term.askGeneralQuestion')}</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setIsGeneralQuestionModalOpen(false);
                setGeneralQuestionText("");
                setGeneralQuestionAnswerDisplay(null);
              }}
            >
              <XCircle size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <TextInput
              style={[styles.generalQuestionInput, { textAlign: isRTL ? 'right' : 'left' }]}
              placeholder={t('term.generalQuestionPlaceholder')}
              placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
              value={generalQuestionText}
              onChangeText={setGeneralQuestionText}
              multiline
            />
            
            {isProcessingGeneralQuestion && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="small" color={isDark ? '#10b981' : '#059669'} />
                <Text style={styles.processingText}>{t('processing')}</Text>
              </View>
            )}
            
            {generalQuestionAnswerDisplay && !isProcessingGeneralQuestion && (
              <View style={styles.answerContainer}>
                <Text style={styles.answerTitle}>{t('term.answer')}</Text>
                <Text style={[styles.answerText, { textAlign: isRTL ? 'right' : 'left' }]}>
                  {generalQuestionAnswerDisplay}
                </Text>
              </View>
            )}
          </ScrollView>
          
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setIsGeneralQuestionModalOpen(false);
                setGeneralQuestionAnswerDisplay(null);
                setGeneralQuestionText("");
              }}
            >
              <Text style={styles.modalCancelButtonText}>{t('term.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSendButton}
              onPress={handleSendGeneralQuestion}
              disabled={isProcessingGeneralQuestion || !generalQuestionText.trim()}
            >
              {isProcessingGeneralQuestion ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Send size={16} color="#ffffff" />
              )}
              <Text style={styles.modalSendButtonText}>{t('button.send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contract Preview Modal */}
      <ContractPreviewModal
        isVisible={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setPreviewFileType(null);
        }}
        fileType={previewFileType}
      />
    </View>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#111827' : '#ffffff',
  },
  content: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatingModal: {
    borderRadius: 24,
    padding: 24,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  generatingContent: {
    alignItems: 'center',
  },
  generatingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  generatingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  generatingStage: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBar: {
    width: 200,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
    backgroundColor: isDark ? '#111827' : '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: isDark ? '#f9fafb' : '#111827',
  },
  generalQuestionButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? '#10b981' : '#059669',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  generalQuestionButtonText: {
    color: isDark ? '#10b981' : '#059669',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    borderRadius: 8,
    margin: 16,
    marginTop: 8,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: isDark ? '#9ca3af' : '#6b7280',
  },
  filterTabTextActive: {
    color: isDark ? '#f9fafb' : '#111827',
  },
  termsList: {
    padding: 16,
    paddingTop: 0,
    gap: 16,
  },
  termCard: {
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#374151' : '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 8,
  },
  termHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  termText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: isDark ? '#f9fafb' : '#111827',
    lineHeight: 24,
  },
  termHeaderRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  complianceTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  complianceTagText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  termContent: {
    borderTopWidth: 1,
    borderTopColor: isDark ? '#374151' : '#e5e7eb',
    padding: 16,
    gap: 16,
  },
  termDetails: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: isDark ? '#9ca3af' : '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullText: {
    fontSize: 16,
    color: isDark ? '#f9fafb' : '#111827',
    lineHeight: 24,
  },
  issueContainer: {
    backgroundColor: isDark ? '#7f1d1d' : '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    borderRadius: 8,
    padding: 14,
  },
  issueHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  issueTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? '#fca5a5' : '#dc2626',
  },
  issueText: {
    fontSize: 14,
    color: isDark ? '#fecaca' : '#b91c1c',
    lineHeight: 20,
  },
  referenceContainer: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 14,
  },
  referenceHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  referenceTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  referenceText: {
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionSection: {
    gap: 12,
  },
  editContainer: {
    gap: 8,
  },
  editInput: {
    backgroundColor: isDark ? '#374151' : '#f9fafb',
    borderWidth: 1,
    borderColor: isDark ? '#4b5563' : '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    color: isDark ? '#f9fafb' : '#111827',
  },
  editButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  cancelButtonText: {
    color: isDark ? '#9ca3af' : '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmedContainer: {
    gap: 8,
  },
  confirmedTextContainer: {
    backgroundColor: isDark ? '#064e3b' : '#d1fae5',
    borderWidth: 1,
    borderColor: isDark ? '#059669' : '#10b981',
    borderRadius: 8,
    padding: 14,
  },
  confirmedText: {
    fontSize: 16,
    color: isDark ? '#a7f3d0' : '#059669',
    lineHeight: 24,
    fontWeight: '500',
  },
  editConfirmedButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? '#10b981' : '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    alignSelf: 'flex-start',
  },
  editConfirmedButtonText: {
    color: isDark ? '#10b981' : '#059669',
    fontSize: 12,
    fontWeight: '500',
  },
  suggestionContainer: {
    gap: 8,
  },
  suggestionTextContainer: {
    backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
    borderWidth: 1,
    borderColor: isDark ? '#3b82f6' : '#60a5fa',
    borderRadius: 8,
    padding: 14,
  },
  suggestionText: {
    fontSize: 16,
    color: isDark ? '#93c5fd' : '#1e40af',
    lineHeight: 24,
  },
  suggestionButtons: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    gap: 8,
  },
  confirmButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? '#10b981' : '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  editButtonText: {
    color: isDark ? '#10b981' : '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  compliantContainer: {
    backgroundColor: isDark ? '#064e3b' : '#d1fae5',
    borderWidth: 1,
    borderColor: isDark ? '#059669' : '#10b981',
    borderRadius: 8,
    padding: 14,
  },
  compliantText: {
    fontSize: 16,
    color: isDark ? '#a7f3d0' : '#059669',
    lineHeight: 24,
  },
  questionSection: {
    borderTopWidth: 1,
    borderTopColor: isDark ? '#374151' : '#e5e7eb',
    paddingTop: 12,
    gap: 8,
  },
  questionToggle: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    gap: 8,
  },
  questionToggleText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  questionInput: {
    gap: 8,
    paddingLeft: isRTL ? 0 : 8,
    paddingRight: isRTL ? 8 : 0,
  },
  questionTextInput: {
    backgroundColor: isDark ? '#374151' : '#f9fafb',
    borderWidth: 1,
    borderColor: isDark ? '#4b5563' : '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    color: isDark ? '#f9fafb' : '#111827',
  },
  sendButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  generationSection: {
    borderTopWidth: 1,
    borderTopColor: isDark ? '#374151' : '#e5e7eb',
    padding: 16,
    margin: 16,
    marginBottom: 0,
    gap: 16,
  },
  generationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDark ? '#f9fafb' : '#111827',
  },
  generationSubtitle: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
    lineHeight: 20,
  },
  generationButtons: {
    gap: 12,
  },
  generateButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    justifyContent: 'center',
  },
  generateModifiedButton: {
    backgroundColor: '#10b981',
  },
  generateMarkedButton: {
    backgroundColor: '#3b82f6',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: isDark ? '#10b981' : '#059669',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    justifyContent: 'center',
  },
  previewButtonText: {
    color: isDark ? '#10b981' : '#059669',
    fontSize: 14,
    fontWeight: '600',
  },
  newAnalysisButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    justifyContent: 'center',
  },
  newAnalysisButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: isDark ? '#111827' : '#ffffff',
  },
  modalHeader: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#374151' : '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDark ? '#f9fafb' : '#111827',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  generalQuestionInput: {
    backgroundColor: isDark ? '#374151' : '#f9fafb',
    borderWidth: 1,
    borderColor: isDark ? '#4b5563' : '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    color: isDark ? '#f9fafb' : '#111827',
    marginBottom: 16,
  },
  processingContainer: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
  },
  answerContainer: {
    backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
  },
  answerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: isDark ? '#93c5fd' : '#1e40af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  answerText: {
    fontSize: 16,
    color: isDark ? '#93c5fd' : '#1e40af',
    lineHeight: 24,
  },
  modalFooter: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: isDark ? '#374151' : '#e5e7eb',
    gap: 12,
  },
  modalCancelButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  modalCancelButtonText: {
    color: isDark ? '#9ca3af' : '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  modalSendButton: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    gap: 6,
  },
  modalSendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContractTermsList;
