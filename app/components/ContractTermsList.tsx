
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal, Animated, Dimensions } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession, FrontendAnalysisTerm } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  CheckCircle, AlertCircle, ChevronDown, MessageSquare, ThumbsUp, Edit3, Send, 
  Sparkles, XCircle, FileCheck2, FileSearch, Eye, HelpCircle, RefreshCw, 
  UserCheck as ExpertIcon, FileText, Users, User, Loader2, Play, Pause, Info 
} from 'lucide-react-native';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Tabs } from './ui/tabs';
import QuestionAnimation from './QuestionAnimation';
import ContractPreviewModal from './ContractPreviewModal';
import { Progress } from './ui/progress';
import * as apiService from '../services/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced Radio Group component with animations
const RadioGroup = ({ options, selectedValue, onValueChange, isRTL, styles }: { 
  options: {label: string, value: string}[], 
  selectedValue: string, 
  onValueChange: (value: string) => void, 
  isRTL: boolean, 
  styles: any 
}) => {
  return (
    <View style={[styles.radioContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {options.map(option => {
        const isSelected = selectedValue === option.value;
        return (
          <TouchableOpacity 
            key={option.value} 
            onPress={() => onValueChange(option.value)} 
            style={[styles.radioOption, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            activeOpacity={0.7}
          >
            <Animated.View style={[
              styles.radioOuter, 
              isSelected && styles.radioOuterSelected
            ]}>
              {isSelected && (
                <Animated.View style={[styles.radioInner]} />
              )}
            </Animated.View>
            <Text style={[styles.radioLabel, isSelected && styles.radioLabelSelected]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Enhanced Generating Contract Animation with better animations
const GeneratingContractAnimation: React.FC<{
  progress: number, 
  type?: 'modified' | 'marked', 
  styles: any,
  isDark: boolean
}> = ({ progress, type = 'modified', styles, isDark }) => {
  const { t } = useLanguage();
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.8)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  const title = type === 'marked' ? t('term.generatingMarkedContract') : t('term.generatingContract');

  const stages = [
    { nameKey: 'generate.stage1', icon: FileText, threshold: 0, color: '#3b82f6' },
    { nameKey: 'generate.stage2', icon: Edit3, threshold: 30, color: '#8b5cf6' },
    { nameKey: 'generate.stage3', icon: FileCheck2, threshold: 60, color: '#10b981' },
    { nameKey: 'generate.stage4', icon: Sparkles, threshold: 90, color: '#f59e0b' },
  ];

  const currentStage = stages.slice().reverse().find(s => progress >= s.threshold) || stages[0];
  const StageIcon = currentStage.icon;

  useEffect(() => {
    // Continuous rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    // Scale animation for entrance
    const scaleAnimation = Animated.spring(scaleValue, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    });

    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    rotateAnimation.start();
    scaleAnimation.start();
    pulseAnimation.start();

    return () => {
      rotateAnimation.stop();
      scaleAnimation.stop();
      pulseAnimation.stop();
    };
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.animationOverlay}>
      <Animated.View style={[
        styles.animationContainer,
        { transform: [{ scale: scaleValue }] }
      ]}>
        <Animated.View style={[
          styles.stageIconContainer,
          { 
            backgroundColor: `${currentStage.color}20`,
            transform: [{ scale: pulseValue }]
          }
        ]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <StageIcon size={32} color={currentStage.color} />
          </Animated.View>
        </Animated.View>

        <Text style={styles.animationTitle}>{title}</Text>
        <Text style={[styles.stageText, { color: currentStage.color }]}>
          {t(currentStage.nameKey)}
        </Text>

        <View style={styles.progressContainer}>
          <Progress value={progress} style={styles.progressBar} />
          <Text style={styles.animationPercentage}>{Math.round(progress)}%</Text>
        </View>

        {/* Stage indicators */}
        <View style={styles.stageIndicators}>
          {stages.map((stage, index) => (
            <View 
              key={index} 
              style={[
                styles.stageIndicator,
                { 
                  backgroundColor: progress >= stage.threshold ? stage.color : '#e5e7eb',
                  opacity: progress >= stage.threshold ? 1 : 0.3
                }
              ]} 
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

interface ExpertFeedbackData {
  aiAnalysisApproved: boolean | null;
  expertIsValidSharia?: boolean;
  expertComment: string;
  expertCorrectedShariaIssue?: string;
  expertCorrectedReference?: string;
  expertCorrectedSuggestion?: string;
}

const ContractTermsList: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const {
    analysisTerms, isFetchingSession, isTermProcessing, isReviewingModification,
    askQuestionAboutTerm, reviewUserModification, confirmTermModification,
    generateModifiedContract, generateMarkedContract, isGeneratingContract, isGeneratingMarkedContract,
    sessionId, sessionDetails, updateTermLocally, clearSession, currentUserRole,
    askGeneralContractQuestion, isProcessingGeneralQuestion, error: sessionError,
    isAnalyzingContract, setPreviewLoading, updatePdfPreviewInfo
  } = useSession();

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedTerms, setExpandedTerms] = useState<Record<string, boolean>>({});
  const [termQuestions, setTermQuestions] = useState<Record<string, string>>({});

  const [generationVisualProgress, setGenerationVisualProgress] = useState(0);
  const [generationType, setGenerationType] = useState<'modified' | 'marked' | null>(null);

  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [currentEditText, setCurrentEditText] = useState<string>("");
  const [askingQuestionForTermId, setAskingQuestionForTermId] = useState<string | null>(null);

  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [previewFileType, setPreviewFileType] = useState<'modified' | 'marked' | null>(null);
  const [previewFileUrl, setPreviewFileUrl] = useState<string | null>(null);
  const [previewPdfDownloadFilename, setPreviewPdfDownloadFilename] = useState<string | undefined>(undefined);

  const [isGeneralQuestionModalVisible, setIsGeneralQuestionModalVisible] = useState(false);
  const [generalQuestionText, setGeneralQuestionText] = useState("");
  const [generalQuestionAnswer, setGeneralQuestionAnswer] = useState<string | null>(null);

  const [expertFeedbackTermId, setExpertFeedbackTermId] = useState<string | null>(null);
  const [currentExpertFeedback, setCurrentExpertFeedback] = useState<Partial<ExpertFeedbackData>>({});
  const [isSubmittingExpertFeedback, setIsSubmittingExpertFeedback] = useState<Record<string, boolean>>({});

  const isDark = theme === 'dark';
  const styles = useMemo(() => getStyles(isDark, isRTL), [isDark, isRTL]);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (sessionError) {
      Alert.alert(t('error.generic'), sessionError);
    }
  }, [sessionError, t]);

  useEffect(() => {
    if (analysisTerms && analysisTerms.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [analysisTerms]);

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
    setTermQuestions(prev => ({ ...prev, [termId]: '' }));
  }, [termQuestions, isTermProcessing, askQuestionAboutTerm, t]);

  const handleSendGeneralQuestion = useCallback(async () => {
    if (!generalQuestionText.trim()) return;
    setGeneralQuestionAnswer(null);
    const answer = await askGeneralContractQuestion(generalQuestionText.trim());
    if (answer) {
      setGeneralQuestionAnswer(answer);
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
  }, [reviewUserModification, t, editingTermId, analysisTerms]);

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

  const handleSaveAndReview = useCallback(async (termId: string) => {
    const term = analysisTerms?.find(t => t.term_id === termId);
    if (!term || !currentEditText.trim()) return;
    const success = await reviewUserModification(termId, currentEditText, term.term_text);
    if (success) {
      setEditingTermId(null);
      Alert.alert(t('review.editSentForReview'), t('review.editSentForReviewDesc'));
    } else {
      Alert.alert(t('review.reviewFailed'), t('review.couldNotReviewEdit'));
    }
  }, [analysisTerms, currentEditText, reviewUserModification, t]);

  const runGenerationProcess = async (
    generatorFn: () => Promise<any>,
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
        t(type === 'modified' ? 'contract.generated' : 'contract.markedGenerated'),
        t(type === 'modified' ? 'contract.generatedMessage' : 'contract.markedGeneratedMessage')
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
    if (!sessionId || !sessionDetails) return;
    const previewKey = `${sessionId}-${type}-preview`;
    setPreviewLoading(previewKey, true);
    setIsPreviewModalVisible(true);
    setPreviewFileType(type);

    const originalBaseName = sessionDetails.original_filename?.replace(/\.[^/.]+$/, "") || "contract";
    let pdfFileNameForDownload = `${type === 'modified' ? 'Modified' : 'Marked'}_${originalBaseName}.pdf`;

    if (type === 'modified' && sessionDetails.pdf_preview_info?.modified?.user_facing_filename) {
        pdfFileNameForDownload = sessionDetails.pdf_preview_info.modified.user_facing_filename;
    } else if (type === 'marked' && sessionDetails.pdf_preview_info?.marked?.user_facing_filename) {
        pdfFileNameForDownload = sessionDetails.pdf_preview_info.marked.user_facing_filename;
    }
    setPreviewPdfDownloadFilename(pdfFileNameForDownload);

    const existingCloudinaryPdfInfo = sessionDetails.pdf_preview_info?.[type];
    if (existingCloudinaryPdfInfo?.url) {
        setPreviewFileUrl(existingCloudinaryPdfInfo.url);
        setPreviewLoading(previewKey, false);
        return;
    }

    try {
        const backendUrl = apiService.getContractPreviewUrl(sessionId, type);
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Failed to fetch preview PDF URL."}));
            throw new Error(errorData.error || `Failed to load preview URL (${response.status})`);
        }
        const data: { pdf_url?: string; error?: string } = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        if (data.pdf_url) {
            setPreviewFileUrl(data.pdf_url);
            const pdfCloudinaryInfo = {
                url: data.pdf_url,
                public_id: '',
                format: 'pdf',
                user_facing_filename: pdfFileNameForDownload
            };
            updatePdfPreviewInfo(type, pdfCloudinaryInfo);
        } else {
            throw new Error("PDF URL not found in server response.");
        }
    } catch (error: any) {
        console.error("Error fetching preview:", error);
        Alert.alert("Preview Error", error.message || "Could not load contract preview.");
        setPreviewFileUrl(null);
    } finally {
        setPreviewLoading(previewKey, false);
    }
  };

  const handleStartNewAnalysis = useCallback(() => { 
    clearSession(); 
  }, [clearSession]);

  const openExpertFeedbackForm = useCallback((term: FrontendAnalysisTerm) => {
    setExpertFeedbackTermId(term.term_id);
    setCurrentExpertFeedback({
      aiAnalysisApproved: null,
      expertComment: "",
      expertIsValidSharia: term.expert_override_is_valid_sharia ?? term.isReviewedSuggestionValid ?? term.is_valid_sharia,
      expertCorrectedShariaIssue: term.sharia_issue || "",
      expertCorrectedReference: term.reference_number || "",
      expertCorrectedSuggestion: term.userModifiedText || term.reviewedSuggestion || term.modified_term || "",
    });
  }, []);

  const handleExpertFeedbackChange = useCallback((field: keyof ExpertFeedbackData, value: any) => {
    setCurrentExpertFeedback(prev => ({ ...prev, [field]: value }));
  }, []);

  const submitExpertFeedbackHandler = useCallback(async () => {
    if (!expertFeedbackTermId || !sessionId) return;
    if (currentExpertFeedback.aiAnalysisApproved === null) {
      Alert.alert(t('expert.validation.assessmentMissing'), t('expert.validation.assessmentMissingDesc'));
      return;
    }

    setIsSubmittingExpertFeedback(prev => ({...prev, [expertFeedbackTermId]: true}));
    try {
      const payload = {
        session_id: sessionId,
        term_id: expertFeedbackTermId,
        feedback_data: currentExpertFeedback as ExpertFeedbackData
      };
      await apiService.submitExpertFeedbackApi(payload);

      updateTermLocally({
        term_id: expertFeedbackTermId,
        has_expert_feedback: true,
        expert_override_is_valid_sharia: currentExpertFeedback.expertIsValidSharia
      });

      Alert.alert(t('expert.feedbackSubmitted'), t('expert.feedbackSubmittedDesc'));
      setExpertFeedbackTermId(null);
      setCurrentExpertFeedback({});
    } catch (error: any) {
      Alert.alert(t('expert.submissionFailed'), error.message || t('expert.submissionFailedDesc'));
    } finally {
      setIsSubmittingExpertFeedback(prev => ({...prev, [expertFeedbackTermId]: false}));
    }
  }, [expertFeedbackTermId, sessionId, currentExpertFeedback, t, updateTermLocally]);

  const filteredTerms = useMemo(() => {
    console.log('ContractTermsList: Filtering terms', { 
      analysisTerms: analysisTerms ? analysisTerms.length : 'null/undefined',
      activeFilter,
      sessionId 
    });
    
    if (!analysisTerms || !Array.isArray(analysisTerms)) {
      console.log('ContractTermsList: No valid analysis terms', { analysisTerms, sessionId });
      return [];
    }
    
    const filtered = analysisTerms.filter(term => {
      if (activeFilter === 'all') return true;
      const isEffectivelyCompliant = term.expert_override_is_valid_sharia ?? (term.isUserConfirmed ? (term.isReviewedSuggestionValid ?? true) : term.is_valid_sharia) ?? false;
      if (activeFilter === 'compliant') return isEffectivelyCompliant;
      if (activeFilter === 'non-compliant') return !isEffectivelyCompliant;
      return true;
    });
    
    console.log('ContractTermsList: Filtered terms result', { 
      totalTerms: analysisTerms.length,
      filteredCount: filtered.length,
      activeFilter 
    });
    
    return filtered;
  }, [analysisTerms, activeFilter, sessionId]);

  console.log('ContractTermsList: Component render', { 
    sessionId,
    isFetchingSession,
    analysisTerms: analysisTerms ? `${analysisTerms.length} terms` : 'null/undefined',
    sessionDetails: sessionDetails ? 'has session details' : 'no session details'
  });

  if ((isFetchingSession || isAnalyzingContract) && (!analysisTerms || analysisTerms.length === 0)) {
    console.log('ContractTermsList: Showing loading state');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={isDark ? '#10b981' : '#059669'} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  if (!sessionId && !isAnalyzingContract) {
    return (
      <View style={styles.emptyContainer}>
        <FileText size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
        <Text style={styles.emptyText}>{t('term.noSession')}</Text>
      </View>
    );
  }

  if (sessionId && analysisTerms === null && !isAnalyzingContract && !isFetchingSession) {
    return (
      <View style={styles.emptyContainer}>
        <FileText size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
        <Text style={styles.emptyText}>{sessionError || t('term.noResults')}</Text>
      </View>
    );
  }

  if (!analysisTerms || !Array.isArray(analysisTerms) || analysisTerms.length === 0) {
    console.log('ContractTermsList: No analysis terms available', { 
      analysisTerms: analysisTerms ? 'not array or empty' : 'null/undefined', 
      sessionId,
      sessionDetails: sessionDetails ? 'exists' : 'missing'
    });
    return (
      <View style={styles.emptyContainer}>
        <FileText size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
        <Text style={styles.emptyText}>
          {!analysisTerms || analysisTerms.length === 0 ? t('term.noTermsExtracted') : t('term.noTermsForFilter')}
        </Text>
        {sessionId && (!analysisTerms || analysisTerms.length === 0) && (
          <Button 
            variant="outline" 
            style={{ marginTop: 16 }}
            onPress={() => {
              console.log('ContractTermsList: Refreshing session data');
              clearSession();
            }}
          >
            <RefreshCw size={16} color={isDark ? '#10b981' : '#059669'} />
            <Text style={styles.buttonText}>{t('refresh')}</Text>
          </Button>
        )}
      </View>
    );
  }

  console.log('ContractTermsList: Rendering terms', { 
    analysisTermsCount: analysisTerms?.length, 
    filteredTermsCount: filteredTerms?.length,
    activeFilter,
    sessionId
  });

  const renderTerm = (term: FrontendAnalysisTerm, index: number) => {
    const isExpanded = expandedTerms[term.term_id] || false;
    const isEditing = editingTermId === term.term_id;
    const isEffectivelyCompliant = term.expert_override_is_valid_sharia ?? (term.isUserConfirmed ? (term.isReviewedSuggestionValid ?? true) : term.is_valid_sharia) ?? false;
    
    const textInSuggestionOrEditBox = isEditing ? currentEditText : (term.userModifiedText ?? term.reviewedSuggestion ?? term.modified_term ?? "");

    let suggestionBoxLabelKey = 'term.initialSuggestion';
    if (term.isUserConfirmed && term.userModifiedText) { suggestionBoxLabelKey = 'term.confirmed'; }
    else if (isEditing) { suggestionBoxLabelKey = 'term.editSuggestion';}
    else if (term.reviewedSuggestion && (term.userModifiedText === term.reviewedSuggestion || textInSuggestionOrEditBox === term.reviewedSuggestion) ) { suggestionBoxLabelKey = 'term.reviewedSuggestion'; }
    else if (term.userModifiedText) { suggestionBoxLabelKey = 'term.yourEdit'; }

    return (
      <Animated.View 
        key={term.term_id} 
        style={[
          styles.termCard,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.termHeader} 
          onPress={() => toggleTerm(term.term_id)}
          activeOpacity={0.7}
        >
          <Text style={styles.termHeaderText} numberOfLines={3}>
            {term.term_text}
          </Text>
          <View style={styles.termHeaderRight}>
            <View style={[
              styles.tag, 
              { 
                backgroundColor: isEffectivelyCompliant ? '#10b981' : '#ef4444',
                shadowColor: isEffectivelyCompliant ? '#10b981' : '#ef4444',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              }
            ]}>
              <Text style={styles.tagText}>
                {t(isEffectivelyCompliant ? 'term.compliant' : 'term.non-compliant')}
              </Text>
            </View>
            <Animated.View style={{
              transform: [{ rotate: isExpanded ? '180deg' : '0deg' }]
            }}>
              <ChevronDown size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Animated.View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.termContent}>
            <Text style={styles.sectionTitle}>{t('term.fullText')}</Text>
            <Text style={styles.sectionText}>{term.term_text}</Text>

            {!isEffectivelyCompliant && term.sharia_issue && !(term.reviewedSuggestionIssue && term.isReviewedSuggestionValid === false) && (
              <View style={styles.issueBox}>
                <AlertCircle size={16} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueTitle}>{t('term.why')}</Text>
                  <Text style={styles.issueText}>{term.sharia_issue}</Text>
                </View>
              </View>
            )}

            {term.reviewedSuggestionIssue && term.isReviewedSuggestionValid === false && (
              <View style={[styles.issueBox, { marginTop: 8 }]}>
                <AlertCircle size={16} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueTitle}>{t('term.newShariaIssue')}</Text>
                  <Text style={styles.issueText}>{term.reviewedSuggestionIssue}</Text>
                </View>
              </View>
            )}

            {term.reference_number && (
              <View style={[styles.referenceBox, { backgroundColor: isEffectivelyCompliant ? '#dbeafe' : '#fef3c7' }]}>
                <Info size={16} color={isEffectivelyCompliant ? '#3b82f6' : '#f59e0b'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.referenceTitle, { color: isEffectivelyCompliant ? '#1e40af' : '#92400e' }]}>
                    {t('term.reference')}
                  </Text>
                  <Text style={[styles.referenceText, { color: isEffectivelyCompliant ? '#1e40af' : '#92400e' }]}>
                    {term.reference_number}
                  </Text>
                </View>
              </View>
            )}

            {isEditing ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>{t('term.editSuggestion')}</Text>
                <Textarea 
                  value={currentEditText} 
                  onChangeText={setCurrentEditText}
                  style={styles.textareaStyle}
                />
                <View style={styles.buttonGroup}>
                  <Button variant="ghost" onPress={() => setEditingTermId(null)}>
                    <XCircle size={16} color={isDark ? '#d1d5db' : '#6b7280'} />
                    <Text style={styles.buttonText}>{t('term.cancel')}</Text>
                  </Button>
                  <Button 
                    onPress={() => handleSaveAndReview(term.term_id)} 
                    disabled={isReviewingModification && isReviewingModification[term.term_id]}
                  >
                    {isReviewingModification && isReviewingModification[term.term_id] ? 
                      <ActivityIndicator color="#fff" size="small" /> : 
                      <Sparkles size={16} color="#fff" />
                    }
                    <Text style={styles.buttonTextPrimary}>{t('term.saveAndReview')}</Text>
                  </Button>
                </View>
              </View>
            ) : term.isUserConfirmed && term.userModifiedText ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>{t(suggestionBoxLabelKey)}</Text>
                <View style={styles.confirmedSuggestionBox}>
                  <Text style={styles.confirmedSuggestionText}>{term.userModifiedText}</Text>
                </View>
                <Button variant="outline" onPress={() => handleEditSuggestion(term)} style={{ marginTop: 8 }}>
                  <Edit3 size={14} color={isDark ? '#d1d5db' : '#374151'} />
                  <Text style={styles.buttonText}>{t('term.editConfirmed')}</Text>
                </Button>
              </View>
            ) : textInSuggestionOrEditBox && (!term.is_valid_sharia || term.userModifiedText || term.reviewedSuggestion) ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>{t(suggestionBoxLabelKey)}</Text>
                <Text style={styles.suggestionText}>{textInSuggestionOrEditBox}</Text>
                {term.reviewedSuggestion && (term.userModifiedText === term.reviewedSuggestion || textInSuggestionOrEditBox === term.reviewedSuggestion) && (
                  <View style={[
                    styles.reviewStatusBox,
                    { backgroundColor: term.isReviewedSuggestionValid ? '#dcfce7' : '#fee2e2' }
                  ]}>
                    <Text style={[
                      styles.reviewStatusText,
                      { color: term.isReviewedSuggestionValid ? '#166534' : '#991b1b' }
                    ]}>
                      AI Review: {term.isReviewedSuggestionValid ? t('review.looksGood') : `${t('review.concern')}: ${term.reviewedSuggestionIssue || t('review.complianceIssue')}`}
                    </Text>
                  </View>
                )}
                <View style={styles.buttonGroup}>
                  <Button 
                    onPress={() => handleConfirmChanges(term)} 
                    disabled={isTermProcessing && isTermProcessing[term.term_id]}
                    style={{ flex: 1 }}
                  >
                    {isTermProcessing && isTermProcessing[term.term_id] ? 
                      <ActivityIndicator color="#fff" size="small" /> : 
                      <ThumbsUp size={16} color="#fff" />
                    }
                    <Text style={styles.buttonTextPrimary}>{t('button.confirm')}</Text>
                  </Button>
                  <Button variant="outline" onPress={() => handleEditSuggestion(term)} style={{ flex: 1, marginLeft: 8 }}>
                    <Edit3 size={16} color={isDark ? '#d1d5db' : '#374151'} />
                    <Text style={styles.buttonText}>{t('term.editSuggestion')}</Text>
                  </Button>
                </View>
              </View>
            ) : term.is_valid_sharia ? (
              <View style={styles.compliantBox}>
                <Text style={styles.compliantText}>{t('term.alreadyCompliant')}</Text>
              </View>
            ) : null}

            {term.currentQaAnswer && (
              <View style={styles.answerContainer}>
                <Text style={styles.answerTitle}>{t('term.answer')}</Text>
                <Text style={styles.answerText}>{term.currentQaAnswer}</Text>
                {!term.isUserConfirmed && (!term.is_valid_sharia || term.isReviewedSuggestionValid === false) && (
                  <Button 
                    variant="ghost" 
                    style={{ marginTop: 8 }}
                    onPress={() => handleUseAnswerAsSuggestion(term)}
                    disabled={isReviewingModification && isReviewingModification[term.term_id]}
                  >
                    {isReviewingModification && isReviewingModification[term.term_id] ? 
                      <ActivityIndicator color={isDark ? '#10b981' : '#059669'} size="small" /> : 
                      <Sparkles size={14} color={isDark ? '#10b981' : '#059669'} />
                    }
                    <Text style={styles.useAnswerButtonText}>{t('button.useAndReview')}</Text>
                  </Button>
                )}
              </View>
            )}

            {!term.isUserConfirmed && (
              <View style={styles.questionSection}>
                <Textarea 
                  placeholder={t('term.questionPlaceholder')} 
                  value={termQuestions[term.term_id] || ''} 
                  onChangeText={(val) => handleQuestionChange(term.term_id, val)}
                  style={styles.textareaStyle}
                />
                <Button 
                  style={{ marginTop: 8 }} 
                  onPress={() => handleSendQuestion(term.term_id)} 
                  disabled={isTermProcessing && isTermProcessing[term.term_id] || !termQuestions[term.term_id]?.trim()}
                >
                  {isTermProcessing && isTermProcessing[term.term_id] ? 
                    <ActivityIndicator color="#fff" size="small" /> : 
                    <Send size={16} color="#fff" />
                  }
                  <Text style={styles.buttonTextPrimary}>{t('button.send')}</Text>
                </Button>
              </View>
            )}

            {currentUserRole === 'shariah_expert' && (
              <View style={styles.expertFeedbackSection}>
                <Text style={styles.expertFeedbackTitle}>
                  {t('expert.feedbackTitle')}
                </Text>
                {expertFeedbackTermId === term.term_id ? (
                  <View style={styles.expertFeedbackForm}>
                    <Text style={styles.feedbackLabel}>{t('expert.aiAssessmentCorrect')}</Text>
                    <RadioGroup 
                      options={[
                        { label: t('expert.yes'), value: 'true' },
                        { label: t('expert.no'), value: 'false' }
                      ]}
                      selectedValue={currentExpertFeedback.aiAnalysisApproved === null ? "" : String(currentExpertFeedback.aiAnalysisApproved)}
                      onValueChange={(val) => handleExpertFeedbackChange('aiAnalysisApproved', val === 'true')}
                      isRTL={isRTL}
                      styles={styles}
                    />

                    {currentExpertFeedback.aiAnalysisApproved === false && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={styles.feedbackLabel}>{t('expert.correctedCompliance')}</Text>
                        <RadioGroup 
                          options={[
                            { label: t('term.compliant'), value: 'true' },
                            { label: t('term.non-compliant'), value: 'false' }
                          ]}
                          selectedValue={currentExpertFeedback.expertIsValidSharia === undefined ? "" : String(currentExpertFeedback.expertIsValidSharia)}
                          onValueChange={(val) => handleExpertFeedbackChange('expertIsValidSharia', val === 'true')}
                          isRTL={isRTL}
                          styles={styles}
                        />
                      </View>
                    )}

                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.feedbackLabel}>{t('expert.comments')}</Text>
                      <Textarea 
                        value={currentExpertFeedback.expertComment || ""}
                        onChangeText={(val) => handleExpertFeedbackChange('expertComment', val)}
                        placeholder={t('expert.commentsPlaceholder')}
                        style={styles.textareaStyle}
                      />
                    </View>

                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.feedbackLabel}>{t('expert.correctedSuggestion')}</Text>
                      <Textarea 
                        value={currentExpertFeedback.expertCorrectedSuggestion || ""}
                        onChangeText={(val) => handleExpertFeedbackChange('expertCorrectedSuggestion', val)}
                        style={styles.textareaStyle}
                      />
                    </View>

                    <View style={styles.buttonGroup}>
                      <Button variant="ghost" onPress={() => setExpertFeedbackTermId(null)}>
                        <Text style={styles.buttonText}>{t('term.cancel')}</Text>
                      </Button>
                      <Button 
                        onPress={submitExpertFeedbackHandler}
                        disabled={isSubmittingExpertFeedback[term.term_id] || currentExpertFeedback.aiAnalysisApproved === null}
                      >
                        {isSubmittingExpertFeedback[term.term_id] ? 
                          <ActivityIndicator color="#fff" size="small" /> : 
                          <Send size={16} color="#fff" />
                        }
                        <Text style={styles.buttonTextPrimary}>{t('expert.submitFeedback')}</Text>
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Button 
                    variant="outline" 
                    onPress={() => openExpertFeedbackForm(term)}
                    style={styles.expertFeedbackButton}
                  >
                    <ExpertIcon size={16} color="#f59e0b" />
                    <Text style={styles.expertFeedbackButtonText}>{t('expert.provideFeedback')}</Text>
                  </Button>
                )}
              </View>
            )}
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <QuestionAnimation isVisible={askingQuestionForTermId !== null || isProcessingGeneralQuestion} />
      {generationType && (
        <GeneratingContractAnimation 
          progress={generationVisualProgress} 
          type={generationType} 
          styles={styles}
          isDark={isDark}
        />
      )}

      <Animated.View style={[
        styles.header,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        }
      ]}>
        <Text style={styles.title}>{t('contract.terms')}</Text>
        <View style={styles.headerActions}>
          {sessionId && analysisTerms && analysisTerms.length > 0 && (
            <TouchableOpacity 
              style={styles.generalQuestionButton}
              onPress={() => setIsGeneralQuestionModalVisible(true)}
              activeOpacity={0.7}
            >
              <HelpCircle size={16} color={isDark ? '#10b981' : '#059669'} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <Tabs
        tabs={[
          { value: 'all', label: t('filter.all') },
          { value: 'compliant', label: t('filter.compliant') },
          { value: 'non-compliant', label: t('filter.non-compliant') },
        ]}
        activeTab={activeFilter}
        onTabChange={setActiveFilter}
      />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {Array.isArray(filteredTerms) && filteredTerms.length > 0 ? (
          filteredTerms.map((term, index) => renderTerm(term, index))
        ) : (
          <View style={styles.emptyContainer}>
            <FileText size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={styles.emptyText}>
              {!analysisTerms || analysisTerms.length === 0 ? t('term.noTermsExtracted') : t('term.noTermsForFilter')}
            </Text>
          </View>
        )}
      </ScrollView>

      {Array.isArray(analysisTerms) && analysisTerms.length > 0 && (
        <View style={styles.generationSection}>
          <Text style={styles.sectionTitle}>{t('contract.reviewContract')}</Text>
          <Text style={styles.sectionDescription}>{t('contract.generateInfo')}</Text>

          <View style={styles.buttonContainer}>
            <Button 
              onPress={handleGenerateContract} 
              disabled={isGeneratingContract || isGeneratingMarkedContract} 
              style={styles.generateButton}
            >
              {isGeneratingContract ? 
                <ActivityIndicator color="#fff" size="small" /> : 
                <FileCheck2 size={16} color="#fff" />
              }
              <Text style={styles.buttonTextPrimary}>{t('contract.generateButton')}</Text>
            </Button>
            {sessionDetails?.modified_contract_info && (
              <Button 
                onPress={() => openPreviewModalWithType('modified')} 
                variant="outline" 
                style={styles.previewButton}
              >
                <Eye size={16} color={isDark ? '#fff' : '#000'} />
              </Button>
            )}
          </View>

          <View style={styles.buttonContainer}>
            <Button 
              onPress={handleGenerateMarkedContract} 
              disabled={isGeneratingContract || isGeneratingMarkedContract} 
              variant="secondary" 
              style={styles.generateButton}
            >
              {isGeneratingMarkedContract ? 
                <ActivityIndicator color={isDark ? '#fff' : '#000'} size="small" /> : 
                <FileSearch size={16} color={isDark ? '#fff' : '#000'} />
              }
              <Text style={styles.buttonText}>{t('contract.generateMarkedButton')}</Text>
            </Button>
            {sessionDetails?.marked_contract_info && (
              <Button 
                onPress={() => openPreviewModalWithType('marked')} 
                variant="outline" 
                style={styles.previewButton}
              >
                <Eye size={16} color={isDark ? '#fff' : '#000'} />
              </Button>
            )}
          </View>

          {sessionId && (
            <Button 
              variant="outline" 
              onPress={handleStartNewAnalysis} 
              style={styles.newAnalysisButton}
            >
              <RefreshCw size={16} color={isDark ? '#ef4444' : '#dc2626'} />
              <Text style={styles.newAnalysisButtonText}>{t('upload.newAnalysis') || "Start New Analysis"}</Text>
            </Button>
          )}
        </View>
      )}

      <ContractPreviewModal 
        isVisible={isPreviewModalVisible}
        onClose={() => {
          if (previewFileUrl && previewFileUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewFileUrl);
          }
          setIsPreviewModalVisible(false);
          setPreviewFileUrl(null);
          const currentPreviewType = previewFileType;
          setPreviewFileType(null);
          const currentPreviewKey = sessionId && currentPreviewType ? `${sessionId}-${currentPreviewType}-preview` : null;
          if (currentPreviewKey) {
            setPreviewLoading(currentPreviewKey, false);
          }
        }}
        fileType={previewFileType}
        fileUrl={previewFileUrl}
        pdfDownloadFilename={previewPdfDownloadFilename}
        docxDownloadUrl={
          previewFileType === 'modified' ? sessionDetails?.modified_contract_info?.docx_cloudinary_info?.url :
          previewFileType === 'marked' ? sessionDetails?.marked_contract_info?.docx_cloudinary_info?.url :
          null
        }
        userFacingDocxFilename={
          previewFileType === 'modified' ? sessionDetails?.modified_contract_info?.docx_cloudinary_info?.user_facing_filename :
          previewFileType === 'marked' ? sessionDetails?.marked_contract_info?.docx_cloudinary_info?.user_facing_filename :
          "contract.docx"
        }
        onRetryPreview={() => {
          if (previewFileType) openPreviewModalWithType(previewFileType);
        }}
      />

      <Modal
        visible={isGeneralQuestionModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsGeneralQuestionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[
            styles.modalContainer,
            {
              transform: [{ scale: fadeAnim }],
            }
          ]}>
            <Text style={styles.modalTitle}>{t('term.askGeneralQuestion')}</Text>
            <Textarea
              placeholder={t('term.generalQuestionPlaceholder')}
              value={generalQuestionText}
              onChangeText={setGeneralQuestionText}
              style={styles.modalTextarea}
            />
            {isProcessingGeneralQuestion && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={isDark ? '#10b981' : '#059669'} />
                <Text style={styles.loadingText}>{t('processing')}</Text>
              </View>
            )}
            {generalQuestionAnswer && !isProcessingGeneralQuestion && (
              <ScrollView style={styles.answerScrollView}>
                <Text style={styles.answerTitle}>{t('term.answer')}</Text>
                <Text style={styles.generalAnswerText}>{generalQuestionAnswer}</Text>
              </ScrollView>
            )}
            <View style={styles.modalButtonGroup}>
              <Button 
                variant="ghost" 
                onPress={() => {
                  setIsGeneralQuestionModalVisible(false);
                  setGeneralQuestionText("");
                  setGeneralQuestionAnswer(null);
                }}
              >
                <Text style={styles.buttonText}>{t('term.cancel')}</Text>
              </Button>
              <Button 
                onPress={handleSendGeneralQuestion}
                disabled={isProcessingGeneralQuestion || !generalQuestionText.trim()}
              >
                {isProcessingGeneralQuestion ? 
                  <ActivityIndicator color="#fff" size="small" /> : 
                  <Send size={16} color="#fff" />
                }
                <Text style={styles.buttonTextPrimary}>{t('button.send')}</Text>
              </Button>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => {
  const baseStyles = {
    container: { 
      padding: 16, 
      flex: 1, 
      backgroundColor: isDark ? '#111827' : '#f9fafb' 
    },
    loadingContainer: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 40 
    },
    loadingText: { 
      marginTop: 12, 
      color: isDark ? '#9ca3af' : '#6b7280', 
      fontSize: 16 
    },
    emptyContainer: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      paddingVertical: 60 
    },
    emptyText: { 
      textAlign: 'center', 
      color: isDark ? '#9ca3af' : '#6b7280', 
      fontSize: 16, 
      marginTop: 16 
    },
    header: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb'
    },
    title: { 
      fontSize: 24, 
      fontWeight: 'bold', 
      color: isDark ? '#f9fafb' : '#111827', 
      textAlign: isRTL ? 'right' : 'left', 
      flex: 1 
    },
    headerActions: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      alignItems: 'center', 
      gap: 12 
    },
    generalQuestionButton: { 
      padding: 12, 
      borderRadius: 25, 
      backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)' 
    },
    scrollContent: { 
      paddingBottom: 20 
    },
    termCard: { 
      backgroundColor: isDark ? '#1f2937' : '#ffffff', 
      borderRadius: 16, 
      marginBottom: 16, 
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 5, 
      borderWidth: 1, 
      borderColor: isDark ? '#374151' : '#e5e7eb' 
    },
    termHeader: { 
      padding: 20, 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center' 
    },
    termHeaderText: { 
      flex: 1, 
      fontSize: 16, 
      fontWeight: '600', 
      color: isDark ? '#f9fafb' : '#374151', 
      lineHeight: 24, 
      textAlign: isRTL ? 'right' : 'left',
      marginRight: isRTL ? 0 : 12,
      marginLeft: isRTL ? 12 : 0,
    },
    termHeaderRight: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      alignItems: 'center', 
      gap: 12 
    },
    tag: { 
      paddingHorizontal: 12, 
      paddingVertical: 6, 
      borderRadius: 20 
    },
    tagText: { 
      color: '#fff', 
      fontSize: 12, 
      fontWeight: 'bold' 
    },
    termContent: { 
      padding: 20, 
      borderTopWidth: 1, 
      borderTopColor: isDark ? '#374151' : '#e5e7eb' 
    },
    sectionTitle: { 
      fontSize: 12, 
      fontWeight: 'bold', 
      color: isDark ? '#9ca3af' : '#6b7280', 
      textTransform: 'uppercase', 
      marginBottom: 10, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    sectionText: { 
      fontSize: 16, 
      color: isDark ? '#d1d5db' : '#374151', 
      lineHeight: 26, 
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 16 
    },
    sectionDescription: { 
      fontSize: 14, 
      color: isDark ? '#9ca3af' : '#6b7280', 
      marginBottom: 20, 
      textAlign: isRTL ? 'right' : 'left',
      lineHeight: 20
    },
    issueBox: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      gap: 12, 
      backgroundColor: isDark ? '#4b1d1d' : '#fee2e2', 
      padding: 16, 
      borderRadius: 12, 
      marginTop: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#ef4444'
    },
    issueTitle: { 
      fontSize: 14, 
      fontWeight: 'bold', 
      color: isDark ? '#fca5a5' : '#b91c1c', 
      marginBottom: 6, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    issueText: { 
      fontSize: 14, 
      color: isDark ? '#fecaca' : '#dc2626', 
      lineHeight: 22, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    referenceBox: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      gap: 12, 
      padding: 16, 
      borderRadius: 12, 
      marginTop: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#3b82f6'
    },
    referenceTitle: { 
      fontSize: 12, 
      fontWeight: 'bold', 
      marginBottom: 6, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    referenceText: { 
      fontSize: 14, 
      lineHeight: 22, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    suggestionText: { 
      fontSize: 16, 
      color: isDark ? '#bfdbfe' : '#1e40af', 
      lineHeight: 26, 
      backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', 
      padding: 16, 
      borderRadius: 12, 
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 16
    },
    confirmedSuggestionBox: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : '#dcfce7',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(34, 197, 94, 0.4)' : '#bbf7d0',
      marginBottom: 16
    },
    confirmedSuggestionText: {
      fontSize: 16,
      color: isDark ? '#86efac' : '#166534',
      lineHeight: 26,
      fontWeight: '500',
      textAlign: isRTL ? 'right' : 'left'
    },
    compliantBox: {
      backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : '#f0fdf4',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0',
      marginTop: 16
    },
    compliantText: {
      fontSize: 16,
      color: isDark ? '#86efac' : '#166534',
      textAlign: isRTL ? 'right' : 'left'
    },
    reviewStatusBox: {
      padding: 8,
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 16
    },
    reviewStatusText: {
      fontSize: 12,
      fontWeight: '500',
      textAlign: isRTL ? 'right' : 'left'
    },
    textareaStyle: {
      minHeight: 80,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? '#374151' : '#d1d5db',
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      padding: 12,
    },
    questionSection: { 
      marginTop: 20, 
      borderTopWidth: 1, 
      borderTopColor: isDark ? '#374151' : '#e5e7eb', 
      paddingTop: 20 
    },
    buttonGroup: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      gap: 12, 
      marginTop: 16 
    },
    buttonText: { 
      color: isDark ? '#d1d5db' : '#374151', 
      marginLeft: 8, 
      fontWeight: '500' 
    },
    buttonTextPrimary: { 
      color: '#fff', 
      marginLeft: 8, 
      fontWeight: '500' 
    },
    useAnswerButtonText: { 
      color: isDark ? '#10b981' : '#059669', 
      marginLeft: 8,
      fontWeight: '500'
    },
    answerContainer: { 
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
      paddingTop: 16
    },
    answerTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      color: isDark ? '#93c5fd' : '#2563eb',
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
      textTransform: 'uppercase'
    },
    answerText: { 
      padding: 16, 
      backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', 
      borderRadius: 12, 
      color: isDark ? '#bfdbfe' : '#1e40af', 
      fontSize: 15, 
      lineHeight: 22, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    generationSection: { 
      marginTop: 32, 
      paddingTop: 20, 
      borderTopWidth: 1, 
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderRadius: 16,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    buttonContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginBottom: 16 
    },
    generateButton: { 
      flex: 1,
      borderRadius: 12,
      paddingVertical: 14
    },
    previewButton: { 
      marginLeft: 12,
      borderRadius: 12,
      paddingHorizontal: 16
    },
    newAnalysisButton: {
      marginTop: 16,
      borderRadius: 12,
      borderColor: isDark ? '#ef4444' : '#dc2626'
    },
    newAnalysisButtonText: {
      color: isDark ? '#ef4444' : '#dc2626',
      marginLeft: 8,
      fontWeight: '500'
    },
    radioContainer: { 
      gap: 20, 
      marginVertical: 12 
    },
    radioOption: { 
      alignItems: 'center', 
      gap: 10 
    },
    radioOuter: { 
      height: 22, 
      width: 22, 
      borderRadius: 11, 
      borderWidth: 2, 
      borderColor: '#10b981', 
      alignItems: 'center', 
      justifyContent: 'center' 
    },
    radioOuterSelected: { 
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)'
    },
    radioInner: { 
      height: 12, 
      width: 12, 
      borderRadius: 6, 
      backgroundColor: '#10b981' 
    },
    radioLabel: { 
      color: isDark ? '#f9fafb' : '#111827', 
      fontSize: 15,
      fontWeight: '500'
    },
    radioLabelSelected: {
      color: '#10b981',
      fontWeight: '600'
    },
    animationOverlay: { 
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 1001 
    },
    animationContainer: { 
      backgroundColor: isDark ? '#1f2937' : '#ffffff', 
      borderRadius: 20, 
      padding: 32, 
      width: screenWidth * 0.85, 
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    stageIconContainer: { 
      width: 80, 
      height: 80, 
      borderRadius: 40, 
      justifyContent: 'center', 
      alignItems: 'center', 
      marginBottom: 20 
    },
    animationTitle: { 
      fontSize: 20, 
      fontWeight: 'bold', 
      color: isDark ? '#f9fafb' : '#111827', 
      textAlign: 'center', 
      marginBottom: 12 
    },
    stageText: { 
      fontSize: 16, 
      textAlign: 'center', 
      marginBottom: 24,
      fontWeight: '500'
    },
    progressContainer: { 
      width: '100%', 
      alignItems: 'center' 
    },
    progressBar: { 
      width: '100%', 
      marginBottom: 12,
      height: 8,
      borderRadius: 4
    },
    animationPercentage: { 
      fontSize: 16, 
      fontWeight: '600', 
      color: isDark ? '#9ca3af' : '#6b7280', 
      textAlign: 'center',
      marginBottom: 20
    },
    stageIndicators: { 
      flexDirection: 'row', 
      gap: 8, 
      alignItems: 'center' 
    },
    stageIndicator: { 
      width: 8, 
      height: 8, 
      borderRadius: 4 
    },
    expertFeedbackSection: { 
      marginTop: 20, 
      paddingTop: 20, 
      borderTopWidth: 1, 
      borderTopColor: '#f59e0b', 
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)', 
      padding: 16, 
      borderRadius: 12 
    },
    expertFeedbackTitle: { 
      fontSize: 16, 
      fontWeight: 'bold', 
      color: '#f59e0b', 
      marginBottom: 16, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    expertFeedbackForm: { 
      gap: 16 
    },
    expertFeedbackButton: { 
      borderColor: '#f59e0b',
      borderRadius: 12
    },
    expertFeedbackButtonText: { 
      color: '#f59e0b', 
      marginLeft: 8,
      fontWeight: '500'
    },
    feedbackLabel: { 
      fontSize: 14, 
      fontWeight: '600', 
      color: isDark ? '#d1d5db' : '#374151', 
      marginBottom: 8, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    modalOverlay: { 
      flex: 1, 
      backgroundColor: 'rgba(0,0,0,0.7)', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: 20 
    },
    modalContainer: { 
      backgroundColor: isDark ? '#1f2937' : '#ffffff', 
      borderRadius: 20, 
      padding: 24, 
      width: '100%', 
      maxHeight: '85%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    modalTitle: { 
      fontSize: 20, 
      fontWeight: 'bold', 
      color: isDark ? '#f9fafb' : '#111827', 
      marginBottom: 20, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    modalTextarea: { 
      minHeight: 120, 
      marginBottom: 20,
      borderRadius: 12
    },
    modalButtonGroup: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      justifyContent: 'flex-end', 
      gap: 12, 
      marginTop: 20 
    },
    answerScrollView: { 
      maxHeight: 250, 
      marginBottom: 20, 
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)', 
      padding: 16, 
      borderRadius: 12 
    },
    generalAnswerText: { 
      fontSize: 15, 
      color: isDark ? '#dbeafe' : '#1e40af', 
      lineHeight: 22, 
      textAlign: isRTL ? 'right' : 'left' 
    },
  };

  return StyleSheet.create(baseStyles);
};

export default ContractTermsList;
