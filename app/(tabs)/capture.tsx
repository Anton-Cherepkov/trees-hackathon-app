import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export default function CaptureScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const takePicture = async () => {
    try {
      setLoading(true);
      
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Требуется разрешение', 'Для съёмки фотографий требуется разрешение на использование камеры.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Copy image to app's document directory for persistence
        try {
          const fileName = `tree_${Date.now()}.jpg`;
          const destinationUri = `${FileSystem.documentDirectory}${fileName}`;
          
          await FileSystem.copyAsync({
            from: result.assets[0].uri,
            to: destinationUri,
          });
          
          console.log('Image copied to document directory:', destinationUri);
          router.push({
            pathname: '/tree-detection',
            params: { imageUri: destinationUri },
          });
        } catch (copyError) {
          console.log('Failed to copy image, using original URI:', copyError);
          // Fallback to original URI if copy fails
          router.push({
            pathname: '/tree-detection',
            params: { imageUri: result.assets[0].uri },
          });
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сделать снимок');
      console.error('Camera error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectFromGallery = async () => {
    try {
      setLoading(true);
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Требуется разрешение', 'Для выбора фотографий требуется разрешение на доступ к галерее.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Copy gallery image to app's document directory for consistency
        try {
          const fileName = `tree_${Date.now()}.jpg`;
          const destinationUri = `${FileSystem.documentDirectory}${fileName}`;
          
          await FileSystem.copyAsync({
            from: result.assets[0].uri,
            to: destinationUri,
          });
          
          console.log('Gallery image copied to document directory:', destinationUri);
          router.push({
            pathname: '/tree-detection',
            params: { imageUri: destinationUri },
          });
        } catch (copyError) {
          console.log('Failed to copy gallery image, using original URI:', copyError);
          // Fallback to original URI if copy fails
          router.push({
            pathname: '/tree-detection',
            params: { imageUri: result.assets[0].uri },
          });
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение из галереи');
      console.error('Gallery error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Съёмка деревьев</Text>
        <Text style={styles.subtitle}>
          Сфотографируйте или выберите из галереи для обнаружения деревьев
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.option, styles.cameraOption]}
            onPress={takePicture}
            disabled={loading}
          >
            <View style={styles.iconContainer}>
              <Camera size={48} color="#ffffff" />
            </View>
            <Text style={[styles.optionTitle, styles.cameraText]}>Сфотографировать</Text>
            <Text style={[styles.optionDescription, styles.cameraText]}>
              Используйте камеру для съёмки деревьев в поле
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, styles.galleryOption]}
            onPress={selectFromGallery}
            disabled={loading}
          >
            <View style={[styles.iconContainer, styles.galleryIconContainer]}>
              <ImageIcon size={48} color="#22c55e" />
            </View>
            <Text style={styles.optionTitle}>Выбрать из галереи</Text>
            <Text style={styles.optionDescription}>
              Выберите существующее фото с вашего устройства
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 24,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  option: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraOption: {
    backgroundColor: '#22c55e',
  },
  galleryOption: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  galleryIconContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  cameraText: {
    color: '#ffffff',
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    flexWrap: 'wrap',
  },
});