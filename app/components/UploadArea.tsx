
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated, Dimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { useContract } from '../contexts/ContractContext';
import { Upload, FileText, ChevronRight, Loader, CheckCircle, AlertCircle, FileCheck, X } from 'lucide-react-native';
import { Card, CardContent, CardHeader } from './ui/card';
import { Progress } from './ui/progress';

interface UploadAreaProps {
  onAnalysisComplete: (sessionId: string) => void;
}

const { width: screenWidth } = Dimensions.get('window');

const UploadArea: React.FC<UploadAreaProps> = ({ onAnalysisComplete }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { addContract } = useContract();
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
  const [dragActive, setDragActive] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  useEffect(() => {
    if (isUploading || isAnalyzingContract) {
      // Start pulse animation during upload/analysis
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    }
  }, [isUploading, isAnalyzingContract]);

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: uploadProgress / 100,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [uploadProgress]);

  useEffect(() => {
    if (uploadComplete) {
      // Success animation
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [uploadComplete]);

  const processFile = useCallback(async (file: any) => {
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

      // File validation animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 150,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      clearSession(); 
      setSelectedFile(file);
      setUploadComplete(false);
      
      // Auto-analyze the file
      setTimeout(() => {
        handleAnalyze(file);
      }, 500);
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

  const handleAnalyze = async (file?: any) => {
    const fileToAnalyze = file || selectedFile;
    if (!fileToAnalyze) return;

    try {
      const newSessionId = await uploadAndAnalyzeContract(fileToAnalyze);
      if (newSessionId) {
        setUploadComplete(true);
        
        // Add to contract history
        addContract({
          id: newSessionId,
          name: fileToAnalyze.name,
          analysisDate: new Date().toISOString(),
          complianceScore: 0,
          sessionId: newSessionId,
          fileSize: fileToAnalyze.size ? `${(fileToAnalyze.size / 1024).toFixed(1)} KB` : 'Unknown',
        });

        setTimeout(() => {
          onAnalysisComplete(newSessionId);
        }, 1500);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadComplete(false);
    clearSession();
  };

  const isProcessing = isUploading || isAnalyzingContract;
  const hasError = uploadError || analysisError;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
      <Card style={styles.card}>
        <CardHeader style={styles.cardHeader}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Upload size={24} color={isDark ? '#6ee7b7' : '#10b981'} />
            </Animated.View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.cardTitle}>{t('upload.title')}</Text>
              <Text style={styles.cardDescription}>{t('upload.description')}</Text>
            </View>
          </View>
        </CardHeader>

        <CardContent style={styles.cardContent}>
          <TouchableOpacity
            style={[
              styles.dropzone, 
              isProcessing && styles.dropzoneDisabled,
              dragActive && styles.dropzoneActive,
              hasError && styles.dropzoneError,
              selectedFile && !hasError && styles.dropzoneSuccess
            ]}
            onPress={handlePickDocument}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isUploading ? (
              <Animated.View style={[styles.statusContainer, { transform: [{ scale: pulseAnim }] }]}>
                <Loader size={48} color="#3b82f6" />
                <Text style={styles.statusText}>{t('upload.uploading')}</Text>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <Animated.View 
                      style={[
                        styles.progressFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                            extrapolate: 'clamp',
                          })
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
                </View>
              </Animated.View>
            ) : isAnalyzingContract ? (
              <Animated.View style={[styles.statusContainer, { transform: [{ scale: pulseAnim }] }]}>
                <Loader size={48} color="#8b5cf6" />
                <Text style={styles.statusText}>{t('upload.analyzing')}</Text>
                <Text style={styles.statusSubText}>{t('upload.analyzingDesc')}</Text>
              </Animated.View>
            ) : uploadComplete ? (
              <Animated.View style={[
                styles.statusContainer,
                { transform: [{ scale: bounceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
                  extrapolate: 'clamp',
                }) }] }
              ]}>
                <CheckCircle size={48} color="#10b981" />
                <Text style={[styles.statusText, { color: '#10b981' }]}>{t('upload.complete')}</Text>
                <Text style={styles.statusSubText}>{t('upload.redirecting')}</Text>
              </Animated.View>
            ) : selectedFile ? (
              <View style={styles.statusContainer}>
                <View style={styles.filePreview}>
                  <FileCheck size={48} color={isDark ? '#6ee7b7' : '#10b981'} />
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={clearSelectedFile}
                  >
                    <X size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.fileName} numberOfLines={2}>{selectedFile.name}</Text>
                <Text style={styles.fileSize}>
                  {selectedFile.size ? `${(selectedFile.size / 1024).toFixed(1)} KB` : t('upload.unknownSize')}
                </Text>
                <Text style={styles.statusSubText}>{t('upload.startingAnalysis')}</Text>
              </View>
            ) : hasError ? (
              <View style={styles.statusContainer}>
                <AlertCircle size={48} color="#ef4444" />
                <Text style={[styles.statusText, { color: '#ef4444' }]}>{t('upload.error')}</Text>
                <Text style={styles.statusSubText}>{hasError}</Text>
              </View>
            ) : (
              <View style={styles.statusContainer}>
                <Upload size={48} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={styles.dropzoneText}>{t('upload.dragDrop')}</Text>
                <Text style={styles.dropzoneSubText}>{t('upload.formats')}</Text>
                <View style={styles.supportedFormats}>
                  <Text style={styles.formatText}>PDF • DOCX • TXT</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </CardContent>

        
      </Card>
    </Animated.View>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  card: { 
    margin: 16,
    borderRadius: 16,
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: { 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: isDark ? '#374151' : '#e5e7eb' 
  },
  headerTextContainer: {
    flex: 1,
  },
  cardTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: isDark ? '#f9fafb' : '#111827',
    marginBottom: 4,
  },
  cardDescription: { 
    fontSize: 14, 
    color: isDark ? '#9ca3af' : '#6b7280',
    lineHeight: 20,
  },
  cardContent: { 
    padding: 20 
  },
  cardFooter: { 
    padding: 20, 
    borderTopWidth: 1, 
    borderTopColor: isDark ? '#374151' : '#e5e7eb' 
  },
  dropzone: { 
    borderWidth: 2, 
    borderStyle: 'dashed', 
    borderColor: isDark ? '#4b5563' : '#d1d5db', 
    borderRadius: 16, 
    padding: 32, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: isDark ? '#111827' : '#f9fafb', 
    minHeight: 200,
    transition: 'all 0.2s ease',
  },
  dropzoneActive: {
    borderColor: '#10b981',
    backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
  },
  dropzoneSuccess: {
    borderColor: '#10b981',
    backgroundColor: isDark ? '#064e3b' : '#ecfdf5',
  },
  dropzoneError: {
    borderColor: '#ef4444',
    backgroundColor: isDark ? '#7f1d1d' : '#fef2f2',
  },
  dropzoneDisabled: { 
    opacity: 0.6 
  },
  statusContainer: { 
    alignItems: 'center', 
    gap: 12 
  },
  statusText: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#3b82f6',
    textAlign: 'center',
  },
  fileName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: isDark ? '#6ee7b7' : '#10b981', 
    textAlign: 'center',
    maxWidth: screenWidth * 0.7,
  },
  fileSize: {
    fontSize: 14,
    color: isDark ? '#9ca3af' : '#6b7280',
    textAlign: 'center',
  },
  filePreview: {
    position: 'relative',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  statusSubText: { 
    fontSize: 14, 
    color: isDark ? '#9ca3af' : '#6b7280',
    textAlign: 'center',
  },
  dropzoneText: { 
    fontSize: 16, 
    color: isDark ? '#d1d5db' : '#374151', 
    fontWeight: '500',
    textAlign: 'center',
  },
  dropzoneSubText: { 
    fontSize: 14, 
    color: isDark ? '#9ca3af' : '#6b7280',
    textAlign: 'center',
  },
  supportedFormats: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: isDark ? '#374151' : '#e5e7eb',
    borderRadius: 8,
  },
  formatText: {
    fontSize: 12,
    color: isDark ? '#9ca3af' : '#6b7280',
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: isDark ? '#374151' : '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  analyzeButton: { 
    backgroundColor: '#10b981',
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  analyzeButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
});

export default UploadArea;
