// app/services/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// --- API Configuration ---
// Use 10.0.2.2 for Android emulator to connect to localhost on the host machine.
// For web and iOS simulator, 'localhost' or your computer's local IP should work.
const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
const NGROK_SKIP_BROWSER_WARNING_HEADER = { 'ngrok-skip-browser-warning': 'true' };

// --- Exported Types ---
export interface User { id: string; email: string; username?: string; role: 'regular_user' | 'shariah_expert'; }
export interface LoginCredentials { email: string; password: string; }
export interface SignupCredentials extends LoginCredentials { username?: string; }
export interface AuthResponse { token: string; user: User; }
export interface ApiAnalysisTerm { term_id: string; term_text: string; is_valid_sharia: boolean; sharia_issue?: string; reference_number?: string; modified_term?: string; is_confirmed_by_user?: boolean; confirmed_modified_text?: string | null; has_expert_feedback?: boolean; last_expert_feedback_id?: string | null; expert_override_is_valid_sharia?: boolean | null; }
export interface AnalyzeApiResponse { message: string; analysis_results: ApiAnalysisTerm[]; session_id: string; original_contract_plain?: string; detected_contract_language: 'ar' | 'en'; original_cloudinary_url?: string; }
export interface SessionDetailsApiResponse { _id: string; session_id: string; original_filename: string; analysis_timestamp: string; analysis_results: ApiAnalysisTerm[]; compliance_percentage?: number; detected_contract_language: 'ar' | 'en'; original_contract_plain?: string; original_format: string; original_contract_markdown?: string; original_cloudinary_info?: CloudinaryFileInfo; analysis_results_cloudinary_info?: CloudinaryFileInfo; modified_contract_info?: any; marked_contract_info?: any; pdf_preview_info?: any; }
export interface CloudinaryFileInfo { url: string; public_id: string; format: string; user_facing_filename?: string; }
export interface GenerateModifiedContractApiResponse { success: boolean; message: string; modified_docx_cloudinary_url?: string; modified_txt_cloudinary_url?: string; }
export interface GenerateMarkedContractApiResponse { success: boolean; message: string; marked_docx_cloudinary_url?: string; }
export interface ConfirmModificationApiResponse { success: boolean; message: string; }
export interface ReviewModificationApiResponse { reviewed_text: string; is_still_valid_sharia: boolean; new_sharia_issue?: string | null; new_reference_number?: string | null; }
export interface ExpertFeedbackPayload { session_id: string; term_id: string; feedback_data: { aiAnalysisApproved: boolean | null; expertIsValidSharia?: boolean; expertComment: string; expertCorrectedShariaIssue?: string; expertCorrectedSuggestion?: string; }; }
export interface ExpertFeedbackApiResponse { success: boolean; message: string; feedback_id?: string; }


// --- Helper Functions ---
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // If the response is not JSON, use the status text.
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text() as unknown as Promise<T>;
}

const getAuthToken = (): Promise<string | null> => AsyncStorage.getItem('auth_token');

const getHeaders = async (isFormData = false) => {
    const token = await getAuthToken();
    const headers: Record<string, string> = { ...NGROK_SKIP_BROWSER_WARNING_HEADER };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// --- Auth API ---
export const authApi = {
    login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
        const response = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', headers: await getHeaders(), body: JSON.stringify(credentials) });
        return handleResponse<AuthResponse>(response);
    },
    signup: async (credentials: SignupCredentials): Promise<AuthResponse> => {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, { method: 'POST', headers: await getHeaders(), body: JSON.stringify(credentials) });
        return handleResponse<AuthResponse>(response);
    },
    logout: async (): Promise<void> => Promise.resolve()
};


// --- Main App API Functions ---

export const uploadContract = async (fileAsset: any, onUploadProgress?: (progress: number) => void): Promise<AnalyzeApiResponse> => {
  console.log('📤 API: Starting upload with file:', {
    uri: fileAsset.uri,
    type: fileAsset.type,
    name: fileAsset.name,
    size: fileAsset.size,
    hasMetadata: !!fileAsset.metadata,
    hasImages: !!fileAsset.images,
    isMultiPage: fileAsset.images?.length > 1
  });

  const formData = new FormData();
  
  try {
    // Handle multi-page image documents
    if (fileAsset.images && Array.isArray(fileAsset.images) && fileAsset.images.length > 1) {
      console.log('📤 API: Processing multi-page document with', fileAsset.images.length, 'pages');
      
      if (Platform.OS === 'web' && fileAsset.file) {
        // For web, use the file directly (it's already a text file with base64 data)
        formData.append('file', fileAsset.file);
        formData.append('upload_type', 'multi-page-images');
        formData.append('total_pages', fileAsset.images.length.toString());
        
        console.log('📤 API: Added web multi-page text file to FormData');
      } else {
        // For native platforms, create a file with the multi-page data
        const fileData = {
          uri: fileAsset.uri,
          type: fileAsset.type || 'text/plain',
          name: fileAsset.name || `contract_multipage_${Date.now()}.txt`,
        } as any;
        
        formData.append('file', fileData);
        formData.append('upload_type', 'multi-page-images');
        formData.append('total_pages', fileAsset.images.length.toString());
        
        console.log('📤 API: Added native multi-page text file to FormData');
      }
    } 
    // Handle single file uploads (legacy)
    else if (Platform.OS === 'web' && fileAsset.file) {
      formData.append('file', fileAsset.file);
      console.log('📤 API: Added web file to FormData');
    } else {
      // React Native single file upload
      const fileData = {
        uri: fileAsset.uri,
        type: fileAsset.type || fileAsset.mimeType || 'image/jpeg',
        name: fileAsset.name || `upload_${Date.now()}.jpg`,
      } as any;
      
      if (fileAsset.size) {
        fileData.size = fileAsset.size;
      }
      
      formData.append('file', fileData);
      console.log('📤 API: Added native file to FormData:', fileData);
      
      // Add metadata if available
      if (fileAsset.metadata) {
        formData.append('metadata', JSON.stringify(fileAsset.metadata));
        console.log('📤 API: Added metadata:', fileAsset.metadata);
      }
    }
    
    onUploadProgress?.(30);
    
    const headers = await getHeaders(true);
    console.log('📤 API: Request headers prepared');
    
    onUploadProgress?.(50);
    
    console.log('📤 API: Sending request to:', `${API_BASE_URL}/analyze`);
    console.log('📤 API: FormData entries:');
    for (let pair of formData.entries()) {
      if (pair[1] instanceof File || pair[1] instanceof Blob) {
        console.log(`  ${pair[0]}: [${pair[1].constructor.name}] ${pair[1].name || 'unnamed'} (${pair[1].size} bytes)`);
      } else {
        console.log(`  ${pair[0]}: ${pair[1]}`);
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/analyze`, { 
      method: 'POST', 
      body: formData, 
      headers
    });

    console.log('📤 API: Response received:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    onUploadProgress?.(100);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API: Upload failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText
      });
      throw new Error(`Upload failed (${response.status}): ${errorText || response.statusText}`);
    }
    
    const result = await handleResponse<AnalyzeApiResponse>(response);
    console.log('✅ API: Upload successful, session ID:', result.session_id);
    return result;
  } catch (error) {
    console.error('❌ API: Upload error:', error);
    onUploadProgress?.(0);
    throw error;
  }
};


export const getSessionHistory = async (): Promise<SessionDetailsApiResponse[]> => {
  const headers = await getHeaders();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10 second timeout
    
    const response = await fetch(`${API_BASE_URL}/api/history`, { 
      method: 'GET', 
      headers,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return handleResponse<SessionDetailsApiResponse[]>(response);
  } catch (error) {
    console.warn('Session history fetch failed:', error);
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.log('Request timeout - using local data only');
      // Return empty array to fallback to local data
      return [];
    }
    // For other network errors, also return empty array to use local data
    return [];
  }
};

export const getStats = async (): Promise<any> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/stats/user`, { method: 'GET', headers });
  return handleResponse<any>(response);
};

export const getSessionDetails = async (sessionId: string): Promise<SessionDetailsApiResponse> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, { method: 'GET', headers });
  return handleResponse<SessionDetailsApiResponse>(response);
};

export const getSessionTerms = async (sessionId: string): Promise<ApiAnalysisTerm[]> => {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/terms/${sessionId}`, { method: 'GET', headers });
  return handleResponse<ApiAnalysisTerm[]>(response);
};

export const askQuestion = async (sessionId: string, question: string, termId?: string, termText?: string): Promise<string> => {
  const headers = await getHeaders();
  const payload = { session_id: sessionId, question, term_id: termId, term_text: termText };
  const response = await fetch(`${API_BASE_URL}/interact`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const textResponse = await response.text();
  if (!response.ok) throw new Error(textResponse || 'Failed to ask question');
  return textResponse;
};

export const reviewUserModification = async (sessionId: string, termId: string, userModifiedText: string, originalTermText: string): Promise<ReviewModificationApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId, term_id: termId, user_modified_text: userModifiedText, original_term_text: originalTermText };
    const response = await fetch(`${API_BASE_URL}/review_modification`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<ReviewModificationApiResponse>(response);
};

export const confirmTermModification = async (sessionId: string, termId: string, modifiedText: string): Promise<ConfirmModificationApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId, term_id: termId, modified_text: modifiedText };
    const response = await fetch(`${API_BASE_URL}/confirm_modification`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<ConfirmModificationApiResponse>(response);
};

export const generateModifiedContract = async (sessionId: string): Promise<GenerateModifiedContractApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId };
    const response = await fetch(`${API_BASE_URL}/generate_modified_contract`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<GenerateModifiedContractApiResponse>(response);
};

export const generateMarkedContract = async (sessionId: string): Promise<GenerateMarkedContractApiResponse> => {
    const headers = await getHeaders();
    const payload = { session_id: sessionId };
    const response = await fetch(`${API_BASE_URL}/generate_marked_contract`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<GenerateMarkedContractApiResponse>(response);
};

export const submitExpertFeedback = async (payload: ExpertFeedbackPayload): Promise<ExpertFeedbackApiResponse> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/feedback/expert`, { method: 'POST', headers, body: JSON.stringify(payload) });
    return handleResponse<ExpertFeedbackApiResponse>(response);
};

// --- Local Storage Functions ---
export const saveSessionLocally = async (session: SessionDetailsApiResponse): Promise<void> => {
  try {
    const sessions = await getLocalSessions();
    const updatedSessions = sessions.filter(s => s.session_id !== session.session_id);
    updatedSessions.unshift(session);
    await AsyncStorage.setItem('shariaa_sessions', JSON.stringify(updatedSessions.slice(0, 50)));
  } catch (error) { console.error('Failed to save session locally:', error); }
};

export const getLocalSessions = async (): Promise<SessionDetailsApiResponse[]> => {
  try {
    const sessions = await AsyncStorage.getItem('shariaa_sessions');
    return sessions ? JSON.parse(sessions) : [];
  } catch (error) { return []; }
};

export const deleteLocalSession = async (sessionId: string): Promise<void> => {
  try {
    const sessions = await getLocalSessions();
    const updatedSessions = sessions.filter(s => s.session_id !== sessionId);
    await AsyncStorage.setItem('shariaa_sessions', JSON.stringify(updatedSessions));
  } catch (error) { console.error('Failed to delete local session:', error); }
};
export default {
  authApi,
  uploadContract,
  getSessionHistory,
  getStats,
  getSessionDetails,
  getSessionTerms,
  askQuestion,
  reviewUserModification,
  confirmTermModification,
  generateModifiedContract,
  generateMarkedContract,
  submitExpertFeedback,
  saveSessionLocally,
  getLocalSessions,
  deleteLocalSession,
};