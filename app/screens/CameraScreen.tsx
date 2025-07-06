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
import { Camera, CameraType, FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
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
}

const CameraScreen: React.FC<CameraScreenProps> = ({ onBack, onNavigate }) => {
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState(CameraType.back);
  const [flashMode, setFlashMode] = useState(FlashMode.off);
  const [isMultiPage, setIsMultiPage] = useState(false);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    const cameraPermission = await Camera.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    setHasPermission(
      cameraPermission.status === 'granted' && mediaLibraryPermission.status === 'granted'
    );
  };

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert(t('camera.error'), t('camera.notAvailable'));
      return;
    }

    try {
      setIsProcessing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      const newImage: CapturedImage = {
        uri: photo.uri,
        width: photo.width || width,
        height: photo.height || height,
      };

      if (isMultiPage) {
        setCapturedImages(prev => [...prev, newImage]);
        Alert.alert(
          t('camera.pageAdded'),
          t('camera.pageAddedMessage', { count: capturedImages.length + 1 }),
          [
            { text: t('camera.addMore'), style: 'default' },
            { text: t('camera.finish'), onPress: () => setShowPreview(true) }
          ]
        );
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
    if (capturedImages.length === 1) {
      setShowPreview(false);
    }
  };

  const generatePDFFromImages = async (): Promise<{ uri: string; name: string; type: string } | null> => {
    try {
      if (capturedImages.length === 0) {
        throw new Error('No images to convert');
      }

      // For web platform, we'll create a simple PDF-like structure
      if (Platform.OS === 'web') {
        // Create a basic HTML structure that can be converted to PDF
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Contract Document</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .page { page-break-after: always; margin-bottom: 20px; }
              .page:last-child { page-break-after: avoid; }
              img { max-width: 100%; height: auto; border: 1px solid #ccc; }
              .page-number { text-align: center; margin-top: 10px; color: #666; }
            </style>
          </head>
          <body>
            ${capturedImages.map((image, index) => `
              <div class="page">
                <img src="${image.uri}" alt="Contract Page ${index + 1}" />
                <div class="page-number">Page ${index + 1} of ${capturedImages.length}</div>
              </div>
            `).join('')}
          </body>
          </html>
        `;

        // Create a blob with the HTML content
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const uri = URL.createObjectURL(blob);

        return {
          uri: uri,
          name: `contract_${Date.now()}.html`,
          type: 'text/html'
        };
      }

      // For native platforms, use the first image as primary
      const primaryImage = capturedImages[0];

      // Copy the image to a permanent location
      const fileName = `contract_${Date.now()}.jpg`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: primaryImage.uri,
        to: permanentUri,
      });

      return {
        uri: permanentUri,
        name: fileName,
        type: 'image/jpeg'
      };

    } catch (error) {
      console.error('PDF generation error:', error);
      return null;
    }
  };

  const handleConfirm = async () => {
    if (capturedImages.length === 0) {
      Alert.alert(t('camera.error'), t('camera.noImages'));
      return;
    }

    setIsProcessing(true);

    try {
      // Generate PDF from images
      const pdfFile = await generatePDFFromImages();

      if (!pdfFile) {
        throw new Error('Failed to generate PDF');
      }

      console.log('Generated file:', pdfFile);

      // Upload the contract
      const result = await uploadContract(pdfFile);

      if (result.success && result.sessionId) {
        // Navigate to results screen
        onNavigate('results', { sessionId: result.sessionId });
      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        t('camera.uploadError'),
        error instanceof Error ? error.message : t('camera.uploadErrorMessage')
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
        quality: 0.8,
        allowsMultipleSelection: isMultiPage,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages: CapturedImage[] = result.assets.map(asset => ({
          uri: asset.uri,
          width: asset.width || width,
          height: asset.height || height,
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

  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>{t('camera.requestingPermission')}</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="camera-outline" size={64} color="#666" />
        <Text style={styles.permissionText}>{t('camera.permissionDenied')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
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
            {t('camera.preview')}
          </Text>
          <TouchableOpacity onPress={onBack} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={isDarkMode ? '#fff' : '#000'} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.previewContainer}>
          {capturedImages.map((image, index) => (
            <View key={index} style={styles.imagePreview}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
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
            <Text style={styles.retakeButtonText}>{t('camera.retake')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, isProcessing && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>{t('camera.confirm')}</Text>
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

      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setFlashMode(flashMode === FlashMode.off ? FlashMode.on : FlashMode.off)}
            >
              <Ionicons
                name={flashMode === FlashMode.off ? 'flash-off' : 'flash'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setCameraType(cameraType === CameraType.back ? CameraType.front : CameraType.back)}
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
                <Text style={styles.captureCount}>
                  {capturedImages.length} {t('camera.pages')}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Camera>

      {isMultiPage && (
        <View style={[styles.modeIndicator, { backgroundColor: isDarkMode ? '#1a1a1a' : '#fff' }]}>
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
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
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
    width: 48,
    alignItems: 'center',
  },
  captureCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
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
    resizeMode: 'contain',
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