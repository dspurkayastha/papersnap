import React, { useState } from 'react';
import { View, Text, Button, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';

type Props = NativeStackScreenProps<AppStackParamList, 'CaptureUpload'>;

const CaptureUploadScreen: React.FC<Props> = ({ route, navigation }) => {
  const { caseId } = route.params;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const requestPermission = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is needed to take photos.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Media library permission is needed to select images.');
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermission('library');
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const captureImage = async () => {
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!imageUri) {
      Alert.alert('Select Image', 'Please select or capture an image first.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: 'document.jpg',
        type: 'image/jpeg',
      } as any);

      await api.post(`/cases/${caseId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Success', 'Document uploaded.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.response?.data?.message || 'Unable to upload document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Document</Text>
      <View style={styles.buttonRow}>
        <Button title="Choose from Library" onPress={pickImage} />
        <Button title="Capture Photo" onPress={captureImage} />
      </View>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.preview} />
      ) : (
        <Text style={styles.placeholder}>No image selected.</Text>
      )}
      {uploading ? (
        <ActivityIndicator size="large" style={styles.spinner} />
      ) : (
        <Button title="Upload" onPress={handleUpload} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  preview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholder: {
    marginBottom: 16,
    color: '#666',
  },
  spinner: {
    marginVertical: 16,
  },
});

export default CaptureUploadScreen;
