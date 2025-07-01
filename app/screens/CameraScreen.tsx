// app/screens/CameraScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Corrected Import: Import Camera, CameraType, and CameraView as named exports
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeft, ArrowRight, Image as ImageIcon, File as FileIcon, RefreshCw } from 'lucide-react-native';
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
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
        if (photo) {
          const file = { uri: photo.uri, type: 'image/jpeg', name: 'capture.jpg' };
          await handleAnalysis(file);
        }
      } catch (error) {
        Alert.alert(t('error.generic'), t('error.cameraFailed'));
      }
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

        <View style={[styles.controls, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={styles.sideButton} onPress={pickImage}>
            <ImageIcon size={28} color="#fff" />
            <Text style={styles.sideButtonText}>{t('camera.gallery')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture} />
          <TouchableOpacity style={styles.sideButton} onPress={() => onNavigate('upload')}>
            <FileIcon size={28} color="#fff" />
            <Text style={styles.sideButtonText}>{t('camera.files')}</Text>
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
  controls: { justifyContent: 'space-around', alignItems: 'center', paddingBottom: 30 },
  sideButton: { alignItems: 'center', gap: 4 },
  sideButtonText: { color: '#fff', fontSize: 12 },
  captureButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(0,0,0,0.3)' },
});

export default CameraScreen;