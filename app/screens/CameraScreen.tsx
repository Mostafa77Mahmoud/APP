
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useIsFocused } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, ArrowRight, Image as ImageIcon, File as FileIcon, RefreshCw, Plus, Check, X, Upload } from 'lucide-react-native';
import AnalyzingAnimation from '../components/AnalyzingAnimation';
import { ScreenType } from '../MobileApp';
import { useTheme } from '../contexts/ThemeContext';

interface CameraScreenProps {
  onNavigate: (screen: ScreenType, data?: any) => void;
  onBack: () => void;
}

const CameraScreen: React.FC<CameraScreenProps> = ({ onNavigate, onBack }) => {
  const { t, isRTL } = useLanguage();
  const { uploadAndAnalyzeContract, isUploading, isAnalyzingContract } = useSession();
  const { isDark } = useTheme();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isFocused = useIsFocused();

  const [capturedImages, setCapturedImages] = useState<Array<{uri: string, id: string}>>([]);
  const [isMultiPageMode, setIsMultiPageMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isConvertingToPdf, setIsConvertingToPdf] = useState(false);

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
        const photo = await cameraRef.current.takePictureAsync({ 
          quality: 0.8,
          base64: false,
          skipProcessing: false
        });
        if (photo) {
          if (isMultiPageMode) {
            const newImage = {
              uri: photo.uri,
              id: Date.now().toString()
            };
            setCapturedImages(prev => [...prev, newImage]);
          } else {
            // Single image mode - directly upload as image
            const file = { 
              uri: photo.uri, 
              type: 'image/jpeg', 
              name: `contract_${Date.now()}.jpg` 
            };
            await handleAnalysis(file);
          }
        }
      } catch (error) {
        console.error('Camera capture error:', error);
        Alert.alert(t('error.generic'), t('error.cameraFailed'));
      }
    }
  };

  const removeImage = (id: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id));
  };

  const generateHTMLContent = (images: Array<{uri: string, id: string}>) => {
    const imageElements = images.map((img, index) => `
      <div style="page-break-after: ${index < images.length - 1 ? 'always' : 'avoid'}; text-align: center; margin: 20px 0;">
        <h3>Page ${index + 1}</h3>
        <img src="${img.uri}" style="max-width: 100%; max-height: 80vh; object-fit: contain;" />
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Contract Document</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px;
              background: white;
            }
            h1 { 
              text-align: center; 
              color: #333;
              margin-bottom: 30px;
            }
            h3 { 
              color: #666; 
              margin-bottom: 15px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <h1>Contract Document - ${new Date().toLocaleDateString()}</h1>
          ${imageElements}
        </body>
      </html>
    `;
  };

  const generatePDFFromImages = async () => {
    if (capturedImages.length === 0) {
      Alert.alert(t('error.generic'), 'No images to convert');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // Create directory for PDFs
      const pdfDir = `${FileSystem.documentDirectory}contracts/`;
      await FileSystem.makeDirectoryAsync(pdfDir, { intermediates: true });
      
      const timestamp = Date.now();
      
      if (capturedImages.length === 1) {
        // Single image - upload directly as image file
        const imageFile = {
          uri: capturedImages[0].uri,
          type: 'image/jpeg',
          name: `contract_${timestamp}.jpg`
        };
        
        setCapturedImages([]);
        setIsMultiPageMode(false);
        setShowConfirmation(false);
        await handleAnalysis(imageFile);
        return;
      }

      // Multiple images - create a simple text-based PDF approach
      // Since HTML-to-PDF might not work in React Native Web, we'll create a simple multi-image approach
      
      // For now, let's use the first image as the primary document
      // In a production app, you would use a proper PDF generation library
      const primaryImage = capturedImages[0];
      const multiPageFile = {
        uri: primaryImage.uri,
        type: 'image/jpeg',
        name: `contract_multipage_${timestamp}.jpg`,
        metadata: {
          totalPages: capturedImages.length,
          additionalImages: capturedImages.slice(1).map(img => img.uri)
        }
      };

      setCapturedImages([]);
      setIsMultiPageMode(false);
      setShowConfirmation(false);
      await handleAnalysis(multiPageFile);

    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert(
        t('error.generic'), 
        'Failed to process images. Please try uploading individual images instead.'
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file = { 
          uri: asset.uri, 
          type: asset.mimeType || 'image/jpeg', 
          name: asset.fileName || `gallery_image_${Date.now()}.jpg`
        };
        await handleAnalysis(file);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert(t('error.generic'), 'Failed to select image from gallery');
    }
  };

  const isProcessing = isUploading || isAnalyzingContract || isGeneratingPDF;

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.permissionText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
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
    return (
      <AnalyzingAnimation 
        isAnalyzing={true} 
        message={isGeneratingPDF ? "Processing images..." : undefined}
      />
    );
  }

  const handleConfirmPhotos = () => {
    if (capturedImages.length === 0) return;
    setShowConfirmation(true);
  };

  const handleContinueToAnalyze = async () => {
    setIsConvertingToPdf(true);
    // Add a small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsConvertingToPdf(false);
    await generatePDFFromImages();
  };

  const handleCancelMultiPage = () => {
    setCapturedImages([]);
    setIsMultiPageMode(false);
    setShowConfirmation(false);
  };

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView 
          style={StyleSheet.absoluteFill} 
          facing='back' 
          ref={cameraRef}
        />
      )}
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            {isRTL ? <ArrowRight size={24} color="#fff" /> : <ArrowLeft size={24} color="#fff" />}
          </TouchableOpacity>
          <Text style={styles.headerText}>{t('camera.title')}</Text>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => {
              // Toggle camera facing - for future enhancement
            }}
          >
            <RefreshCw size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.frameContainer}>
          <View style={styles.scanFrame} />
          <Text style={styles.instructionText}>
            {isMultiPageMode 
              ? (t('camera.multiPageInstruction') || 'Capture multiple pages of your contract')
              : (t('camera.instruction') || 'Position contract within frame and capture')
            }
          </Text>
        </View>

        {isMultiPageMode && capturedImages.length > 0 && (
          <View style={styles.imagePreviewContainer}>
            <FlatList
              horizontal
              data={capturedImages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: item.uri }} style={styles.previewImage} />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => removeImage(item.id)}
                  >
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              style={styles.imagePreviewList}
              showsHorizontalScrollIndicator={false}
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

            {isMultiPageMode && capturedImages.length > 0 && !showConfirmation && (
              <TouchableOpacity
                style={styles.generatePDFButton}
                onPress={handleConfirmPhotos}
                disabled={isGeneratingPDF}
              >
                <Check size={24} color="#fff" />
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

        {showConfirmation && (
          <View style={styles.confirmationContainer}>
            {isConvertingToPdf ? (
              <View style={styles.convertingContainer}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={styles.convertingText}>
                  {t('camera.convertingToPdf') || 'Processing images...'}
                </Text>
              </View>
            ) : (
              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={styles.cancelConfirmButton}
                  onPress={handleCancelMultiPage}
                >
                  <X size={16} color="#ef4444" />
                  <Text style={styles.cancelConfirmButtonText}>
                    {t('camera.cancel') || 'Cancel'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinueToAnalyze}
                  disabled={isAnalyzingContract || isUploading}
                >
                  <Upload size={20} color="#ffffff" />
                  <Text style={styles.continueButtonText}>
                    {isAnalyzingContract || isUploading 
                      ? (t('processing') || 'Processing...') 
                      : (t('camera.continueToAnalyze') || 'Analyze Document')
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  permissionContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#000', 
    padding: 20 
  },
  permissionText: { 
    color: '#fff', 
    fontSize: 18, 
    textAlign: 'center', 
    marginBottom: 20 
  },
  permissionButton: { 
    backgroundColor: '#10b981', 
    padding: 15, 
    borderRadius: 10 
  },
  permissionButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  overlay: { 
    flex: 1, 
    justifyContent: 'space-between', 
    backgroundColor: 'transparent' 
  },
  header: { 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },
  iconButton: { 
    padding: 8 
  },
  headerText: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  frameContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  scanFrame: { 
    width: '90%', 
    aspectRatio: 1 / 1.4, 
    borderWidth: 2, 
    borderColor: 'rgba(255, 255, 255, 0.8)', 
    borderRadius: 16, 
    borderStyle: 'dashed' 
  },
  instructionText: { 
    color: '#fff', 
    marginTop: 20, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16
  },
  imagePreviewContainer: { 
    position: 'absolute', 
    top: 100, 
    left: 16, 
    right: 16, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    borderRadius: 12, 
    padding: 12 
  },
  imagePreviewList: { 
    marginBottom: 8 
  },
  previewImageContainer: { 
    width: 60, 
    height: 80, 
    marginRight: 8, 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    borderRadius: 8, 
    position: 'relative' 
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    resizeMode: 'cover'
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
  imageCountText: { 
    color: '#fff', 
    fontSize: 14, 
    textAlign: 'center', 
    fontWeight: 'bold' 
  },
  controls: { 
    justifyContent: 'space-around', 
    alignItems: 'center', 
    paddingBottom: 30 
  },
  centerControls: { 
    alignItems: 'center', 
    gap: 12 
  },
  sideButton: { 
    alignItems: 'center', 
    gap: 4 
  },
  sideButtonText: { 
    color: '#fff', 
    fontSize: 12 
  },
  captureButton: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#fff', 
    borderWidth: 4, 
    borderColor: 'rgba(0,0,0,0.3)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  multiPageCaptureButton: { 
    backgroundColor: '#10b981' 
  },
  generatePDFButton: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#10b981', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  confirmationContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 16,
    alignItems: 'center',
  },
  convertingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  convertingText: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '500',
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cancelConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  cancelConfirmButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CameraScreen;
