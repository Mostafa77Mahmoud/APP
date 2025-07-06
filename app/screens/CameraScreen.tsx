
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
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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

  const takePicture = async () => {
    if (!cameraRef.current) {
      Alert.alert(t('camera.error'), t('camera.notAvailable'));
      return;
    }

    try {
      setIsProcessing(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
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

  const convertImageToBase64 = async (imageUri: string): Promise<string> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  const generatePDFFromImages = async (): Promise<{ uri: string; name: string; type: string } | null> => {
    try {
      if (capturedImages.length === 0) {
        throw new Error('No images to convert');
      }

      setIsGeneratingPDF(true);

      // Convert all images to base64
      const base64Images = await Promise.all(
        capturedImages.map(async (image) => {
          const base64 = await convertImageToBase64(image.uri);
          return { ...image, base64 };
        })
      );

      // Create HTML content for PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Contract Document</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .header {
              text-align: center;
              padding: 20px;
              border-bottom: 2px solid #10b981;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #10b981;
              font-size: 24px;
              margin-bottom: 10px;
            }
            .header p {
              color: #666;
              font-size: 14px;
            }
            .page {
              page-break-after: always;
              margin-bottom: 40px;
              padding: 20px;
              text-align: center;
            }
            .page:last-child {
              page-break-after: avoid;
            }
            .page-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 20px;
              color: #2d3748;
            }
            .image-container {
              border: 2px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px;
              background: #f7fafc;
              margin-bottom: 20px;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 4px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .page-info {
              margin-top: 15px;
              padding: 10px;
              background: #edf2f7;
              border-radius: 4px;
              font-size: 12px;
              color: #4a5568;
            }
            .footer {
              position: fixed;
              bottom: 20px;
              left: 0;
              right: 0;
              text-align: center;
              font-size: 10px;
              color: #a0aec0;
            }
            @media print {
              .page {
                margin: 0;
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Contract Analysis Document</h1>
            <p>Generated on ${new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <p>Total Pages: ${capturedImages.length}</p>
          </div>
          
          ${base64Images.map((image, index) => `
            <div class="page">
              <div class="page-title">Page ${index + 1} of ${capturedImages.length}</div>
              <div class="image-container">
                <img src="${image.base64}" alt="Contract Page ${index + 1}" />
              </div>
              <div class="page-info">
                <strong>Image Details:</strong><br>
                Resolution: ${image.width} × ${image.height}px<br>
                Captured: ${new Date(image.timestamp).toLocaleString()}
              </div>
            </div>
          `).join('')}
          
          <div class="footer">
            <p>Generated by Sharia Contract Analyzer</p>
          </div>
        </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        width: 612,
        height: 792,
        margins: {
          left: 20,
          top: 20,
          right: 20,
          bottom: 20,
        },
      });

      const fileName = `contract_${Date.now()}.pdf`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;

      // Move to permanent location
      await FileSystem.moveAsync({
        from: uri,
        to: permanentUri,
      });

      return {
        uri: permanentUri,
        name: fileName,
        type: 'application/pdf'
      };

    } catch (error) {
      console.error('PDF generation error:', error);
      Alert.alert(
        t('camera.pdfError'),
        'Failed to generate PDF. Please try again.'
      );
      return null;
    } finally {
      setIsGeneratingPDF(false);
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

      console.log('Generated PDF:', pdfFile);

      // Show success message with option to share
      Alert.alert(
        'PDF Generated Successfully',
        'Your contract has been converted to PDF format.',
        [
          {
            text: 'Share PDF',
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(pdfFile.uri);
              }
            }
          },
          {
            text: 'Analyze',
            style: 'default',
            onPress: async () => {
              // Upload the contract for analysis
              const result = await uploadContract(pdfFile);
              if (result.success && result.sessionId) {
                onNavigate('results', { sessionId: result.sessionId });
              } else {
                throw new Error(result.error || 'Upload failed');
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Processing error:', error);
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
            <Ionicons name="camera" size={20} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.retakeButtonText}>{t('camera.retake')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.confirmButton, (isProcessing || isGeneratingPDF) && styles.disabledButton]}
            onPress={handleConfirm}
            disabled={isProcessing || isGeneratingPDF}
          >
            {isProcessing || isGeneratingPDF ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="document-text" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.confirmButtonText}>Generate PDF</Text>
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

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraType}
        flash={flashMode}
      >
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
                <Text style={styles.captureCount}>
                  {capturedImages.length} {t('camera.pages')}
                </Text>
              )}
            </View>
          </View>
        </View>
      </CameraView>

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
