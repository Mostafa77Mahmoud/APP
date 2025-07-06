// app/screens/CameraScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Corrected Import: Import Camera, CameraType, and CameraView as named exports
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, ArrowRight, Image as ImageIcon, File as FileIcon, RefreshCw, Plus, Check, X } from 'lucide-react-native';
import AnalyzingAnimation from '../components/AnalyzingAnimation';
import { ScreenType } from '../MobileApp';

interface CameraScreenProps {
  onNavigate: (screen: ScreenType, data?: any) => void;
  onBack: () => void;
}

const CameraScreen: React.FC<CameraScreenProps> = ({ onNavigate, onBack }) => {
  const { t, isRTL } = useLanguage();
  const { uploadAndAnalyzeContract, isUploading, isAnalyzingContract } = useSession();
  
  // Corrected Hook: Use the new useCameraPermissions hook
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null); // Corrected Type: Use CameraView for the ref
  const isFocused = useIsFocused();
  
  // Multi-page document capture states
  const [capturedImages, setCapturedImages] = useState<Array<{uri: string, id: string}>>([]);
  const [isMultiPageMode, setIsMultiPageMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleAnalysis = async (file: any) => {
    const sessionId = await uploadAndAnalyzeContract(file);
    if (sessionId) {
      onNavigate('results', { sessionId });
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
        if (photo) {
          if (isMultiPageMode) {
            // Add to captured images array
            const newImage = {
              uri: photo.uri,
              id: Date.now().toString()
            };
            setCapturedImages(prev => [...prev, newImage]);
          } else {
            // Single page - process immediately
            const file = { uri: photo.uri, type: 'image/jpeg', name: 'capture.jpg' };
            await handleAnalysis(file);
          }
        }
      } catch (error) {
        Alert.alert(t('error.generic'), t('error.cameraFailed'));
      }
    }
  };

  const removeImage = (id: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id));
  };

  const generatePDFFromImages = async () => {
    if (capturedImages.length === 0) return;
    
    setIsGeneratingPDF(true);
    try {
      // Create a simple PDF from images using canvas approach
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size for A4 proportions
      canvas.width = 595;
      canvas.height = 842;
      
      const pdfPages = [];
      
      for (const imageData of capturedImages) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageData.uri;
        });
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate scaling to fit image in canvas
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        // Convert to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        pdfPages.push(blob);
      }
      
      // For React Native, we'll create a simple multi-image file
      // In a real implementation, you'd use a PDF library like react-native-pdf-lib
      const combinedBlob = new Blob(pdfPages, { type: 'application/pdf' });
      const pdfUri = URL.createObjectURL(combinedBlob);
      
      const file = { 
        uri: pdfUri, 
        type: 'application/pdf', 
        name: `contract_${Date.now()}.pdf`,
        size: combinedBlob.size
      };
      
      setCapturedImages([]);
      setIsMultiPageMode(false);
      await handleAnalysis(file);
    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert(t('error.generic'), 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const file = { uri: result.assets[0].uri, type: result.assets[0].mimeType || 'image/jpeg', name: result.assets[0].fileName || 'image.jpg' };
      await handleAnalysis(file);
    }
  };

  const isProcessing = isUploading || isAnalyzingContract;

  if (!permission) {
    // Permissions are still loading
    return <View style={styles.permissionContainer}><ActivityIndicator /></View>;
  }

  if (!permission.granted) {
    // Permissions are not granted
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionText}>{t('camera.noPermission')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{t('camera.grantPermission')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isProcessing) {
    return <AnalyzingAnimation isAnalyzing={true} />;
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        // Corrected Component: Use CameraView and facing prop
        <CameraView style={StyleSheet.absoluteFill} facing='back' ref={cameraRef} />
      )}
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            {isRTL ? <ArrowRight size={24} color="#fff" /> : <ArrowLeft size={24} color="#fff" />}
          </TouchableOpacity>
          <Text style={styles.headerText}>{t('camera.title')}</Text>
          <TouchableOpacity style={styles.iconButton}>
            <RefreshCw size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.frameContainer}>
          <View style={styles.scanFrame} />
          <Text style={styles.instructionText}>{t('camera.instruction')}</Text>
        </View>

        {/* Multi-page captured images preview */}
        {isMultiPageMode && capturedImages.length > 0 && (
          <View style={styles.imagePreviewContainer}>
            <FlatList
              horizontal
              data={capturedImages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.previewImageContainer}>
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => removeImage(item.id)}
                  >
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              style={styles.imagePreviewList}
            />
            <Text style={styles.imageCountText}>
              {capturedImages.length} {t('camera.pagesCaptures') || 'pages captured'}
            </Text>
          </View>
        )}

        <View style={[styles.controls, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={styles.sideButton} onPress={pickImage}>
            <ImageIcon size={28} color="#fff" />
            <Text style={styles.sideButtonText}>{t('camera.gallery')}</Text>
          </TouchableOpacity>
          
          <View style={styles.centerControls}>
            <TouchableOpacity 
              style={[styles.captureButton, isMultiPageMode && styles.multiPageCaptureButton]} 
              onPress={takePicture}
            >
              {isMultiPageMode && <Plus size={24} color="#000" />}
            </TouchableOpacity>
            
            {isMultiPageMode && capturedImages.length > 0 && (
              <TouchableOpacity 
                style={styles.generatePDFButton} 
                onPress={generatePDFFromImages}
                disabled={isGeneratingPDF}
              >
                {isGeneratingPDF ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Check size={24} color="#fff" />
                )}
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.sideButton} 
            onPress={() => setIsMultiPageMode(!isMultiPageMode)}
          >
            <FileIcon size={28} color={isMultiPageMode ? "#10b981" : "#fff"} />
            <Text style={[styles.sideButtonText, isMultiPageMode && { color: "#10b981" }]}>
              {isMultiPageMode ? t('camera.single') : t('camera.multiPage')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 },
  permissionText: { color: '#fff', fontSize: 18, textAlign: 'center', marginBottom: 20 },
  permissionButton: { backgroundColor: '#10b981', padding: 15, borderRadius: 10 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  overlay: { flex: 1, justifyContent: 'space-between', backgroundColor: 'transparent' },
  header: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  iconButton: { padding: 8 },
  headerText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  frameContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: '90%', aspectRatio: 1 / 1.4, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.8)', borderRadius: 16, borderStyle: 'dashed' },
  instructionText: { color: '#fff', marginTop: 20, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  imagePreviewContainer: { 
    position: 'absolute', 
    top: 100, 
    left: 16, 
    right: 16, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    borderRadius: 12, 
    padding: 12 
  },
  imagePreviewList: { marginBottom: 8 },
  previewImageContainer: { 
    width: 60, 
    height: 80, 
    marginRight: 8, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    borderRadius: 8, 
    position: 'relative' 
  },
  removeImageButton: { 
    position: 'absolute', 
    top: -8, 
    right: -8, 
    backgroundColor: '#ef4444', 
    borderRadius: 12, 
    width: 24, 
    height: 24, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  imageCountText: { color: '#fff', fontSize: 14, textAlign: 'center', fontWeight: 'bold' },
  controls: { justifyContent: 'space-around', alignItems: 'center', paddingBottom: 30 },
  centerControls: { alignItems: 'center', gap: 12 },
  sideButton: { alignItems: 'center', gap: 4 },
  sideButtonText: { color: '#fff', fontSize: 12 },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  multiPageCaptureButton: { backgroundColor: '#10b981' },
  generatePDFButton: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#10b981', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
});

export default CameraScreen;