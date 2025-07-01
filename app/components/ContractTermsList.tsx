
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal, Animated, Dimensions } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession, FrontendAnalysisTerm } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  CheckCircle, AlertCircle, ChevronDown, MessageSquare, ThumbsUp, Edit3, Send, 
  Sparkles, XCircle, FileCheck2, FileSearch, Eye, HelpCircle, RefreshCw, 
  UserCheck as ExpertIcon, FileText, Users, User, Loader2, Play, Pause 
} from 'lucide-react-native';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Tabs } from './ui/tabs';
import QuestionAnimation from './QuestionAnimation';
import ContractPreviewModal from './ContractPreviewModal';
import { Progress } from './ui/progress';

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
    askQuestionAboutTerm, reviewUserModification, confirmTermModification, isAskingQuestion,
    generateModifiedContract, generateMarkedContract, isGeneratingContract, isGeneratingMarkedContract,
    sessionId, sessionDetails, updateTermLocally, clearSession, currentUserRole, toggleUserRole,
    askGeneralContractQuestion, isProcessingGeneralQuestion, submitExpertFeedback
  } = useSession();

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const [termQuestions, setTermQuestions] = useState<Record<string, string>>({});

  const [generationVisualProgress, setGenerationVisualProgress] = useState(0);
  const [generationType, setGenerationType] = useState<'modified' | 'marked' | null>(null);

  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [currentEditText, setCurrentEditText] = useState<string>("");

  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [previewFileType, setPreviewFileType] = useState<'modified' | 'marked' | null>(null);

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
    if (analysisTerms && analysisTerms.length > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [analysisTerms]);

  const toggleTerm = useCallback((termId: string) => {
    setExpandedTermId(prevId => (prevId === termId ? null : termId));
  }, []);

  const handleSendQuestion = useCallback(async (termId: string) => {
    const questionText = termQuestions[termId]?.trim();
    if (!questionText || (isTermProcessing && isTermProcessing[termId])) return;
    await askQuestionAboutTerm(termId, questionText);
    setTermQuestions(prev => ({ ...prev, [termId]: '' }));
  }, [termQuestions, isTermProcessing, askQuestionAboutTerm]);

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
    setCurrentEditText(term.userModifiedText ?? term.reviewedSuggestion ?? term.modified_term ?? term.term_text);
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

  const handleGenerateContract = async (type: 'modified' | 'marked') => {
    const generatorFn = type === 'modified' ? generateModifiedContract : generateMarkedContract;
    setGenerationType(type);
    setGenerationVisualProgress(0);

    // Enhanced progress simulation with more realistic timing
    const progressInterval = setInterval(() => {
      setGenerationVisualProgress(p => {
        if (p < 25) return p + 1.5;
        if (p < 60) return p + 1;
        if (p < 90) return p + 0.8;
        return Math.min(p + 0.3, 99);
      });
    }, 150);

    const response = await generatorFn();
    clearInterval(progressInterval);
    setGenerationVisualProgress(100);

    if (response?.success) {
      Alert.alert(
        t(type === 'modified' ? 'contract.generated' : 'contract.markedGenerated'),
        t(type === 'modified' ? 'contract.generatedMessage' : 'contract.markedGeneratedMessage')
      );
    } else {
      Alert.alert(t('error.generationFailed'), response?.message || 'Could not generate the contract.');
    }
    setTimeout(() => setGenerationType(null), 1500);
  };

  const openPreview = (type: 'modified' | 'marked') => {
    setPreviewFileType(type);
    setIsPreviewModalVisible(true);
  };

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
      await submitExpertFeedback(payload);

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
  }, [expertFeedbackTermId, sessionId, currentExpertFeedback, t, updateTermLocally, submitExpertFeedback]);

  const filteredTerms = useMemo(() => {
    if (!analysisTerms) return [];
    return analysisTerms.filter(term => {
      if (activeFilter === 'all') return true;
      let isEffectivelyCompliant = term.expert_override_is_valid_sharia ?? (term.isUserConfirmed ? (term.isReviewedSuggestionValid ?? true) : term.is_valid_sharia) ?? false;
      if (activeFilter === 'compliant') return isEffectivelyCompliant;
      if (activeFilter === 'non-compliant') return !isEffectivelyCompliant;
      return true;
    });
  }, [analysisTerms, activeFilter]);

  if (isFetchingSession && !analysisTerms) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={isDark ? '#10b981' : '#059669'} />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  if (!analysisTerms || analysisTerms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <FileText size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
        <Text style={styles.emptyText}>{t('term.noTermsExtracted')}</Text>
      </View>
    );
  }

  const renderTerm = (term: FrontendAnalysisTerm, index: number) => {
    const isExpanded = expandedTermId === term.term_id;
    const isEditing = editingTermId === term.term_id;
    const isEffectivelyCompliant = term.expert_override_is_valid_sharia ?? (term.isUserConfirmed ? (term.isReviewedSuggestionValid ?? true) : term.is_valid_sharia) ?? false;
    const textInSuggestionOrEditBox = isEditing ? currentEditText : (term.userModifiedText ?? term.reviewedSuggestion ?? term.modified_term ?? "");

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
          <Animated.View 
            style={styles.termContent}
            entering={() => ({
              transform: [{ scale: 0.95 }],
              opacity: 0,
            })}
            animate={{
              transform: [{ scale: 1 }],
              opacity: 1,
            }}
          >
            <Text style={styles.sectionTitle}>{t('term.fullText')}</Text>
            <Text style={styles.sectionText}>{term.term_text}</Text>

            {!isEffectivelyCompliant && term.sharia_issue && (
              <View style={styles.issueBox}>
                <AlertCircle size={16} color="#ef4444" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueTitle}>{t('term.why')}</Text>
                  <Text style={styles.issueText}>{term.sharia_issue}</Text>
                </View>
              </View>
            )}

            {/* Reference number display */}
            {term.reference_number && (
              <View style={styles.referenceBox}>
                <Text style={styles.referenceTitle}>{t('term.reference')}</Text>
                <Text style={styles.referenceText}>{term.reference_number}</Text>
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
            ) : textInSuggestionOrEditBox ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>{t('term.suggestion')}</Text>
                <Text style={styles.suggestionText}>{textInSuggestionOrEditBox}</Text>
                <View style={styles.buttonGroup}>
                  <Button 
                    onPress={() => handleConfirmChanges(term)} 
                    disabled={isTermProcessing && isTermProcessing[term.term_id]}
                  >
                    {isTermProcessing && isTermProcessing[term.term_id] ? 
                      <ActivityIndicator color="#fff" size="small" /> : 
                      <ThumbsUp size={16} color="#fff" />
                    }
                    <Text style={styles.buttonTextPrimary}>{t('button.confirm')}</Text>
                  </Button>
                  <Button variant="outline" onPress={() => handleEditSuggestion(term)}>
                    <Edit3 size={16} color={isDark ? '#d1d5db' : '#374151'} />
                    <Text style={styles.buttonText}>{t('term.editSuggestion')}</Text>
                  </Button>
                </View>
              </View>
            ) : null}

            <View style={styles.questionSection}>
              <Textarea 
                placeholder={t('term.questionPlaceholder')} 
                value={termQuestions[term.term_id] || ''} 
                onChangeText={(val) => setTermQuestions(p => ({...p, [term.term_id]: val}))}
                style={styles.textareaStyle}
              />
              <Button 
                style={{ marginTop: 8 }} 
                onPress={() => handleSendQuestion(term.term_id)} 
                disabled={isTermProcessing && isTermProcessing[term.term_id] || !termQuestions[term.term_id]}
              >
                {isTermProcessing && isTermProcessing[term.term_id] ? 
                  <ActivityIndicator color="#fff" size="small" /> : 
                  <Send size={16} color="#fff" />
                }
                <Text style={styles.buttonTextPrimary}>{t('button.send')}</Text>
              </Button>
              
              {term.currentQaAnswer && (
                <View style={styles.answerContainer}>
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
            </View>

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
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {isAskingQuestion && <QuestionAnimation isVisible={isAskingQuestion} />}
      {isProcessingGeneralQuestion && <QuestionAnimation isVisible={isProcessingGeneralQuestion} />}
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
          <TouchableOpacity 
            style={[
              styles.userRoleButton, 
              { 
                backgroundColor: currentUserRole === 'shariah_expert' ? '#f59e0b' : '#10b981',
                shadowColor: currentUserRole === 'shariah_expert' ? '#f59e0b' : '#10b981',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              }
            ]}
            onPress={toggleUserRole}
            activeOpacity={0.8}
          >
            {currentUserRole === 'shariah_expert' ? 
              <ExpertIcon size={16} color="#fff" /> : 
              <User size={16} color="#fff" />
            }
            <Text style={styles.userRoleText}>
              {currentUserRole === 'shariah_expert' ? t('user.expert') : t('user.regular')}
            </Text>
          </TouchableOpacity>
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
        {filteredTerms.length > 0 ? (
          filteredTerms.map((term, index) => renderTerm(term, index))
        ) : (
          <View style={styles.emptyContainer}>
            <FileText size={48} color={isDark ? '#6b7280' : '#9ca3af'} />
            <Text style={styles.emptyText}>{t('term.noTermsForFilter')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.generationSection}>
        <Text style={styles.sectionTitle}>{t('contract.reviewContract')}</Text>
        <Text style={styles.sectionDescription}>{t('contract.generateInfo')}</Text>
        
        <View style={styles.buttonContainer}>
          <Button 
            onPress={() => handleGenerateContract('modified')} 
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
              onPress={() => openPreview('modified')} 
              variant="outline" 
              style={styles.previewButton}
            >
              <Eye size={16} color={isDark ? '#fff' : '#000'} />
            </Button>
          )}
        </View>
        
        <View style={styles.buttonContainer}>
          <Button 
            onPress={() => handleGenerateContract('marked')} 
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
              onPress={() => openPreview('marked')} 
              variant="outline" 
              style={styles.previewButton}
            >
              <Eye size={16} color={isDark ? '#fff' : '#000'} />
            </Button>
          )}
        </View>
      </View>
      
      <ContractPreviewModal 
        isVisible={isPreviewModalVisible}
        onClose={() => setIsPreviewModalVisible(false)}
        fileType={previewFileType}
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
    userRoleButton: { 
      flexDirection: isRTL ? 'row-reverse' : 'row', 
      alignItems: 'center', 
      paddingHorizontal: 16, 
      paddingVertical: 10, 
      borderRadius: 25, 
      gap: 8 
    },
    userRoleText: { 
      color: '#fff', 
      fontSize: 13, 
      fontWeight: 'bold' 
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
      backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', 
      padding: 16, 
      borderRadius: 12, 
      marginTop: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#3b82f6'
    },
    referenceTitle: { 
      fontSize: 12, 
      fontWeight: 'bold', 
      color: isDark ? '#93c5fd' : '#1e40af', 
      marginBottom: 6, 
      textAlign: isRTL ? 'right' : 'left' 
    },
    referenceText: { 
      fontSize: 14, 
      color: isDark ? '#bfdbfe' : '#1e40af', 
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
      marginTop: 16 
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
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionDescription: { 
      fontSize: 14, 
      color: isDark ? '#9ca3af' : '#6b7280', 
      marginBottom: 20, 
      textAlign: isRTL ? 'right' : 'left',
      lineHeight: 20
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
      ...StyleSheet.absoluteFillObject, 
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
    answerTitle: { 
      fontSize: 14, 
      fontWeight: 'bold', 
      color: isDark ? '#93c5fd' : '#2563eb', 
      marginBottom: 12, 
      textAlign: isRTL ? 'right' : 'left' 
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
