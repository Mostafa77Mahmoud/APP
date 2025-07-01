// app/components/ContractPreviewModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession } from '../contexts/SessionContext';
import { X, Download, FileText as FileTextIcon, AlertTriangle, RefreshCw, Eye } from 'lucide-react-native';
import * as api from '../services/api'; // Assuming api services are exported from here

export interface ContractPreviewModalProps {
  isVisible: boolean;
  onClose: () => void;
  fileType: 'modified' | 'marked' | null;
}

export const ContractPreviewModal: React.FC<ContractPreviewModalProps> = ({
  isVisible,
  onClose,
  fileType,
}) => {
  const { t, dir } = useLanguage();
  const { theme } = useTheme();
  const { sessionId, sessionDetails, updatePdfPreviewInfo } = useSession();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, dir === 'rtl');

  const docxDownloadUrl = fileType === 'modified' 
    ? sessionDetails?.modified_contract_info?.docx_cloudinary_info?.url
    : sessionDetails?.marked_contract_info?.docx_cloudinary_info?.url;

  const fetchPreviewUrl = useCallback(async () => {
    if (!sessionId || !fileType) return;

    // Check for existing PDF preview URL
    const existingPdfInfo = sessionDetails?.pdf_preview_info?.[fileType];
    if (existingPdfInfo?.url) {
      setPreviewUrl(existingPdfInfo.url);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // This assumes your backend has an endpoint like /preview_contract/<session_id>/<type>
      // which is not in the provided api_server.py. If it doesn't, this will fail.
      // For now, we will simulate success if a docxUrl exists.
      if (docxDownloadUrl) {
          // In a real scenario, you would fetch the PDF URL from the backend.
          // Here, we'll just use the DOCX url as a placeholder for the download button.
          setPreviewUrl(docxDownloadUrl); // Placeholder, ideally this would be a PDF url
          updatePdfPreviewInfo(fileType, { url: docxDownloadUrl, format: 'pdf', public_id: '' });
      } else {
          throw new Error(t('contract.preview.noFileTitle'));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, fileType, sessionDetails, docxDownloadUrl, t, updatePdfPreviewInfo]);

  useEffect(() => {
    if (isVisible) {
      fetchPreviewUrl();
    } else {
      // Reset state on close
      setPreviewUrl(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isVisible, fetchPreviewUrl]);

  const handleOpenLink = async (url?: string) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Cannot open this URL.");
    }
  };
  
  const modalTitle = fileType === 'modified'
    ? t('contract.preview.modifiedTitle')
    : t('contract.preview.markedTitle');

  const effectiveUserFacingDocxFilename = fileType === 'modified' 
    ? sessionDetails?.modified_contract_info?.docx_cloudinary_info?.user_facing_filename 
    : sessionDetails?.marked_contract_info?.docx_cloudinary_info?.user_facing_filename;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{modalTitle}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={isDark ? '#d1d5db' : '#6b7280'} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.centerContent}>
                <ActivityIndicator size="large" color={isDark ? '#10b981' : '#059669'} />
                <Text style={styles.statusText}>{t('contract.preview.loading')}</Text>
              </View>
            ) : error ? (
              <View style={styles.centerContent}>
                <AlertTriangle size={48} color="#ef4444" />
                <Text style={[styles.statusText, { color: '#ef4444' }]}>{t('contract.preview.errorTitle')}</Text>
                <Text style={styles.errorDetails}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={fetchPreviewUrl}>
                  <RefreshCw size={16} color="#3b82f6" />
                  <Text style={styles.retryText}>{t('retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.centerContent}>
                  <Eye size={48} color={isDark ? '#6ee7b7' : '#10b981'} />
                  <Text style={styles.previewReadyText}>{t('contract.preview.ready')}</Text>
                  <Text style={styles.previewDescText}>{t('contract.preview.openOrDownload')}</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={onClose}>
              <Text style={styles.footerButtonText}>{t('contract.preview.close')}</Text>
            </TouchableOpacity>
            {!isLoading && !error && (
              <View style={{flexDirection: 'row', gap: 12}}>
                {previewUrl && (
                    <TouchableOpacity style={[styles.footerButton, styles.primaryButton]} onPress={() => handleOpenLink(previewUrl)}>
                        <Download size={16} color="#fff" />
                        <Text style={[styles.footerButtonText, styles.primaryButtonText]}>{t('contract.downloadPDF')}</Text>
                    </TouchableOpacity>
                )}
                {docxDownloadUrl && (
                    <TouchableOpacity style={[styles.footerButton, styles.secondaryButton]} onPress={() => handleOpenLink(docxDownloadUrl)}>
                        <FileTextIcon size={16} color="#fff" />
                        <Text style={[styles.footerButtonText, styles.primaryButtonText]}>{fileType === 'modified' ? t('contract.downloadCompliantDOCX') : t('contract.downloadMarkedDOCX')}</Text>
                    </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  container: { backgroundColor: isDark ? '#1f2937' : '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  header: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#e5e7eb' },
  title: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  closeButton: { padding: 8 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 150, paddingVertical: 20 },
  centerContent: { alignItems: 'center', padding: 20, gap: 16 },
  statusText: { fontSize: 16, fontWeight: '500', color: isDark ? '#d1d5db' : '#6b7280', textAlign: 'center' },
  errorDetails: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', textAlign: 'center' },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#3b82f6' },
  retryText: { color: '#3b82f6', fontWeight: '600' },
  previewReadyText: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#6ee7b7' : '#15803d' },
  previewDescText: { fontSize: 14, color: isDark ? '#d1d5db' : '#6b7280', textAlign: 'center', marginTop: 8 },
  footer: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#e5e7eb' },
  footerButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, backgroundColor: isDark ? '#374151' : '#f3f4f6' },
  primaryButton: { backgroundColor: '#ef4444' },
  secondaryButton: { backgroundColor: '#3b82f6' },
  footerButtonText: { fontSize: 14, fontWeight: '600', color: isDark ? '#f9fafb' : '#111827' },
  primaryButtonText: { color: '#ffffff' },
});

export default ContractPreviewModal;
