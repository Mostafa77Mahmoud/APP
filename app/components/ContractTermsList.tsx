// app/components/ContractTermsList.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Modal } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession, FrontendAnalysisTerm } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { CheckCircle, AlertCircle, ChevronDown, MessageSquare, ThumbsUp, Edit3, Send, Sparkles, XCircle, FileCheck2, FileSearch, Eye, HelpCircle, RefreshCw, UserCheck as ExpertIcon } from 'lucide-react-native';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Tabs } from './ui/tabs';
import QuestionAnimation from './QuestionAnimation';
import ContractPreviewModal from './ContractPreviewModal';
import { Progress } from './ui/progress';

// A simple Radio Group component for the expert feedback form
const RadioGroup = ({ options, selectedValue, onValueChange, isRTL, styles }: { options: {label: string, value: string}[], selectedValue: string, onValueChange: (value: string) => void, isRTL: boolean, styles: any }) => {
    return (
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 16, marginVertical: 8 }}>
            {options.map(option => (
                <TouchableOpacity key={option.value} onPress={() => onValueChange(option.value)} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.radioOuter, selectedValue === option.value && styles.radioOuterSelected]}>
                        {selectedValue === option.value && <View style={styles.radioInner} />}
                    </View>
                    <Text style={styles.radioLabel}>{option.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const GeneratingContractAnimation: React.FC<{progress: number, type?: 'modified' | 'marked', styles: any}> = ({progress, type = 'modified', styles}) => {
    const { t } = useLanguage();
    const title = type === 'marked' ? t('term.generatingMarkedContract') : t('term.generatingContract');

    return (
        <View style={styles.animationOverlay}>
            <View style={styles.animationContainer}>
                <Text style={styles.animationTitle}>{title}</Text>
                <Progress value={progress} />
                <Text style={styles.animationPercentage}>{Math.round(progress)}%</Text>
            </View>
        </View>
    );
};


const ContractTermsList: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const {
    analysisTerms, isFetchingSession, isTermProcessing, isReviewingModification,
    askQuestionAboutTerm, reviewUserModification, confirmTermModification, isAskingQuestion,
    generateModifiedContract, generateMarkedContract, isGeneratingContract, isGeneratingMarkedContract,
    sessionId, sessionDetails, updateTermLocally, clearSession
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
  
  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

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

    const progressInterval = setInterval(() => {
        setGenerationVisualProgress(p => (p < 99 ? p + 2 : 99));
    }, 200);

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
    return <ActivityIndicator size="large" color={isDark ? '#10b981' : '#059669'} style={{ marginVertical: 40 }} />;
  }

  if (!analysisTerms || analysisTerms.length === 0) {
    return <Text style={styles.emptyText}>{t('term.noTermsExtracted')}</Text>;
  }

  const renderTerm = (term: FrontendAnalysisTerm) => {
    const isExpanded = expandedTermId === term.term_id;
    const isEditing = editingTermId === term.term_id;
    const isEffectivelyCompliant = term.expert_override_is_valid_sharia ?? (term.isUserConfirmed ? (term.isReviewedSuggestionValid ?? true) : term.is_valid_sharia) ?? false;
    const textInSuggestionOrEditBox = isEditing ? currentEditText : (term.userModifiedText ?? term.reviewedSuggestion ?? term.modified_term ?? "");

    return (
      <View key={term.term_id} style={styles.termCard}>
        <TouchableOpacity style={styles.termHeader} onPress={() => toggleTerm(term.term_id)}>
          <Text style={styles.termHeaderText} numberOfLines={3}>{term.term_text}</Text>
          <View style={styles.termHeaderRight}>
            <View style={[styles.tag, { backgroundColor: isEffectivelyCompliant ? '#10b981' : '#ef4444' }]}>
              <Text style={styles.tagText}>{t(isEffectivelyCompliant ? 'term.compliant' : 'term.non-compliant')}</Text>
            </View>
            <ChevronDown size={20} color={isDark ? '#9ca3af' : '#6b7280'} style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }} />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.termContent}>
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

            {isEditing ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>{t('term.editSuggestion')}</Text>
                <Textarea value={currentEditText} onChangeText={setCurrentEditText} />
                <View style={styles.buttonGroup}>
                  <Button variant="ghost" onPress={() => setEditingTermId(null)}><XCircle size={16} color={isDark ? '#d1d5db' : '#6b7280'} /><Text style={styles.buttonText}>{t('term.cancel')}</Text></Button>
                  <Button onPress={() => handleSaveAndReview(term.term_id)} disabled={isReviewingModification[term.term_id]}>
                    {isReviewingModification[term.term_id] ? <ActivityIndicator color="#fff" /> : <Sparkles size={16} color="#fff" />}
                    <Text style={styles.buttonTextPrimary}>{t('term.saveAndReview')}</Text>
                  </Button>
                </View>
              </View>
            ) : textInSuggestionOrEditBox ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.sectionTitle}>{t('term.suggestion')}</Text>
                <Text style={styles.suggestionText}>{textInSuggestionOrEditBox}</Text>
                <View style={styles.buttonGroup}>
                  <Button onPress={() => handleConfirmChanges(term)} disabled={isTermProcessing[term.term_id]}>
                    {isTermProcessing[term.term_id] ? <ActivityIndicator color="#fff" /> : <ThumbsUp size={16} color="#fff" />}
                    <Text style={styles.buttonTextPrimary}>{t('button.confirm')}</Text>
                  </Button>
                  <Button variant="outline" onPress={() => handleEditSuggestion(term)}><Edit3 size={16} color={isDark ? '#d1d5db' : '#374151'} /><Text style={styles.buttonText}>{t('term.editSuggestion')}</Text></Button>
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#e5e7eb', paddingTop: 16 }}>
              <Textarea placeholder={t('term.questionPlaceholder')} value={termQuestions[term.term_id] || ''} onChangeText={(val) => setTermQuestions(p => ({...p, [term.term_id]: val}))} />
              <Button style={{ marginTop: 8 }} onPress={() => handleSendQuestion(term.term_id)} disabled={isTermProcessing[term.term_id] || !termQuestions[term.term_id]}>
                {isTermProcessing[term.term_id] ? <ActivityIndicator color="#fff" /> : <Send size={16} color="#fff" />}
                <Text style={styles.buttonTextPrimary}>{t('button.send')}</Text>
              </Button>
              {term.currentQaAnswer && <Text style={styles.answerText}>{term.currentQaAnswer}</Text>}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {isAskingQuestion && <QuestionAnimation isVisible={isAskingQuestion} />}
      {generationType && <GeneratingContractAnimation progress={generationVisualProgress} type={generationType} styles={styles} />}
      
      <Text style={styles.title}>{t('contract.terms')}</Text>
      <Tabs
        tabs={[
          { value: 'all', label: t('filter.all') },
          { value: 'compliant', label: t('filter.compliant') },
          { value: 'non-compliant', label: t('filter.non-compliant') },
        ]}
        activeTab={activeFilter}
        onTabChange={setActiveFilter}
      />
      <ScrollView>
        {filteredTerms.length > 0 ? (
          filteredTerms.map(renderTerm)
        ) : (
          <Text style={styles.emptyText}>{t('term.noTermsForFilter')}</Text>
        )}
      </ScrollView>

      <View style={styles.generationSection}>
        <Text style={styles.sectionTitle}>{t('contract.reviewContract')}</Text>
        <Text style={styles.sectionDescription}>{t('contract.generateInfo')}</Text>
        <View style={styles.buttonContainer}>
            <Button onPress={() => handleGenerateContract('modified')} disabled={isGeneratingContract || isGeneratingMarkedContract} style={{flex: 1}}>
                {isGeneratingContract ? <ActivityIndicator color="#fff" /> : <FileCheck2 size={16} color="#fff" />}
                <Text style={styles.buttonTextPrimary}>{t('contract.generateButton')}</Text>
            </Button>
             {sessionDetails?.modified_contract_info && (
                <Button onPress={() => openPreview('modified')} variant="outline" style={{marginLeft: 10}}>
                    <Eye size={16} color={isDark ? '#fff' : '#000'} />
                </Button>
            )}
        </View>
        <View style={styles.buttonContainer}>
            <Button onPress={() => handleGenerateContract('marked')} disabled={isGeneratingContract || isGeneratingMarkedContract} variant="secondary" style={{flex: 1}}>
                {isGeneratingMarkedContract ? <ActivityIndicator color={isDark ? '#fff' : '#000'} /> : <FileSearch size={16} color={isDark ? '#fff' : '#000'} />}
                <Text style={styles.buttonText}>{t('contract.generateMarkedButton')}</Text>
            </Button>
            {sessionDetails?.marked_contract_info && (
                <Button onPress={() => openPreview('marked')} variant="outline" style={{marginLeft: 10}}>
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
    </View>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
    container: { padding: 16, flex: 1 },
    title: { fontSize: 22, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827', marginBottom: 16, textAlign: isRTL ? 'right' : 'left' },
    termCard: { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: isDark ? '#374151' : '#e5e7eb' },
    termHeader: { padding: 16, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
    termHeaderText: { flex: 1, fontSize: 15, fontWeight: '600', color: isDark ? '#f9fafb' : '#374151', lineHeight: 22, textAlign: isRTL ? 'right' : 'left' },
    termHeaderRight: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    tagText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    termContent: { padding: 16, borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#e5e7eb' },
    sectionTitle: { fontSize: 12, fontWeight: 'bold', color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'uppercase', marginBottom: 8, textAlign: isRTL ? 'right' : 'left' },
    sectionText: { fontSize: 16, color: isDark ? '#d1d5db' : '#374151', lineHeight: 24, textAlign: isRTL ? 'right' : 'left' },
    issueBox: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, backgroundColor: isDark ? '#4b1d1d' : '#fee2e2', padding: 12, borderRadius: 8, marginTop: 12 },
    issueTitle: { fontSize: 14, fontWeight: 'bold', color: isDark ? '#fca5a5' : '#b91c1c', marginBottom: 4, textAlign: isRTL ? 'right' : 'left' },
    issueText: { fontSize: 14, color: isDark ? '#fecaca' : '#dc2626', lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
    suggestionText: { fontSize: 16, color: isDark ? '#bfdbfe' : '#1e40af', lineHeight: 24, backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', padding: 12, borderRadius: 8, textAlign: isRTL ? 'right' : 'left' },
    buttonGroup: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginTop: 16 },
    buttonText: { color: isDark ? '#d1d5db' : '#374151', marginLeft: 8, fontWeight: '500' },
    buttonTextPrimary: { color: '#fff', marginLeft: 8, fontWeight: '500' },
    answerText: { marginTop: 12, padding: 12, backgroundColor: isDark ? '#1e3a8a' : '#dbeafe', borderRadius: 8, color: isDark ? '#bfdbfe' : '#1e40af', fontSize: 14, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' },
    emptyText: { textAlign: 'center', color: isDark ? '#9ca3af' : '#6b7280', paddingVertical: 40, fontSize: 16 },
    generationSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#e5e7eb', },
    sectionDescription: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 16, textAlign: isRTL ? 'right' : 'left', },
    buttonContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, },
    radioOuter: { height: 20, width: 20, borderRadius: 10, borderWidth: 2, borderColor: '#10b981', alignItems: 'center', justifyContent: 'center', },
    radioOuterSelected: { borderColor: '#10b981', },
    radioInner: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#10b981', },
    radioLabel: { color: isDark ? '#f9fafb' : '#111827', fontSize: 14 },
    animationOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1001, },
    animationContainer: { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderRadius: 12, padding: 24, width: '80%', },
    animationTitle: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827', textAlign: 'center', marginBottom: 16, },
    animationPercentage: { fontSize: 14, fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', textAlign: 'center', marginTop: 8, },
});

export default ContractTermsList;
