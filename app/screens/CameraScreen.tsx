
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useIsFocused } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, ArrowRight, Image as ImageIcon, File as FileIcon, RefreshCw, Plus, Check, X, Upload, Camera, FlashOff, FlashOn, RotateCcw } from 'lucide-react-native';
import AnalyzingAnimation from '../components/AnalyzingAnimation';
import { ScreenType } from '../MobileApp';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

interface CapturedImage {
  uri: string;
  id: string;
  width?: number;
  height?: number;
  size?: number;
}

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

  // Camera states
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isMultiPageMode, setIsMultiPageMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleAnalysis = async (file: any) => {
    console.log('📤 Uploading file:', file);
    const sessionId = await uploadAndAnalyzeContract(file);
    if (sessionId) {
      onNavigate('results', { sessionId });
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        setProcessingStep('Capturing image...');
        const photo = await cameraRef.current.takePictureAsync({ 
          quality: 0.9,
          base64: false,
          skipProcessing: false,
          exif: false,
        });

        if (photo) {
          console.log('📸 Photo captured:', { 
            uri: photo.uri, 
            width: photo.width, 
            height: photo.height 
          });

          if (isMultiPageMode) {
            const newImage: CapturedImage = {
              uri: photo.uri,
              id: Date.now().toString(),
              width: photo.width,
              height: photo.height,
            };
            setCapturedImages(prev => [...prev, newImage]);
            setProcessingStep('');
          } else {
            // Single image mode - process and upload directly
            await processSingleImage(photo);
          }
        }
      } catch (error) {
        console.error('❌ Camera capture error:', error);
        Alert.alert(
          t('error.generic') || 'Error', 
          t('camera.captureError') || 'Failed to capture image. Please try again.'
        );
        setProcessingStep('');
      }
    }
  };

  const processSingleImage = async (photo: any) => {
    try {
      setIsGeneratingPDF(true);
      setProcessingStep('Processing image...');

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(photo.uri);
      
      if (!fileInfo.exists) {
        throw new Error('Captured image file not found');
      }

      // Create a proper file object for upload
      const imageFile = {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `camera_capture_${Date.now()}.jpg`,
        size: fileInfo.size || 0,
      };

      console.log('📤 Uploading single image:', imageFile);
      
      // Clear states before upload
      setCapturedImages([]);
      setIsMultiPageMode(false);
      setShowConfirmation(false);
      setProcessingStep('');
      
      await handleAnalysis(imageFile);
    } catch (error) {
      console.error('❌ Single image processing error:', error);
      Alert.alert(
        t('error.generic') || 'Error',
        'Failed to process image. Please try again.'
      );
      setProcessingStep('');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const removeImage = (id: string) => {
    setCapturedImages(prev => prev.filter(img => img.id !== id));
  };

  const generatePDFFromImages = async (): Promise<void> => {
    if (capturedImages.length === 0) {
      Alert.alert(t('error.generic') || 'Error', 'No images to process');
      return;
    }

    setIsGeneratingPDF(true);
    setProcessingStep('Creating PDF from images...');

    try {
      console.log('🔄 Processing', capturedImages.length, 'images');

      if (capturedImages.length === 1) {
        // Single image - upload as image
        const singleImage = capturedImages[0];
        const fileInfo = await FileSystem.getInfoAsync(singleImage.uri);
        
        const imageFile = {
          uri: singleImage.uri,
          type: 'image/jpeg',
          name: `multipage_single_${Date.now()}.jpg`,
          size: fileInfo.size || 0,
        };

        console.log('📤 Uploading single image from multipage:', imageFile);
        await handleAnalysis(imageFile);
        return;
      }

      // Multiple images - create a simple multi-image PDF using HTML
      setProcessingStep('Generating PDF document...');
      
      // Convert images to base64 for HTML embedding
      const base64Images = await Promise.all(
        capturedImages.map(async (img, index) => {
          try {
            const base64 = await FileSystem.readAsStringAsync(img.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            return {
              id: img.id,
              base64: `data:image/jpeg;base64,${base64}`,
              index: index + 1,
            };
          } catch (error) {
            console.error(`Failed to convert image ${index} to base64:`, error);
            return null;
          }
        })
      );

      const validImages = base64Images.filter(img => img !== null);
      
      if (validImages.length === 0) {
        throw new Error('Failed to process any images');
      }

      // Create HTML content with embedded images
      const htmlContent = createMultiPageHTML(validImages);
      
      // Save HTML file temporarily
      const tempDir = `${FileSystem.documentDirectory}temp/`;
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
      
      const htmlPath = `${tempDir}contract_${Date.now()}.html`;
      await FileSystem.writeAsStringAsync(htmlPath, htmlContent);

      // For web deployment, we'll upload the first image with metadata about other pages
      // In a production app, you would use a proper PDF generation library
      const primaryImage = capturedImages[0];
      const fileInfo = await FileSystem.getInfoAsync(primaryImage.uri);
      
      const multiPageFile = {
        uri: primaryImage.uri,
        type: 'image/jpeg',
        name: `contract_multipage_${capturedImages.length}pages_${Date.now()}.jpg`,
        size: fileInfo.size || 0,
        metadata: {
          totalPages: capturedImages.length,
          pageUrls: capturedImages.map(img => img.uri),
          htmlPath: htmlPath,
        }
      };

      console.log('📤 Uploading multi-page document:', {
        name: multiPageFile.name,
        pages: capturedImages.length,
      });

      // Clear states and upload
      setCapturedImages([]);
      setIsMultiPageMode(false);
      setShowConfirmation(false);
      setProcessingStep('');

      await handleAnalysis(multiPageFile);

    } catch (error) {
      console.error('❌ PDF generation error:', error);
      Alert.alert(
        t('error.generic') || 'Error',
        'Failed to create document from images. Please try uploading individual images instead.'
      );
      setProcessingStep('');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const createMultiPageHTML = (images: any[]): string => {
    const imageElements = images.map(img => `
      <div class="page" style="page-break-after: always; text-align: center; margin: 20px 0; min-height: 90vh;">
        <h3 style="color: #333; margin-bottom: 20px; font-family: Arial, sans-serif;">Page ${img.index}</h3>
        <img src="${img.base64}" style="max-width: 95%; max-height: 85vh; object-fit: contain; border: 1px solid #ddd; border-radius: 8px;" />
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Contract Document - ${new Date().toLocaleDateString()}</title>
          <style>
            @page { 
              size: A4; 
              margin: 2cm; 
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0;
              background: white;
              color: #333;
            }
            .cover {
              text-align: center;
              padding: 50px 20px;
              border-bottom: 2px solid #eee;
              margin-bottom: 30px;
            }
            .cover h1 { 
              color: #2c3e50;
              font-size: 28px;
              margin-bottom: 15px;
            }
            .cover p {
              color: #7f8c8d;
              font-size: 16px;
            }
            .page {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            h3 { 
              color: #34495e; 
              margin-bottom: 20px;
              font-size: 18px;
            }
            @media print {
              body { margin: 0; }
              .page { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          <div class="cover">
            <h1>📄 Contract Document</h1>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Total Pages: ${images.length}</p>
          </div>
          ${imageElements}
        </body>
      </html>
    `;
  };

  const pickImage = async () => {
    try {
      setProcessingStep('Opening gallery...');
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsEditing: false,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('🖼️ Gallery image selected:', asset);
        
        const file = { 
          uri: asset.uri, 
          type: asset.mimeType || 'image/jpeg', 
          name: asset.fileName || `gallery_image_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
        };
        
        setProcessingStep('');
        await handleAnalysis(file);
      } else {
        setProcessingStep('');
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Alert.alert(
        t('error.generic') || 'Error', 
        'Failed to select image from gallery'
      );
      setProcessingStep('');
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash(current => (current === 'off' ? 'on' : 'off'));
  };

  const isProcessing = isUploading || isAnalyzingContract || isGeneratingPDF || processingStep !== '';

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
        <Text style={styles.permissionText}>
          {t('camera.noPermission') || 'Camera access is required to capture contract documents'}
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>
            {t('camera.grantPermission') || 'Grant Camera Permission'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isProcessing) {
    return (
      <AnalyzingAnimation 
        isAnalyzing={true} 
        message={processingStep || (isGeneratingPDF ? "Creating document..." : "Processing...")}
      />
    );
  }

  const handleConfirmPhotos = () => {
    if (capturedImages.length === 0) return;
    setShowConfirmation(true);
  };

  const handleContinueToAnalyze = async () => {
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
          facing={facing}
          flash={flash}
          ref={cameraRef}
        />
      )}
      
      <SafeAreaView style={styles.overlay}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity onPress={onBack} style={styles.iconButton}>
            {isRTL ? <ArrowRight size={24} color="#fff" /> : <ArrowLeft size={24} color="#fff" />}
          </TouchableOpacity>
          
          <Text style={styles.headerText}>
            {t('camera.title') || 'Document Scanner'}
          </Text>
          
          <View style={styles.headerControls}>
            <TouchableOpacity style={styles.iconButton} onPress={toggleFlash}>
              {flash === 'on' ? (
                <FlashOn size={20} color="#fff" />
              ) : (
                <FlashOff size={20} color="#fff" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
              <RotateCcw size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Camera Frame */}
        <View style={styles.frameContainer}>
          <View style={styles.scanFrame}>
            <View style={styles.frameCorner} />
            <View style={[styles.frameCorner, styles.frameCornerTopRight]} />
            <View style={[styles.frameCorner, styles.frameCornerBottomLeft]} />
            <View style={[styles.frameCorner, styles.frameCornerBottomRight]} />
          </View>
          
          <Text style={styles.instructionText}>
            {isMultiPageMode 
              ? (t('camera.multiPageInstruction') || 'Capture multiple pages of your contract')
              : (t('camera.instruction') || 'Position contract within frame and capture')
            }
          </Text>

          {isMultiPageMode && (
            <View style={styles.modeIndicator}>
              <FileIcon size={16} color="#10b981" />
              <Text style={styles.modeText}>
                {t('camera.multiPageMode') || 'Multi-Page Mode'}
              </Text>
            </View>
          )}
        </View>

        {/* Image Preview */}
        {isMultiPageMode && capturedImages.length > 0 && (
          <View style={styles.imagePreviewContainer}>
            <FlatList
              horizontal
              data={capturedImages}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: item.uri }} style={styles.previewImage} />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => removeImage(item.id)}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.pageNumber}>{index + 1}</Text>
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

        {/* Controls */}
        <View style={[styles.controls, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={styles.sideButton} onPress={pickImage}>
            <ImageIcon size={28} color="#fff" />
            <Text style={styles.sideButtonText}>
              {t('camera.gallery') || 'Gallery'}
            </Text>
          </TouchableOpacity>

          <View style={styles.centerControls}>
            <TouchableOpacity 
              style={[
                styles.captureButton, 
                isMultiPageMode && styles.multiPageCaptureButton
              ]} 
              onPress={takePicture}
            >
              {isMultiPageMode ? (
                <Plus size={28} color="#000" />
              ) : (
                <Camera size={32} color="#000" />
              )}
            </TouchableOpacity>

            {isMultiPageMode && capturedImages.length > 0 && !showConfirmation && (
              <TouchableOpacity
                style={styles.generatePDFButton}
                onPress={handleConfirmPhotos}
              >
                <Check size={20} color="#fff" />
                <Text style={styles.buttonText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={styles.sideButton} 
            onPress={() => setIsMultiPageMode(!isMultiPageMode)}
          >
            <FileIcon size={28} color={isMultiPageMode ? "#10b981" : "#fff"} />
            <Text style={[styles.sideButtonText, isMultiPageMode && { color: "#10b981" }]}>
              {isMultiPageMode 
                ? (t('camera.single') || 'Single') 
                : (t('camera.multiPage') || 'Multi-Page')
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <View style={styles.confirmationContainer}>
            <View style={styles.confirmationContent}>
              <Text style={styles.confirmationTitle}>
                {t('camera.confirmTitle') || 'Ready to Analyze?'}
              </Text>
              <Text style={styles.confirmationMessage}>
                {capturedImages.length === 1 
                  ? (t('camera.confirmSingle') || 'Process 1 page for analysis?')
                  : (t('camera.confirmMultiple') || `Process ${capturedImages.length} pages for analysis?`)
                }
              </Text>
              
              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelMultiPage}
                >
                  <X size={16} color="#ef4444" />
                  <Text style={styles.cancelButtonText}>
                    {t('camera.cancel') || 'Cancel'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.analyzeButton}
                  onPress={handleContinueToAnalyze}
                >
                  <Upload size={18} color="#ffffff" />
                  <Text style={styles.analyzeButtonText}>
                    {t('camera.analyze') || 'Analyze Document'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
    marginBottom: 20,
    lineHeight: 24,
  },
  permissionButton: { 
    backgroundColor: '#10b981', 
    paddingHorizontal: 24,
    paddingVertical: 12, 
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
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: { 
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginHorizontal: 4,
  },
  headerText: { 
    color: '#fff', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  frameContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  scanFrame: { 
    width: width * 0.85, 
    aspectRatio: 0.7, 
    position: 'relative',
    borderRadius: 16,
  },
  frameCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#10b981',
    borderWidth: 4,
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
  },
  frameCornerTopRight: {
    top: 0,
    right: 0,
    left: 'auto',
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
    borderTopLeftRadius: 0,
  },
  frameCornerBottomLeft: {
    bottom: 0,
    top: 'auto',
    borderTopWidth: 0,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 16,
    borderTopLeftRadius: 0,
  },
  frameCornerBottomRight: {
    bottom: 0,
    right: 0,
    top: 'auto',
    left: 'auto',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 0,
  },
  instructionText: { 
    color: '#fff', 
    marginTop: 30, 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  imagePreviewContainer: { 
    position: 'absolute', 
    top: 120, 
    left: 16, 
    right: 16, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    borderRadius: 16, 
    padding: 16 
  },
  imagePreviewList: { 
    marginBottom: 12 
  },
  previewImageContainer: { 
    width: 70, 
    height: 90, 
    marginRight: 12, 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 12, 
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    resizeMode: 'cover',
  },
  removeImageButton: { 
    position: 'absolute', 
    top: -6, 
    right: -6, 
    backgroundColor: '#ef4444', 
    borderRadius: 14, 
    width: 28, 
    height: 28, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pageNumber: {
    position: 'absolute',
    bottom: -6,
    left: -6,
    backgroundColor: '#10b981',
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
    minWidth: 24,
    textAlign: 'center',
  },
  imageCountText: { 
    color: '#fff', 
    fontSize: 16, 
    textAlign: 'center', 
    fontWeight: '600' 
  },
  controls: { 
    justifyContent: 'space-around', 
    alignItems: 'flex-end', 
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingTop: 20,
  },
  centerControls: { 
    alignItems: 'center', 
    gap: 16 
  },
  sideButton: { 
    alignItems: 'center', 
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  sideButtonText: { 
    color: '#fff', 
    fontSize: 12,
    fontWeight: '500',
  },
  captureButton: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#fff', 
    borderWidth: 6, 
    borderColor: 'rgba(255,255,255,0.3)', 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  multiPageCaptureButton: { 
    backgroundColor: '#10b981',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  generatePDFButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981', 
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmationContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  analyzeButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CameraScreen;
