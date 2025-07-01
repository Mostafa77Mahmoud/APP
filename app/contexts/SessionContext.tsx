// app/contexts/SessionContext.tsx
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../services/api';
import type { SessionDetailsApiResponse, GenerateModifiedContractApiResponse, GenerateMarkedContractApiResponse, ApiAnalysisTerm, ExpertFeedbackPayload, CloudinaryFileInfo } from '../services/api';

const SESSIONS_STORAGE_KEY = 'shariaa_sessions_history';

// --- Type Definitions ---
export type UserRole = 'regular_user' | 'shariah_expert';
export interface FrontendAnalysisTerm extends ApiAnalysisTerm {
  isUserConfirmed?: boolean;
  userModifiedText?: string | null;
  currentQaAnswer?: string | null;
  reviewedSuggestion?: string | null;
  isReviewedSuggestionValid?: boolean | null;
  reviewedSuggestionIssue?: string | null;
}
export interface SessionDetails extends SessionDetailsApiResponse {}
interface ComplianceStats {
  totalTerms: number;
  currentUserEffectiveCompliantCount: number;
  currentUserEffectiveNonCompliantCount: number;
  overallCompliancePercentage: number;
}

interface SessionContextType {
  sessionId: string | null;
  analysisTerms: FrontendAnalysisTerm[] | null;
  complianceStats: ComplianceStats | null;
  sessionDetails: SessionDetails | null;
  currentUserRole: UserRole;
  toggleUserRole: () => void;
  isUploading: boolean;
  uploadProgress: number;
  isAnalyzingContract: boolean;
  isFetchingSession: boolean;
  isTermProcessing: Record<string, boolean>;
  isGeneratingContract: boolean;
  isGeneratingMarkedContract: boolean;
  isAskingQuestion: boolean;
  isReviewingModification: Record<string, boolean>;
  isProcessingGeneralQuestion: boolean;
  error: string | null;
  uploadError: string | null;
  analysisError: string | null;
  uploadAndAnalyzeContract: (file: any) => Promise<string | null>;
  askQuestionAboutTerm: (termId: string, question: string) => Promise<string | null>;
  askGeneralContractQuestion: (question: string) => Promise<string | null>;
  reviewUserModification: (termId: string, userTextToReview: string, originalTermText: string) => Promise<boolean>;
  confirmTermModification: (termId: string, textToConfirm: string) => Promise<boolean>;
  generateModifiedContract: () => Promise<GenerateModifiedContractApiResponse | null>;
  generateMarkedContract: () => Promise<GenerateMarkedContractApiResponse | null>;
  submitExpertFeedback: (payload: ExpertFeedbackPayload) => Promise<boolean>;
  loadSessionFromHistory: (session: SessionDetailsApiResponse) => void;
  clearSession: () => void;
  getLocalSessions: () => Promise<SessionDetailsApiResponse[]>;
  deleteLocalSession: (sessionId: string) => Promise<void>;
  updateTermLocally: (params: Partial<FrontendAnalysisTerm> & { term_id: string }) => void;
  updatePdfPreviewInfo: (type: 'modified' | 'marked', pdfInfo: CloudinaryFileInfo) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [analysisTerms, setAnalysisTerms] = useState<FrontendAnalysisTerm[] | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('regular_user');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnalyzingContract, setIsAnalyzingContract] = useState(false);
  const [isFetchingSession, setIsFetchingSession] = useState(false);
  const [isTermProcessing, setIsTermProcessing] = useState<Record<string, boolean>>({});
  const [isGeneratingContract, setIsGeneratingContract] = useState(false);
  const [isGeneratingMarkedContract, setIsGeneratingMarkedContract] = useState(false);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [isReviewingModification, setIsReviewingModification] = useState<Record<string, boolean>>({});
  const [isProcessingGeneralQuestion, setIsProcessingGeneralQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const toggleUserRole = useCallback(() => {
    setCurrentUserRole(prev => prev === 'regular_user' ? 'shariah_expert' : 'regular_user');
  }, []);

  const getLocalSessions = async (): Promise<SessionDetailsApiResponse[]> => {
    try {
      const sessions = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
      return sessions ? JSON.parse(sessions) : [];
    } catch (e) {
      console.error('Failed to get local sessions:', e);
      return [];
    }
  };

  const saveSessionLocally = async (sessionData: SessionDetailsApiResponse) => {
    try {
      const sessions = await getLocalSessions();
      const updatedSessions = [sessionData, ...sessions.filter(s => s.session_id !== sessionData.session_id)].slice(0, 50);
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (e) {
      console.error('Failed to save session locally:', e);
    }
  };

  const deleteLocalSession = async (sessionIdToDelete: string) => {
    try {
      const sessions = await getLocalSessions();
      const updatedSessions = sessions.filter(s => s.session_id !== sessionIdToDelete);
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (e) {
      console.error('Failed to delete local session:', e);
    }
  };

  const clearSession = useCallback(() => {
    setSessionId(null);
    setAnalysisTerms(null);
    setSessionDetails(null);
    setIsUploading(false);
    setUploadProgress(0);
    setIsAnalyzingContract(false);
    setIsFetchingSession(false);
    setIsTermProcessing({});
    setIsGeneratingContract(false);
    setIsGeneratingMarkedContract(false);
    setIsAskingQuestion(false);
    setIsReviewingModification({});
    setIsProcessingGeneralQuestion(false);
    setError(null);
    setUploadError(null);
    setAnalysisError(null);
  }, []);

  const loadSessionData = useCallback(async (sid: string) => {
    setIsFetchingSession(true);
    setError(null);
    try {
      const [sessionData, termsData] = await Promise.all([api.getSessionDetails(sid), api.getSessionTerms(sid)]);
      setSessionId(sessionData.session_id);
      setSessionDetails(sessionData);
      setAnalysisTerms(termsData);
      await saveSessionLocally(sessionData);
    } catch (err: any) {
      setError(err.message || "Failed to load session.");
      Alert.alert("Session Load Error", err.message || "Failed to load session.");
      clearSession();
    } finally {
      setIsFetchingSession(false);
    }
  }, [clearSession]);

  const uploadAndAnalyzeContract = async (file: any): Promise<string | null> => {
    clearSession();
    setIsUploading(true);
    setUploadProgress(0);
    setIsAnalyzingContract(true);
    setError(null);
    setUploadError(null);
    setAnalysisError(null);
    try {
      const response = await api.uploadContract(file, setUploadProgress);
      await loadSessionData(response.session_id);
      return response.session_id;
    } catch (err: any) {
      const message = err.message || "Failed to upload or analyze contract.";
      setAnalysisError(message);
      setError(message);
      Alert.alert("Analysis Error", message);
      return null;
    } finally {
      setIsUploading(false);
      setIsAnalyzingContract(false);
      setUploadProgress(0);
    }
  };
  
  const updateTermLocally = useCallback((params: Partial<FrontendAnalysisTerm> & { term_id: string }) => {
    setAnalysisTerms(prev => prev ? prev.map(t => t.term_id === params.term_id ? { ...t, ...params } : t) : null);
  }, []);

  const updatePdfPreviewInfo = useCallback((type: 'modified' | 'marked', pdfInfo: CloudinaryFileInfo) => {
    setSessionDetails(prev => {
        if (!prev) return null;
        return {
            ...prev,
            pdf_preview_info: {
                ...prev.pdf_preview_info,
                [type]: pdfInfo,
            },
        };
    });
  }, []);

  const askQuestionAboutTerm = async (termId: string, question: string): Promise<string | null> => {
    if (!sessionId || !analysisTerms) return null;
    const term = analysisTerms.find(t => t.term_id === termId);
    if (!term) return null;
    
    setIsAskingQuestion(true);
    setIsTermProcessing(prev => ({ ...prev, [termId]: true }));
    try {
      const answer = await api.askQuestion(sessionId, question, termId, term.term_text);
      updateTermLocally({ term_id: termId, currentQaAnswer: answer });
      return answer;
    } catch (err: any) {
      Alert.alert("Interaction Error", err.message);
      return null;
    } finally {
      setIsAskingQuestion(false);
      setIsTermProcessing(prev => ({ ...prev, [termId]: false }));
    }
  };
  
  const askGeneralContractQuestion = async (question: string): Promise<string | null> => {
    if (!sessionId) return null;
    setIsProcessingGeneralQuestion(true);
    setIsAskingQuestion(true);
    try {
      return await api.askQuestion(sessionId, question);
    } catch (err: any) {
      Alert.alert("Interaction Error", err.message);
      return null;
    } finally {
      setIsProcessingGeneralQuestion(false);
      setIsAskingQuestion(false);
    }
  };

  const reviewUserModification = async (termId: string, userTextToReview: string, originalTermText: string): Promise<boolean> => {
    if (!sessionId) return false;
    setIsReviewingModification(prev => ({ ...prev, [termId]: true }));
    try {
      const reviewResponse = await api.reviewUserModification(sessionId, termId, userTextToReview, originalTermText);
      updateTermLocally({
        term_id: termId,
        userModifiedText: reviewResponse.reviewed_text,
        reviewedSuggestion: reviewResponse.reviewed_text,
        isReviewedSuggestionValid: reviewResponse.is_still_valid_sharia,
        reviewedSuggestionIssue: reviewResponse.new_sharia_issue || null,
        isUserConfirmed: false,
      });
      return true;
    } catch (err: any) {
      Alert.alert("Review Error", err.message);
      return false;
    } finally {
      setIsReviewingModification(prev => ({ ...prev, [termId]: false }));
    }
  };

  const confirmTermModification = async (termId: string, textToConfirm: string): Promise<boolean> => {
    if (!sessionId) return false;
    setIsTermProcessing(prev => ({ ...prev, [termId]: true }));
    try {
      await api.confirmTermModification(sessionId, termId, textToConfirm);
      updateTermLocally({ term_id: termId, isUserConfirmed: true, userModifiedText: textToConfirm });
      return true;
    } catch (err: any) {
      Alert.alert("Confirmation Error", err.message);
      return false;
    } finally {
      setIsTermProcessing(prev => ({ ...prev, [termId]: false }));
    }
  };

  const generateModifiedContract = async (): Promise<GenerateModifiedContractApiResponse | null> => {
    if (!sessionId) return null;
    setIsGeneratingContract(true);
    try {
      const response = await api.generateModifiedContract(sessionId);
      if (response.success) {
        setSessionDetails(prev => prev ? ({...prev, modified_contract_info: { docx_cloudinary_info: { url: response.modified_docx_cloudinary_url, public_id: '', format: 'docx' } }}) : null);
      }
      return response;
    } catch (err: any) {
      Alert.alert("Generation Error", err.message);
      return null;
    } finally {
      setIsGeneratingContract(false);
    }
  };

  const generateMarkedContract = async (): Promise<GenerateMarkedContractApiResponse | null> => {
    if (!sessionId) return null;
    setIsGeneratingMarkedContract(true);
    try {
      const response = await api.generateMarkedContract(sessionId);
       if (response.success) {
        setSessionDetails(prev => prev ? ({...prev, marked_contract_info: { docx_cloudinary_info: { url: response.marked_docx_cloudinary_url, public_id: '', format: 'docx' } }}) : null);
      }
      return response;
    } catch (err: any) {
      Alert.alert("Generation Error", err.message);
      return null;
    } finally {
      setIsGeneratingMarkedContract(false);
    }
  };

  const submitExpertFeedback = async (payload: ExpertFeedbackPayload): Promise<boolean> => {
    if (!sessionId) return false;
    try {
      await api.submitExpertFeedback(payload);
      updateTermLocally({
        term_id: payload.term_id,
        has_expert_feedback: true,
        expert_override_is_valid_sharia: payload.feedback_data.expertIsValidSharia
      });
      return true;
    } catch (err: any) {
      Alert.alert("Feedback Error", err.message);
      return false;
    }
  };

  const loadSessionFromHistory = (sessionToLoad: SessionDetailsApiResponse) => {
    setSessionId(sessionToLoad.session_id);
    setSessionDetails(sessionToLoad);
    setAnalysisTerms(sessionToLoad.analysis_results.map(term => ({ ...term })));
  };

  const complianceStats: ComplianceStats | null = useMemo(() => {
    if (!analysisTerms) return null;
    const totalTerms = analysisTerms.length;
    if (totalTerms === 0) return { totalTerms: 0, currentUserEffectiveCompliantCount: 0, currentUserEffectiveNonCompliantCount: 0, overallCompliancePercentage: 0 };
    const compliantCount = analysisTerms.filter(t => t.expert_override_is_valid_sharia ?? (t.isUserConfirmed ? (t.isReviewedSuggestionValid ?? true) : t.is_valid_sharia)).length;
    return { totalTerms, currentUserEffectiveCompliantCount: compliantCount, currentUserEffectiveNonCompliantCount: totalTerms - compliantCount, overallCompliancePercentage: (compliantCount / totalTerms) * 100 };
  }, [analysisTerms]);

  return (
    <SessionContext.Provider value={{
      sessionId, analysisTerms, complianceStats, sessionDetails, currentUserRole, toggleUserRole, isUploading, uploadProgress, isAnalyzingContract, isFetchingSession, isTermProcessing, isGeneratingContract, isGeneratingMarkedContract, isAskingQuestion, isReviewingModification, isProcessingGeneralQuestion, error, uploadError, analysisError,
      uploadAndAnalyzeContract,
      askQuestionAboutTerm,
      askGeneralContractQuestion,
      reviewUserModification,
      confirmTermModification,
      generateModifiedContract,
      generateMarkedContract,
      submitExpertFeedback,
      loadSessionFromHistory,
      clearSession,
      getLocalSessions,
      deleteLocalSession,
      updateTermLocally,
      updatePdfPreviewInfo,
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) throw new Error('useSession must be used within a SessionProvider');
  return context;
};
export default useSession;
export { SessionContext,  ComplianceStats, SESSIONS_STORAGE_KEY } 