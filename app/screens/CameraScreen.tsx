import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { uploadContract } from '../services/api';

const { width, height } = Dimensions.get('window');

interface CameraScreenProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface CapturedImage {
  uri: string;
  width: number;
  height: number;
  timestamp: number;
  base64?: string;
}

interface GeneratedDocument {
  uri: string;
  name: string;
  type: string;
  data?: any;
  file?: File; // For web platform File object
  images?: CapturedImage[]; // For multi-page processing
}

const CameraScreen: React.FC<CameraScreenProps> = ({ onBack, onNavigate }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [isMultiPage, setIsMultiPage] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    requestCameraAndMediaPermissions();
  }, []);

  const requestCameraAndMediaPermissions = async () => {
    try {
      if (!permission?.granted) {
        await requestPermission();
      }

      const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!mediaLibraryPermission.granted) {
        Alert.alert(
          t('camera.permissionRequired'),
          t('camera.mediaPermissionMessage')
        );
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  };

  // Web-compatible base64 conversion
  const convertImageToBase64Web = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Web-compatible image to base64 conversion
  const convertImageToBase64 = async (imageUri: string): Promise<string> => {
    try {
      if (Platform.OS === 'web') {
        // For web, we'll create a canvas to convert the image
        return new Promise((resolve, reject) => {
          const img = new globalThis.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;

            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const dataURL = canvas.toDataURL('image/jpeg', 0.9);
              resolve(dataURL);
            } else {
              reject(new Error('Failed to get canvas context'));
            }
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = imageUri;
        });
      } else {
        // For native platforms, use expo-file-system
        const FileSystem = require('expo-file-system');
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert(t('camera.error'), t('camera.notAvailable'));
      return;
    }

    try {
      setIsProcessing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: Platform.OS !== 'web', // Only get base64 on native
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('Failed to capture image');
      }

      const newImage: CapturedImage = {
        uri: photo.uri,
        width: photo.width || width,
        height: photo.height || height,
        timestamp: Date.now(),
      };

      if (isMultiPage) {
        setCapturedImages(prev => [...prev, newImage]);
        // Show brief success feedback without blocking the workflow
        const newCount = capturedImages.length + 1;

        // Auto-preview after 3+ pages or give user choice for fewer pages
        if (newCount >= 3) {
          Alert.alert(
            `Page ${newCount} Added`,
            'You have captured multiple pages. You can continue adding more or review your pages.',
            [
              { text: 'Add More', style: 'default' },
              { text: 'Review & Continue', onPress: () => setShowPreview(true) }
            ]
          );
        } else {
          // For 1-2 pages, just show a quick confirmation
          console.log(`Page ${newCount} captured successfully`);
        }
      } else {
        setCapturedImages([newImage]);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert(t('camera.error'), t('camera.captureError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const retakePicture = () => {
    setCapturedImages([]);
    setShowPreview(false);
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    if (capturedImages.length === 1){
      setShowPreview(false);
    }
  };

  // Generate PDF document from captured images using react-native-html-to-pdf
  const generateDocumentFromImages = async (images: CapturedImage[]): Promise<GeneratedDocument> => {
    if (Platform.OS === 'web') {
      try {
        console.log('Generating web document from', images.length, 'images');
        
        // For web platform, we'll create a multi-page document with images
        // Convert images to base64 for embedding in HTML
        const imageDataPromises = images.map(async (image, index) => {
          console.log(`Converting image ${index + 1} to base64`);
          const base64 = await convertImageToBase64(image.uri);
          return base64;
        });

        const imageBase64Array = await Promise.all(imageDataPromises);
        console.log('All images converted to base64');

        // Create a text file containing the image data for backend processing
        const fileName = `contract_multipage_${Date.now()}.txt`;
        const imageDataString = JSON.stringify({
          images: imageBase64Array,
          metadata: {
            totalPages: images.length,
            timestamp: Date.now(),
            captureInfo: images.map((img, index) => ({
              pageNumber: index + 1,
              width: img.width,
              height: img.height,
              timestamp: img.timestamp
            }))
          }
        });

        // Create a Blob for web upload
        const blob = new Blob([imageDataString], { type: 'text/plain' });
        const file = new File([blob], fileName, { type: 'text/plain' });

        console.log('Created file:', { name: fileName, size: file.size, type: file.type });

        return {
          uri: URL.createObjectURL(blob),
          name: fileName,
          type: 'text/plain',
          size: file.size,
          file: file, // Include the File object for web FormData
          images: images, // Include images for multi-page processing
        };
      } catch (error) {
        console.error('Error creating web document:', error);
        throw new Error(`Failed to generate document for web platform: ${error.message}`);
      }
    }

    try {
      console.log('Generating native document from', images.length, 'images');
      
      // For native platforms, try to use react-native-html-to-pdf if available
      try {
        const RNHTMLtoPDF = await import('react-native-html-to-pdf');

        // Convert images to base64 for embedding in HTML
        const imageDataPromises = images.map(async (image, index) => {
          console.log(`Converting native image ${index + 1} to base64`);
          const base64 = await convertImageToBase64(image.uri);
          return base64;
        });

        const imageBase64Array = await Promise.all(imageDataPromises);
        console.log('All native images converted to base64');

        // Build HTML string with all images, each on a separate page
        let htmlContent = '<html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif;">';

        imageBase64Array.forEach((base64Image, index) => {
          const isLastImage = index === imageBase64Array.length - 1;
          const pageBreakStyle = isLastImage ? '' : 'page-break-after: always; ';

          htmlContent += `
            <div style="${pageBreakStyle}text-align: center;">
              <img src="${base64Image}" style="width:100%; height:auto; margin-bottom: 20px;" />
            </div>
          `;
        });

        htmlContent += '</body></html>';

        // Generate PDF file name
        const fileName = `contract_${Date.now()}.pdf`;

        // PDF generation options
        const options = {
          html: htmlContent,
          fileName: fileName,
          directory: 'Documents',
          base64: false,
        };

        // Generate PDF using react-native-html-to-pdf
        const pdf = await RNHTMLtoPDF.default.convert(options);

        console.log('PDF generated:', pdf.filePath);

        return {
          uri: pdf.filePath,
          name: fileName,
          type: 'application/pdf',
        };
      } catch (pdfError) {
        console.log('PDF generation failed, falling back to text format:', pdfError.message);
        
        // Fallback: Create a text file with image data (similar to web approach)
        const imageDataPromises = images.map(async (image, index) => {
          console.log(`Converting fallback image ${index + 1} to base64`);
          const base64 = await convertImageToBase64(image.uri);
          return base64;
        });

        const imageBase64Array = await Promise.all(imageDataPromises);
        
        const fileName = `contract_multipage_${Date.now()}.txt`;
        const imageDataString = JSON.stringify({
          images: imageBase64Array,
          metadata: {
            totalPages: images.length,
            timestamp: Date.now(),
            captureInfo: images.map((img, index) => ({
              pageNumber: index + 1,
              width: img.width,
              height: img.height,
              timestamp: img.timestamp
            }))
          }
        });

        // For native, we'll create a temporary file
        const FileSystem = require('expo-file-system');
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, imageDataString);

        console.log('Text file generated:', fileUri);

        return {
          uri: fileUri,
          name: fileName,
          type: 'text/plain',
          images: images,
        };
      }
    } catch (error) {
      console.error('Error generating document:', error);
      throw new Error(`Failed to generate document: ${error.message}`);
    }
  };

  const handleConfirm = async () => {
    if (capturedImages.length === 0) {
      Alert.alert(t('camera.error'), t('camera.noImages'));
      return;
    }

    setIsProcessing(true);
    setIsGeneratingPDF(true);

    try {
      console.log('Starting document generation for', capturedImages.length, 'images');
      
      // Generate document from images
      const documentFile = await generateDocumentFromImages(capturedImages);

      if (!documentFile || !documentFile.uri) {
        throw new Error('Generated document is invalid - missing URI');
      }

      if (Platform.OS === 'web' && !documentFile.file) {
        throw new Error('Generated document is invalid - missing file object for web');
      }

      console.log('Document generation successful:', {
        uri: documentFile.uri,
        name: documentFile.name,
        type: documentFile.type,
        size: documentFile.size || 'unknown',
        hasFile: !!documentFile.file,
        hasImages: !!documentFile.images,
        imageCount: documentFile.images?.length || 0
      });

      setIsGeneratingPDF(false);

      // Store the page count before clearing
      const pageCount = capturedImages.length;

      // Clear captured images and reset camera state
      setCapturedImages([]);
      setShowPreview(false);

      // Navigate to upload screen with the generated document
      // This provides the same UX as regular file uploads
      onNavigate('upload', { 
        preSelectedFile: documentFile,
        fromCamera: true,
        pageCount: pageCount
      });

    } catch (error) {
      console.error('Document generation error:', error);
      setIsGeneratingPDF(false);
      
      Alert.alert(
        'Document Generation Error',
        `Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or use a different approach.`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        quality: 0.9,
        allowsMultipleSelection: isMultiPage,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages: CapturedImage[] = result.assets.map(asset => ({
          uri: asset.uri,
          width: asset.width || width,
          height: asset.height || height,
          timestamp: Date.now(),
        }));

        if (isMultiPage) {
          setCapturedImages(prev => [...prev, ...newImages]);
        } else {
          setCapturedImages(newImages);
        }
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      Alert.alert(t('camera.error'), t('camera.galleryError'));
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="camera-outline" size={64} color="#666" />
        <Text style={styles.permissionText}>{t('camera.permissionDenied')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{t('camera.grantPermission')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showPreview) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0a0a0a' : '#f8fafc' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowPreview(false)} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
            {t('camera.preview')} ({capturedImages.length} {capturedImages.length === 1 ? 'page' : 'pages'})
          </Text>
          <TouchableOpacity onPress={onBack} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.previewContainer} showsVerticalScrollIndicator={false}>
          {capturedImages.map((image, index) => (
            <View key={`${image.uri}-${index}`} style={styles.imagePreview}>
              <Image 
                source={{ uri: image.uri }} 
                style={styles.previewImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="trash" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.pageNumber, { color: isDarkMode ? '#fff' : '#000' }]}>
                {t('camera.page')} {index + 1}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.retakeButton} onPress={retakePicture}>
            <Ionicons name="camera" size={20} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.retakeButtonText}>{t('camera.retake')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, (isProcessing || isGeneratingPDF) && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={isProcessing || isGeneratingPDF}
          >
            {isProcessing || isGeneratingPDF ? (
              <>
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>
                  {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Processing...'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="document-text" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>
                  {Platform.OS === 'web' ? 'Generate Document' : 'Generate PDF'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0a0a0a' : '#f8fafc' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
          {t('camera.title')}
        </Text>
        <TouchableOpacity
          onPress={() => setIsMultiPage(!isMultiPage)}
          style={[styles.headerButton, isMultiPage && styles.activeButton]}
        >
          <Ionicons name="documents" size={24} color={isMultiPage ? '#10b981' : (isDarkMode ? '#fff' : '#000')} />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraType}
          flash={flashMode}
        />

        {/* Camera Overlay with absolute positioning */}
        <View style={styles.cameraOverlay}>
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setFlashMode(flashMode === 'off' ? 'on' : 'off')}
            >
              <Ionicons
                name={flashMode === 'off' ? 'flash-off' : 'flash'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setCameraType(cameraType === 'back' ? 'front' : 'back')}
            >
              <Ionicons name="camera-reverse" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
              <Ionicons name="images" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureButton, isProcessing && styles.disabledButton]}
              onPress={takePicture}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>

            <View style={styles.captureInfo}>
              {capturedImages.length > 0 && (
                <View style={styles.pageCounter}>
                  <Text style={styles.captureCount}>
                    {capturedImages.length} {capturedImages.length === 1 ? 'page' : 'pages'}
                  </Text>
                  {isMultiPage && capturedImages.length > 0 && (
                    <TouchableOpacity
                      style={styles.previewButton}
                      onPress={() => setShowPreview(true)}
                    >
                      <Ionicons name="eye" size={16} color="#10b981" />
                      <Text style={styles.previewButtonText}>Preview</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {isMultiPage && (
        <View style={[styles.modeIndicator, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}>
          <Ionicons name="documents" size={16} color="#10b981" style={{ marginRight: 8 }} />
          <Text style={[styles.modeText, { color: isDarkMode ? '#fff' : '#000' }]}>
            {t('camera.multiPageMode')}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  activeButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
  },
  captureInfo: {
    width: 80,
    alignItems: 'center',
  },
  pageCounter: {
    alignItems: 'center',
  },
  captureCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  previewButtonText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
  },
  modeIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  imagePreview: {
    marginVertical: 8,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageNumber: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  retakeButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 32,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#10b981',
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CameraScreen;