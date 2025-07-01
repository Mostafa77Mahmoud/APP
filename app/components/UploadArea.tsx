// app/components/UploadArea.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { Upload, FileText, ChevronRight, Loader } from 'lucide-react-native';
import { Card, CardContent, CardHeader } from './ui/card';
import { Progress } from './ui/progress';

interface UploadAreaProps {
  onAnalysisComplete: (sessionId: string) => void;
}

const UploadArea: React.FC<UploadAreaProps> = ({ onAnalysisComplete }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { 
    uploadAndAnalyzeContract, 
    isUploading, 
    uploadProgress, 
    isAnalyzingContract,
    uploadError,
    analysisError,
    sessionId,
    clearSession 
  } = useSession();
  
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  const processFile = useCallback((file: any) => {
    if (file) {
      const allowedMimeTypes = [
        "application/pdf", 
        "text/plain", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ];
      if (!allowedMimeTypes.includes(file.mimeType)) {
        Alert.alert(t('error.fileType'), t('upload.formats'));
        setSelectedFile(null);
        return;
      }
      clearSession(); 
      setSelectedFile(file);
    }
  }, [clearSession, t]);

  const handlePickDocument = useCallback(async () => {
    if (isUploading || isAnalyzingContract) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
            "application/pdf", 
            "text/plain", 
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        processFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert(t('error.generic'), (error as Error).message);
    }
  }, [processFile, isUploading, isAnalyzingContract, t]);

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    const newSessionId = await uploadAndAnalyzeContract(selectedFile);
    if (newSessionId) {
      onAnalysisComplete(newSessionId);
    }
  };

  const isProcessing = isUploading || isAnalyzingContract;

  return (
    <Card style={styles.card}>
      <CardHeader style={styles.cardHeader}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Upload size={20} color={isDark ? '#6ee7b7' : '#10b981'} />
          <Text style={styles.cardTitle}>{t('upload.title')}</Text>
        </View>
        <Text style={styles.cardDescription}>{t('upload.description')}</Text>
      </CardHeader>
      <CardContent style={styles.cardContent}>
        <TouchableOpacity
          style={[styles.dropzone, isProcessing && styles.dropzoneDisabled]}
          onPress={handlePickDocument}
          disabled={isProcessing}
        >
          {isUploading ? (
            <View style={styles.statusContainer}>
              <Loader size={48} color="#3b82f6" />
              <Text style={styles.statusText}>{t('upload.uploading')}</Text>
              <Progress value={uploadProgress} style={{width: '80%'}} />
            </View>
          ) : selectedFile ? (
            <View style={styles.statusContainer}>
              <FileText size={48} color={isDark ? '#6ee7b7' : '#10b981'} />
              <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={styles.statusSubText}>{t('upload.fileSelected')}</Text>
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <Upload size={48} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={styles.dropzoneText}>{t('upload.dragDrop')}</Text>
              <Text style={styles.dropzoneSubText}>{t('upload.formats')}</Text>
            </View>
          )}
        </TouchableOpacity>
        {uploadError && !isProcessing && <Text style={styles.errorText}>{uploadError}</Text>}
      </CardContent>
      <View style={styles.cardFooter}>
        {selectedFile && !sessionId && !isProcessing && (
          <TouchableOpacity style={styles.analyzeButton} onPress={handleAnalyze}>
            <ChevronRight size={18} color="#fff" />
            <Text style={styles.analyzeButtonText}>{t('upload.analyze')}</Text>
          </TouchableOpacity>
        )}
        {analysisError && !isProcessing && <Text style={styles.errorText}>{`${t('error.analysisFailed')}: ${analysisError}`}</Text>}
      </View>
    </Card>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  card: { margin: 16 },
  cardHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#e5e7eb' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  cardDescription: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 4 },
  cardContent: { padding: 16 },
  cardFooter: { padding: 16, borderTopWidth: 1, borderTopColor: isDark ? '#374151' : '#e5e7eb' },
  dropzone: { borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? '#4b5563' : '#d1d5db', borderRadius: 12, padding: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1f2937' : '#f9fafb', minHeight: 180 },
  dropzoneDisabled: { opacity: 0.5 },
  statusContainer: { alignItems: 'center', gap: 12 },
  statusText: { fontSize: 16, fontWeight: '500', color: '#3b82f6' },
  fileName: { fontSize: 16, fontWeight: '600', color: isDark ? '#6ee7b7' : '#10b981', textAlign: 'center' },
  statusSubText: { fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280' },
  dropzoneText: { fontSize: 16, color: isDark ? '#d1d5db' : '#374151', fontWeight: '500' },
  dropzoneSubText: { fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' },
  errorText: { color: '#ef4444', textAlign: 'center', marginTop: 8 },
  analyzeButton: { flexDirection: isRTL ? 'row-reverse' : 'row', backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 8 },
  analyzeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default UploadArea;
export { UploadArea, getStyles }; // Export for testing or reuse