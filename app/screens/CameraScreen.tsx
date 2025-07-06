
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
    if (capturedImages.length === 1) {
      setShowPreview(false);
    }
  };

  // Enhanced document generation with proper multi-page support
  const generateDocumentFromImages = async (): Promise<{ uri: string; name: string; type: string; images?: any[]; file?: File } | null> => {
    try {
      if (capturedImages.length === 0) {
        throw new Error('No images to convert');
      }

      setIsGeneratingPDF(true);

      // Convert all images to base64
      const base64Images = await Promise.all(
        capturedImages.map(async (image, index) => {
          try {
            const base64 = await convertImageToBase64(image.uri);
            return { ...image, base64, pageNumber: index + 1 };
          } catch (error) {
            console.error(`Error converting image ${index + 1}:`, error);
            throw new Error(`Failed to process page ${index + 1}`);
          }
        })
      );

      const timestamp = Date.now();
      const fileName = `contract_${timestamp}`;

      if (Platform.OS === 'web') {
        // Create HTML content for download
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Contract Document - ${capturedImages.length} ${capturedImages.length === 1 ? 'Page' : 'Pages'}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
              .container { max-width: 800px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 30px; }
              .header h1 { color: #10b981; font-size: 28px; margin-bottom: 10px; }
              .header p { color: #6b7280; font-size: 16px; }
              .page { background: white; border-radius: 12px; padding: 30px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); page-break-after: always; }
              .page:last-child { page-break-after: avoid; margin-bottom: 0; }
              .page-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #1f2937; text-align: center; }
              .image-container { text-align: center; border: 2px dashed #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb; }
              img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
              .page-info { margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 8px; font-size: 14px; color: #6b7280; }
              .stats { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
              @media print { 
                body { background: white; }
                .container { max-width: none; padding: 0; }
                .page { margin-bottom: 0; box-shadow: none; border-radius: 0; }
              }
              @media (max-width: 768px) {
                .container { padding: 10px; }
                .header, .page { padding: 20px; }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📄 Contract Analysis Document</h1>
                <p>Generated on ${new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p><strong>${capturedImages.length}</strong> ${capturedImages.length === 1 ? 'Page' : 'Pages'} • Ready for Sharia Compliance Analysis</p>
              </div>
              
              ${base64Images.map((image, index) => `
                <div class="page">
                  <div class="page-title">📋 Page ${index + 1} of ${capturedImages.length}</div>
                  <div class="image-container">
                    <img src="${image.base64}" alt="Contract Page ${index + 1}" loading="lazy" />
                  </div>
                  <div class="page-info">
                    <div class="stats">
                      <span><strong>Resolution:</strong> ${image.width} × ${image.height}px</span>
                      <span><strong>Captured:</strong> ${new Date(image.timestamp).toLocaleString()}</span>
                      <span><strong>Quality:</strong> High</span>
                    </div>
                  </div>
                </div>
              `).join('')}
              
              <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
                <p>🔒 This document is ready for secure Sharia compliance analysis</p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Create HTML blob for download
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const htmlUrl = URL.createObjectURL(htmlBlob);
        
        // Auto-download the HTML document
        const a = document.createElement('a');
        a.href = htmlUrl;
        a.download = `${fileName}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // For multi-page uploads, return the first image as the primary file
        // and pass the rest as additional data
        if (capturedImages.length === 1) {
          // Single page - send as regular image
          const singleImageBlob = await fetch(base64Images[0].base64).then(r => r.blob());
          const singleImageFile = new File([singleImageBlob], `${fileName}.jpg`, { type: 'image/jpeg' });
          
          return {
            uri: URL.createObjectURL(singleImageFile),
            name: `${fileName}.jpg`,
            type: 'image/jpeg',
            file: singleImageFile
          };
        } else {
          // Multi-page - create a text file with all base64 images
          const multiPageData = base64Images.map((img, index) => 
            `--- PAGE ${index + 1} ---\n${img.base64}\n`
          ).join('\n');
          
          const multiPageBlob = new Blob([multiPageData], { type: 'text/plain' });
          const multiPageFile = new File([multiPageBlob], `${fileName}_multipage.txt`, { type: 'text/plain' });
          
          return {
            uri: URL.createObjectURL(multiPageFile),
            name: `${fileName}_multipage.txt`,
            type: 'text/plain',
            file: multiPageFile,
            images: base64Images,
            metadata: {
              totalPages: capturedImages.length,
              createdAt: new Date().toISOString(),
              platform: 'web'
            }
          };
        }
      } else {
        // For native platforms, create a text file with base64 data
        if (capturedImages.length === 1) {
          // Single page
          return {
            uri: base64Images[0].uri,
            name: `${fileName}.jpg`,
            type: 'image/jpeg',
            images: base64Images
          };
        } else {
          // Multi-page
          const multiPageData = base64Images.map((img, index) => 
            `--- PAGE ${index + 1} ---\n${img.base64}\n`
          ).join('\n');
          
          return {
            uri: `data:text/plain;charset=utf-8,${encodeURIComponent(multiPageData)}`,
            name: `${fileName}_multipage.txt`,
            type: 'text/plain',
            images: base64Images,
            metadata: {
              totalPages: capturedImages.length,
              createdAt: new Date().toISOString(),
              platform: 'native'
            }
          };
        }
      }
    } catch (error) {
      console.error('Document generation error:', error);
      Alert.alert(
        'Document Generation Error',
        error instanceof Error ? error.message : 'Failed to generate document. Please try again.'
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
      // Generate document from images
      const documentFile = await generateDocumentFromImages();

      if (!documentFile) {
        throw new Error('Failed to generate document');
      }

      console.log('Generated document:', documentFile);

      // Automatically proceed to analysis without showing intermediate alert
      console.log('Starting contract analysis upload...');
      setUploadProgress(0);
      
      const result = await uploadContract(documentFile, (progress) => {
        console.log(`Upload progress: ${progress}%`);
        setUploadProgress(progress);
      });
      
      if (result && result.session_id) {
        console.log('Upload successful, navigating to results');
        setUploadProgress(100);
        
        // Brief delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clear captured images and reset state
        setCapturedImages([]);
        setShowPreview(false);
        setUploadProgress(0);
        onNavigate('results', { sessionId: result.session_id });
      } else {
        throw new Error('Invalid response from analysis service');
      }
    } catch (error) {
      console.error('Processing/Upload error:', error);
      setUploadProgress(0);
      Alert.alert(
        'Analysis Error',
        `Failed to process and upload document: ${error instanceof Error ? error.message : 'Unknown error'}`
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
