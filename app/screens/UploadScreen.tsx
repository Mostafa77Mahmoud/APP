import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSession } from '../contexts/SessionContext';
import { useContract } from '../contexts/ContractContext';
import UploadArea from '../components/UploadArea';
import AnalyzingAnimation from '../components/AnalyzingAnimation';
import { ArrowLeft, ArrowRight, Upload as UploadIcon, FileText, Loader, UserCheck } from 'lucide-react-native';

interface UploadScreenProps {
  onAnalysisComplete: (sessionId: string) => void;
  onBack: () => void;
  preSelectedFile?: any;
  file?: any;
  fromCamera?: boolean;
  pageCount?: number;
  autoUpload?: boolean;
}

const UploadScreen: React.FC<UploadScreenProps> = ({ 
  onAnalysisComplete, 
  onBack, 
  preSelectedFile, 
  file,
  fromCamera = false, 
  pageCount = 1,
  autoUpload = false 
}) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { isAnalyzingContract, isUploading, uploadProgress, currentUserRole } = useSession();
  const [analysisStage, setAnalysisStage] = useState(1);
  const [cameraDocument, setCameraDocument] = useState<any>(preSelectedFile || file);

  // Update camera document when preSelectedFile or file changes
  useEffect(() => {
    const documentToUse = preSelectedFile || file;
    if (documentToUse && fromCamera) {
      console.log('📱 UploadScreen: Received camera document:', {
        name: documentToUse.name,
        type: documentToUse.type,
        size: documentToUse.size,
        hasFile: !!documentToUse.file,
        imageCount: documentToUse.images?.length || 1
      });
      setCameraDocument(documentToUse);
    }
  }, [preSelectedFile, file, fromCamera]);

  const isDark = theme === 'dark';
  const styles = getStyles(isDark, isRTL);

  // Simulate analysis stages for better UX
  React.useEffect(() => {
    if (isAnalyzingContract) {
      let currentStage = 1;
      const stageInterval = setInterval(() => {
        currentStage++;
        if (currentStage <= 5) {
          setAnalysisStage(currentStage);
        } else {
          clearInterval(stageInterval);
        }
      }, 2000);

      return () => clearInterval(stageInterval);
    } else {
      setAnalysisStage(1);
    }
  }, [isAnalyzingContract]);

  const handleAnalysisComplete = (sessionId: string) => {
    // Add a small delay to show completion animation
    setTimeout(() => {
      onAnalysisComplete(sessionId);
    }, 1500);
  };

  

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          {isRTL ? <ArrowRight size={24} color={styles.headerTitle.color} /> : <ArrowLeft size={24} color={styles.headerTitle.color} />}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('upload.title')}</Text>
        <View style={styles.roleIndicator}>
          <Text style={styles.roleText}>
            {currentUserRole === 'shariah_expert' ? t('user.expert') : t('user.regular')}
          </Text>
          <View style={[
            styles.roleIcon,
            { backgroundColor: currentUserRole === 'shariah_expert' ? '#f59e0b' : '#3b82f6' }
          ]}>
            <UserCheck size={16} color="#ffffff" />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <UploadArea 
          onAnalysisComplete={handleAnalysisComplete}
          preSelectedFile={cameraDocument}
          fromCamera={fromCamera}
          pageCount={pageCount}
          autoUpload={autoUpload}
        />
      </ScrollView>

      {/* Show the AnalyzingAnimation as a full-screen overlay during analysis */}
      <AnalyzingAnimation 
        isVisible={isAnalyzingContract || isUploading} 
        stage={isUploading ? 1 : analysisStage}
        progress={isUploading ? uploadProgress : (analysisStage - 1) * 20}
        currentStage={
          isUploading ? t('analyzing.uploading') : 
          analysisStage === 1 ? t('analyzing.stage1') :
          analysisStage === 2 ? t('analyzing.stage2') :
          analysisStage === 3 ? t('analyzing.stage3') :
          analysisStage === 4 ? t('analyzing.stage4') :
          t('analyzing.stage5')
        }
      />
    </SafeAreaView>
  );
};

const getStyles = (isDark: boolean, isRTL: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#0a0a0a' : '#f8fafc',
  },
  header: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#27272a' : '#e5e7eb',
  },
  headerButton: { padding: 8, width: 40 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: isDark ? '#f9fafb' : '#111827' },
  roleIndicator: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#374151' : '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: isDark ? '#f9fafb' : '#111827',
  },
  roleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  roleIndicator: {
    backgroundColor: isDark ? '#1e40af' : '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 0,
    alignSelf: 'center',
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#60a5fa' : '#1e40af',
  },
});

export default UploadScreen;