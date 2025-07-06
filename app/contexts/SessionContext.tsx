import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as api from '../services/api';
import type { SessionDetailsApiResponse, GenerateModifiedContractApiResponse, GenerateMarkedContractApiResponse, ApiAnalysisTerm, ExpertFeedbackPayload, CloudinaryFileInfo } from '../services/api';

const SESSIONS_STORAGE_KEY = 'shariaa_sessions_history';
const USER_ROLE_STORAGE_KEY = 'shariaa_user_role';
const SESSION_INTERACTIONS_KEY = 'shariaa_session_interactions';

// --- Type Definitions ---
export type UserRole = 'regular_user' | 'shariah_expert';

export interface SessionInteraction {
  sessionId: string;
  timestamp: string;
  type: 'question_asked' | 'term_modified' | 'contract_generated' | 'expert_feedback';
  termId?: string;
  data?: any;
}

export interface FrontendAnalysisTerm extends ApiAnalysisTerm {
  isUserConfirmed?: boolean;
  userModifiedText?: string | null;
  currentQaAnswer?: string | null;
  reviewedSuggestion?: string | null;
  isReviewedSuggestionValid?: boolean | null;
  reviewedSuggestionIssue?: string | null;
  expertFeedbackHistory?: ExpertFeedbackPayload[];
  lastModified?: string;
  interactionCount?: number;
}

export interface SessionDetails extends SessionDetailsApiResponse {
  totalInteractions?: number;
  lastInteractionTime?: string;
  isBookmarked?: boolean;
}

interface ComplianceStats {
  totalTerms: number;
  currentUserEffectiveCompliantCount: number;
  currentUserEffectiveNonCompliantCount: number;
  overallCompliancePercentage: number;
  expertReviewedTerms: number;
  userModifiedTerms: number;
}

interface SessionContextType {
  sessionId: string | null;
  analysisTerms: FrontendAnalysisTerm[] | null;
  complianceStats: ComplianceStats | null;
  sessionDetails: SessionDetails | null;
  currentUserRole: UserRole;
  sessionInteractions: SessionInteraction[];
  selectedSessionId: string | null;
  loadSessionData: (sessionId: string) => Promise<void>;
  toggleUserRole: () => void;
  setUserRole: (role: UserRole) => void;
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
  addInteraction: (interaction: Omit<SessionInteraction, 'sessionId' | 'timestamp'>) => void;
  getSessionInteractions: (sessionId: string) => SessionInteraction[];
  bookmarkSession: (sessionId: string) => void;
  getSessionStats: () => Promise<any>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [analysisTerms, setAnalysisTerms] = useState<FrontendAnalysisTerm[] | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('regular_user');
  const [sessionInteractions, setSessionInteractions] = useState<SessionInteraction[]>([]);

  // Loading states
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

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Initialize user role from storage
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem(USER_ROLE_STORAGE_KEY);
        if (storedRole) {
          setCurrentUserRole(storedRole as UserRole);
        }
      } catch (error) {
        console.error('Failed to load user role:', error);
      }
    };

    const loadInteractions = async () => {
      try {
        const storedInteractions = await AsyncStorage.getItem(SESSION_INTERACTIONS_KEY);
        if (storedInteractions) {
          setSessionInteractions(JSON.parse(storedInteractions));
        }
      } catch (error) {
        console.error('Failed to load interactions:', error);
      }
    };

    loadUserRole();
    loadInteractions();
  }, []);

  const setUserRole = useCallback(async (role: UserRole) => {
    try {
      setCurrentUserRole(role);
      await AsyncStorage.setItem(USER_ROLE_STORAGE_KEY, role);
    } catch (error) {
      console.error('Failed to save user role:', error);
    }
  }, []);

  const toggleUserRole = useCallback(() => {
    const newRole = currentUserRole === 'regular_user' ? 'shariah_expert' : 'regular_user';
    setUserRole(newRole);
  }, [currentUserRole, setUserRole]);

  const addInteraction = useCallback(async (interaction: Omit<SessionInteraction, 'sessionId' | 'timestamp'>) => {
    if (!sessionId) return;

    const newInteraction: SessionInteraction = {
      ...interaction,
      sessionId,
      timestamp: new Date().toISOString(),
    };

    const updatedInteractions = [newInteraction, ...sessionInteractions];
    setSessionInteractions(updatedInteractions);

    try {
      await AsyncStorage.setItem(SESSION_INTERACTIONS_KEY, JSON.stringify(updatedInteractions));
    } catch (error) {
      console.error('Failed to save interaction:', error);
    }
  }, [sessionId, sessionInteractions]);

  const getSessionInteractions = useCallback((sessionId: string): SessionInteraction[] => {
    return sessionInteractions.filter(interaction => interaction.sessionId === sessionId);
  }, [sessionInteractions]);

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
      const existingIndex = sessions.findIndex(s => s.session_id === sessionData.session_id);

      let updatedSessions;
      if (existingIndex >= 0) {
        // Update existing session
        updatedSessions = [...sessions];
        updatedSessions[existingIndex] = {
          ...updatedSessions[existingIndex],
          ...sessionData,
          totalInteractions: getSessionInteractions(sessionData.session_id).length,
          lastInteractionTime: new Date().toISOString(),
        };
      } else {
        // Add new session
        updatedSessions = [sessionData, ...sessions];
      }

      // Keep only the latest 50 sessions
      updatedSessions = updatedSessions.slice(0, 50);
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

      // Also remove interactions for this session
      const updatedInteractions = sessionInteractions.filter(i => i.sessionId !== sessionIdToDelete);
      setSessionInteractions(updatedInteractions);
      await AsyncStorage.setItem(SESSION_INTERACTIONS_KEY, JSON.stringify(updatedInteractions));
    } catch (e) {
      console.error('Failed to delete local session:', e);
    }
  };

  const bookmarkSession = async (sessionId: string) => {
    try {
      const sessions = await getLocalSessions();
      const updatedSessions = sessions.map(s => 
        s.session_id === sessionId 
          ? { ...s, isBookmarked: !s.isBookmarked }
          : s
      );
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Failed to bookmark session:', error);
    }
  };

  const clearSession = useCallback(async () => {
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

    // Clear persisted session data
    try {
      await AsyncStorage.multiRemove([
        'current_session_id',
        'current_analysis_terms', 
        'current_session_details'
      ]);
    } catch (error) {
      console.error('Failed to clear persisted session data:', error);
    }
  }, []);

  const loadSessionData = useCallback(async (sid: string) => {
    setIsFetchingSession(true);
    setError(null);
    console.log('SessionContext: Loading session data for', sid);
    try {
      const [sessionData, termsData] = await Promise.all([
        api.getSessionDetails(sid), 
        api.getSessionTerms(sid)
      ]);

      console.log('SessionContext: Received data', {
        sessionId: sessionData.session_id,
        termsCount: termsData?.length,
        sampleTerm: termsData?.[0]
      });

      // Enrich terms with interaction data
      const enrichedTerms = termsData.map(term => ({
        ...term,
        interactionCount: getSessionInteractions(sid).filter(i => i.termId === term.term_id).length,
        lastModified: getSessionInteractions(sid)
          .filter(i => i.termId === term.term_id && i.type === 'term_modified')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp,
      }));

      console.log('SessionContext: Setting enriched terms', {
        originalCount: termsData?.length,
        enrichedCount: enrichedTerms?.length,
        enrichedSample: enrichedTerms?.[0]
      });

      setSessionId(sessionData.session_id);
      setSelectedSessionId(sessionData.session_id);
      setSessionDetails({
        ...sessionData,
        totalInteractions: getSessionInteractions(sid).length,
        lastInteractionTime: getSessionInteractions(sid)[0]?.timestamp,
      });
      setAnalysisTerms(enrichedTerms);
      await saveSessionLocally(sessionData);
    } catch (err: any) {
      console.error('SessionContext: Error loading session', err);
      setError(err.message || "Failed to load session.");
      Alert.alert("Session Load Error", err.message || "Failed to load session.");
      clearSession();
    } finally {
      setIsFetchingSession(false);
    }
  }, [clearSession, getSessionInteractions]);

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

      // Add upload interaction
      await addInteraction({
        type: 'question_asked',
        data: { action: 'contract_uploaded', filename: file.name }
      });

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
    setAnalysisTerms(prev => prev ? prev.map(t => 
      t.term_id === params.term_id 
        ? { 
            ...t, 
            ...params,
            lastModified: new Date().toISOString(),
            interactionCount: (t.interactionCount || 0) + 1,
          } 
        : t
    ) : null);
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

      // Add interaction
      await addInteraction({
        type: 'question_asked',
        termId,
        data: { question, answer }
      });

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
      const answer = await api.askQuestion(sessionId, question);

      // Add interaction
      await addInteraction({
        type: 'question_asked',
        data: { question, answer, type: 'general' }
      });

      return answer;
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

      // Add interaction
      await addInteraction({
        type: 'term_modified',
        termId,
        data: { 
          originalText: originalTermText,
          reviewedText: reviewResponse.reviewed_text,
          isValid: reviewResponse.is_still_valid_sharia
        }
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
      updateTermLocally({ 
        term_id: termId, 
        isUserConfirmed: true, 
        userModifiedText: textToConfirm 
      });

      // Add interaction
      await addInteraction({
        type: 'term_modified',
        termId,
        data: { confirmedText: textToConfirm, action: 'confirmed' }
      });

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
        setSessionDetails(prev => prev ? ({
          ...prev, 
          modified_contract_info: { 
            docx_cloudinary_info: { 
              url: response.modified_docx_cloudinary_url, 
              public_id: '', 
              format: 'docx' 
            } 
          }
        }) : null);

        // Add interaction
        await addInteraction({
          type: 'contract_generated',
          data: { type: 'modified', success: true }
        });
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
        setSessionDetails(prev => prev ? ({
          ...prev, 
          marked_contract_info: { 
            docx_cloudinary_info: { 
              url: response.marked_docx_cloudinary_url, 
              public_id: '', 
              format: 'docx' 
            } 
          }
        }) : null);

        // Add interaction
        await addInteraction({
          type: 'contract_generated',
          data: { type: 'marked', success: true }
        });
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
        expert_override_is_valid_sharia: payload.feedback_data.expertIsValidSharia,
        expertFeedbackHistory: [
          ...(analysisTerms?.find(t => t.term_id === payload.term_id)?.expertFeedbackHistory || []),
          payload
        ]
      });

      // Add interaction
      await addInteraction({
        type: 'expert_feedback',
        termId: payload.term_id,
        data: payload.feedback_data
      });

      return true;
    } catch (err: any) {
      Alert.alert("Feedback Error", err.message);
      return false;
    }
  };

  const loadSessionFromHistory = (sessionToLoad: SessionDetailsApiResponse) => {
    setSessionId(sessionToLoad.session_id);
    setSessionDetails({
      ...sessionToLoad,
      totalInteractions: getSessionInteractions(sessionToLoad.session_id).length,
    });

    const enrichedTerms = sessionToLoad.analysis_results.map(term => ({
      ...term,
      interactionCount: getSessionInteractions(sessionToLoad.session_id).filter(i => i.termId === term.term_id).length,
    }));

    setAnalysisTerms(enrichedTerms);
  };

  const getSessionStats = async () => {
    try {
      return await api.getStats();
    } catch (error) {
      console.error('Failed to get session stats:', error);
      return null;
    }
  };

  const complianceStats: ComplianceStats | null = useMemo(() => {
    if (!analysisTerms) return null;

    const totalTerms = analysisTerms.length;
    if (totalTerms === 0) {
      return { 
        totalTerms: 0, 
        currentUserEffectiveCompliantCount: 0, 
        currentUserEffectiveNonCompliantCount: 0, 
        overallCompliancePercentage: 0,
        expertReviewedTerms: 0,
        userModifiedTerms: 0,
      };
    }

    const compliantCount = analysisTerms.filter(t => 
      t.expert_override_is_valid_sharia ?? 
      (t.isUserConfirmed ? (t.isReviewedSuggestionValid ?? true) : t.is_valid_sharia)
    ).length;

    const expertReviewedTerms = analysisTerms.filter(t => t.has_expert_feedback).length;
    const userModifiedTerms = analysisTerms.filter(t => t.isUserConfirmed).length;

    return { 
      totalTerms, 
      currentUserEffectiveCompliantCount: compliantCount, 
      currentUserEffectiveNonCompliantCount: totalTerms - compliantCount, 
      overallCompliancePercentage: (compliantCount / totalTerms) * 100,
      expertReviewedTerms,
      userModifiedTerms,
    };
  }, [analysisTerms]);

  // Persist session data
  useEffect(() => {
    const saveSessionData = async () => {
      if (sessionId && analysisTerms) {
        try {
          await AsyncStorage.setItem('current_session_id', sessionId);
          await AsyncStorage.setItem('current_analysis_terms', JSON.stringify(analysisTerms));
          if (sessionDetails) {
            await AsyncStorage.setItem('current_session_details', JSON.stringify(sessionDetails));
          }
        } catch (error) {
          console.error('Failed to save session data:', error);
        }
      }
    };

    saveSessionData();
  }, [sessionId, analysisTerms, sessionDetails]);

  // Restore session data on app start
  useEffect(() => {
    const restoreSessionData = async () => {
      try {
        const savedSessionId = await AsyncStorage.getItem('current_session_id');
        const savedAnalysisTerms = await AsyncStorage.getItem('current_analysis_terms');
        const savedSessionDetails = await AsyncStorage.getItem('current_session_details');

        if (savedSessionId && savedAnalysisTerms) {
          setSessionId(savedSessionId);
          setAnalysisTerms(JSON.parse(savedAnalysisTerms));
          if (savedSessionDetails) {
            setSessionDetails(JSON.parse(savedSessionDetails));
          }
        }
      } catch (error) {
        console.error('Failed to restore session data:', error);
      }
    };

    restoreSessionData();
  }, []);

  return (
    <SessionContext.Provider value={{
      sessionId, 
      selectedSessionId,
      loadSessionData,
      analysisTerms, 
      complianceStats, 
      sessionDetails, 
      currentUserRole, 
      sessionInteractions,
      toggleUserRole,
      setUserRole,
      isUploading, 
      uploadProgress, 
      isAnalyzingContract, 
      isFetchingSession, 
      isTermProcessing, 
      isGeneratingContract, 
      isGeneratingMarkedContract, 
      isAskingQuestion, 
      isReviewingModification, 
      isProcessingGeneralQuestion, 
      error, 
      uploadError, 
      analysisError,
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
      addInteraction,
      getSessionInteractions,
      bookmarkSession,
      getSessionStats,
      submitExpertFeedback,
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export default useSession;
export { SessionContext, ComplianceStats, SESSIONS_STORAGE_KEY };