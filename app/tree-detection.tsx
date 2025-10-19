import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { treeDatabase, BoundingBox } from '@/database/treeDatabase';
import { Check, X, Save, ArrowLeft, RefreshCw, MapPin } from 'lucide-react-native';
import Svg, { Rect, Text as SvgText, G, Circle } from 'react-native-svg';
import { preprocessImage } from '@/utils/preprocessImage';
import { runYOLOInference, DetectedTree } from '@/utils/yoloInference';
import { cropTreeWithDimensions } from '@/utils/treeCropper';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: screenWidth } = Dimensions.get('window');
const imageDisplayWidth = screenWidth - 32;



type GPSStatus = 'determining' | 'unavailable' | 'available' | 'no-exif' | 'exif-available';
type PhotoSource = 'camera' | 'gallery';

export default function TreeDetectionScreen() {
  const { imageUri, latitude, longitude, hasExifLocation, source } = useLocalSearchParams<{ 
    imageUri: string;
    latitude?: string;
    longitude?: string;
    hasExifLocation?: string;
    source?: string;
  }>();
  const [detectedTrees, setDetectedTrees] = useState<DetectedTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [actualImageSize, setActualImageSize] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>('determining');
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photoSource, setPhotoSource] = useState<PhotoSource>('camera');
  const router = useRouter();

  useEffect(() => {
    if (imageUri) {
      console.log('Image URI received:', imageUri);
      
      // Determine photo source from passed parameter
      const isFromGallery = source === 'gallery';
      setPhotoSource(isFromGallery ? 'gallery' : 'camera');
      
      runTreeDetection();
      handleGPSLocation(imageUri, isFromGallery);
    }
  }, [imageUri]);

  const handleGPSLocation = async (imageUri: string, isFromGallery: boolean) => {
    if (isFromGallery) {
      // For gallery photos, check if location was passed from capture screen
      if (hasExifLocation === 'true' && latitude && longitude) {
        const exifLocation = {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        };
        setGpsLocation(exifLocation);
        setGpsStatus('exif-available');
        console.log('EXIF GPS location from capture screen:', exifLocation);
      } else {
        // Fallback: try to extract EXIF data directly
        setGpsStatus('determining');
        const exifLocation = await extractEXIFLocation(imageUri);
        
        if (exifLocation) {
          setGpsLocation(exifLocation);
          setGpsStatus('exif-available');
          console.log('EXIF GPS location found via direct extraction:', exifLocation);
        } else {
          setGpsStatus('no-exif');
          console.log('No EXIF GPS data found in gallery photo');
        }
      }
    } else {
      // For camera photos, fetch current location
      fetchGPSLocation();
    }
  };

  const fetchGPSLocation = async () => {
    try {
      setGpsLoading(true);
      setGpsStatus('determining');
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsStatus('unavailable');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (location) {
        setGpsLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setGpsStatus('available');
        console.log('GPS location obtained:', location.coords.latitude, location.coords.longitude);
      } else {
        setGpsStatus('unavailable');
      }
    } catch (error) {
      console.error('GPS location error:', error);
      setGpsStatus('unavailable');
    } finally {
      setGpsLoading(false);
    }
  };

  const retryGPSLocation = () => {
    fetchGPSLocation();
  };

  const useCurrentLocation = () => {
    fetchGPSLocation();
  };

  const extractEXIFLocation = async (imageUri: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      // Get image metadata including EXIF data
      const metadata = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // For now, we'll use a simple approach to check if the image has location data
      // In a real implementation, you might want to use a library like 'expo-image-picker'
      // or a dedicated EXIF library to extract GPS coordinates
      
      // This is a placeholder - in practice, you'd need to parse the actual EXIF data
      // For now, we'll return null to simulate no EXIF data
      console.log('Attempting to extract EXIF data from:', imageUri);
      return null;
    } catch (error) {
      console.error('EXIF extraction error:', error);
      return null;
    }
  };

  const runTreeDetection = async () => {
    try {
      setLoading(true);
      
      // Preprocess the image
      if (imageUri) {
        console.log('Starting image preprocessing...');
        const preprocessResult = await preprocessImage(imageUri);
        
        // Calculate mean of the preprocessed image data
        const data = preprocessResult.data;
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        const mean = sum / data.length;
        
        console.log('Image preprocessing completed');
        console.log('Preprocessed data shape:', preprocessResult.dims);
        console.log('Mean of preprocessed image data:', mean);
        
        // Run YOLO inference on the preprocessed data
        console.log('Running YOLO inference...');
        const detectedTrees = await runYOLOInference(preprocessResult.data);
        
        console.log('YOLO inference completed');
        console.log(`Found ${detectedTrees.length} trees with confidence > 0.5`);
        
        // Use real YOLO detection results
        setDetectedTrees(detectedTrees);
        
        if (detectedTrees.length === 0) {
          Alert.alert(
            'Деревья не обнаружены', 
            'В этом изображении не найдено деревьев с достаточной уверенностью. Попробуйте сделать другое фото с лучшим освещением или более четкой видимостью деревьев.'
          );
        }
      } else {
        // No image URI provided - this should not happen in normal flow
        console.log('No image URI provided');
        Alert.alert('Ошибка', 'Изображение не найдено. Пожалуйста, вернитесь и выберите изображение снова.');
        router.back();
        return;
      }
    } catch (error) {
      console.error('Detection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      Alert.alert(
        'Ошибка обнаружения', 
        `Не удалось обработать изображение: ${errorMessage}\n\nПопробуйте другое изображение или проверьте подключение к интернету.`
      );
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const toggleTreeSelection = (treeId: string) => {
    setDetectedTrees(prev =>
      prev.map(tree =>
        tree.id === treeId
          ? { ...tree, selected: !tree.selected }
          : tree
      )
    );
  };

  const saveSelectedTrees = async () => {
    try {
      setSaving(true);
      
      const selectedTrees = detectedTrees.filter(tree => tree.selected);
      
      if (selectedTrees.length === 0) {
        Alert.alert('Нет выбора', 'Пожалуйста, выберите хотя бы одно дерево для сохранения.');
        return;
      }

      const currentDate = new Date().toISOString();

      // Save each selected tree to the database (10 times each)
      for (const tree of selectedTrees) {
        console.log(`Processing tree ${tree.id} for cropping and saving...`);
        
        // Crop the tree from the original image
        let cropPath = '';
        try {
          console.log(`Cropping tree ${tree.id}...`);
          cropPath = await cropTreeWithDimensions(
            imageUri!,
            {
              x: tree.x,
              y: tree.y,
              width: tree.width,
              height: tree.height,
            },
            tree.id
          );
          console.log(`Tree ${tree.id} cropped successfully to:`, cropPath);
        } catch (cropError) {
          console.error(`Failed to crop tree ${tree.id}:`, cropError);
          // Continue without crop - don't fail the entire save operation
        }

        // Use real GPS coordinates if available, otherwise use undefined
        const latitude = gpsLocation?.latitude || undefined;
        const longitude = gpsLocation?.longitude || undefined;
        
        const treeRecord = {
          imageUri: imageUri!,
          boundingBox: {
            x: tree.x,
            y: tree.y,
            width: tree.width,
            height: tree.height,
          },
          dateTaken: currentDate,
          description: '',
          additionalImages: [],
          cropPath: cropPath,
          latitude: latitude,
          longitude: longitude,
        };

        console.log('Tree record:', treeRecord);
        console.log('treeDatabase:', treeDatabase);

        // Insert the tree record once
        await treeDatabase.insertTree(treeRecord);
        console.log(`Tree ${tree.id} saved to database successfully`);
      }

      Alert.alert(
        'Успешно',
        `Успешно сохранено ${selectedTrees.length} ${selectedTrees.length === 1 ? 'дерево' : selectedTrees.length < 5 ? 'дерева' : 'деревьев'}!`,
        [
          {
            text: 'ОК',
            onPress: () => {
              router.push('/');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить деревья');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const getImageLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setImageSize({ width, height });
  };

  const renderBoundingBoxes = () => {
    if (!imageSize.width || !imageSize.height || !actualImageSize.width || !actualImageSize.height) return null;

    // Calculate the actual image dimensions within the container
    // The image uses resizeMode="contain" so it maintains aspect ratio
    const containerWidth = imageSize.width;
    const containerHeight = imageSize.height;
    const originalImageWidth = actualImageSize.width;
    const originalImageHeight = actualImageSize.height;
    
    // Calculate the actual displayed image dimensions within the container
    const imageAspectRatio = originalImageWidth / originalImageHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let displayedImageWidth, displayedImageHeight, offsetX, offsetY;
    
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider than container - fit by width
      displayedImageWidth = containerWidth;
      displayedImageHeight = containerWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayedImageHeight) / 2;
    } else {
      // Image is taller than container - fit by height
      displayedImageHeight = containerHeight;
      displayedImageWidth = containerHeight * imageAspectRatio;
      offsetX = (containerWidth - displayedImageWidth) / 2;
      offsetY = 0;
    }
    
    console.log('Container size:', containerWidth, containerHeight);
    console.log('Original image size:', originalImageWidth, originalImageHeight);
    console.log('Displayed image size:', displayedImageWidth, displayedImageHeight);
    console.log('Image offset:', offsetX, offsetY);

    return (
      <Svg
        style={StyleSheet.absoluteFillObject}
        width={containerWidth}
        height={containerHeight}
      >
        {detectedTrees.map((tree, index) => {
          // Convert relative coordinates to actual image coordinates
          const x = tree.x * displayedImageWidth + offsetX;
          const y = tree.y * displayedImageHeight + offsetY;
          const width = tree.width * displayedImageWidth;
          const height = tree.height * displayedImageHeight;
          const treeNumber = index + 1;
          
          return (
            <G key={tree.id}>
              <Rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="none"
                stroke={tree.selected ? '#22c55e' : '#ef4444'}
                strokeWidth={3}
                strokeDasharray={tree.selected ? undefined : '5,5'}
              />
              {/* Black background circle for number */}
              <Circle
                cx={x + 16}
                cy={y + 16}
                r="12"
                fill="rgba(0, 0, 0, 0.8)"
                stroke="white"
                strokeWidth="2"
              />
              {/* Number label in top-left corner */}
              <SvgText
                x={x + 16}
                y={y + 20}
                fontSize="14"
                fontWeight="bold"
                fill="white"
                textAnchor="middle"
              >
                {treeNumber}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  if (!imageUri) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Изображение не выбрано</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Обнаружение деревьев</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageContainer}>
          {imageError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Не удалось загрузить изображение</Text>
              <Text style={styles.errorSubtext}>Попробуйте сделать другое фото</Text>
            </View>
          ) : (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              onLayout={getImageLayout}
              onError={(error) => {
                console.log('Image load error:', error);
                setImageError(true);
              }}
              onLoad={(event) => {
                console.log('Image loaded successfully');
                setImageError(false);
                
                // Get actual image dimensions
                const { width, height } = event.nativeEvent.source;
                setActualImageSize({ width, height });
                console.log('Actual image dimensions:', width, height);
              }}
              resizeMode="contain"
            />
          )}
          {!loading && !imageError && renderBoundingBoxes()}
          
          {loading && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>Обнаружение деревьев...</Text>
              <Text style={styles.loadingSubtext}>
                ИИ анализирует изображение
              </Text>
            </View>
          )}
        </View>

        {!loading && (
          <>
            {/* GPS Status Block */}
            <View style={styles.gpsStatusContainer}>
              <View style={styles.gpsStatusHeader}>
                <MapPin size={20} color={
                  gpsStatus === 'available' || gpsStatus === 'exif-available' ? '#22c55e' : 
                  gpsStatus === 'unavailable' || gpsStatus === 'no-exif' ? '#ef4444' : '#6b7280'
                } />
                <Text style={[
                  styles.gpsStatusTitle,
                  (gpsStatus === 'available' || gpsStatus === 'exif-available') && styles.gpsStatusTitleSuccess,
                  (gpsStatus === 'unavailable' || gpsStatus === 'no-exif') && styles.gpsStatusTitleError
                ]}>
                  {gpsStatus === 'determining' && 'Определение геопозиции'}
                  {gpsStatus === 'unavailable' && 'Геопозиция недоступна'}
                  {gpsStatus === 'available' && 'Геопозиция сохранена'}
                  {gpsStatus === 'exif-available' && 'Сохранена геопозиция из фото'}
                  {gpsStatus === 'no-exif' && 'Фото не содержит геопозицию'}
                </Text>
              </View>
              
              {gpsStatus === 'unavailable' && (
                <View style={styles.gpsStatusContent}>
                  <Text style={styles.gpsStatusMessage}>
                    Включите геолокацию и попробуйте снова
                  </Text>
                  <TouchableOpacity
                    style={styles.gpsRetryButton}
                    onPress={retryGPSLocation}
                    disabled={gpsLoading}
                  >
                    <RefreshCw size={16} color="#ffffff" />
                    <Text style={styles.gpsRetryButtonText}>
                      {gpsLoading ? 'Попытка...' : 'Попробовать снова'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {gpsStatus === 'no-exif' && (
                <View style={styles.gpsStatusContent}>
                  <Text style={styles.gpsStatusMessage}>
                  Вы можете добавить добавить геопозицию позднее в карточке дерева или
                  </Text>
                  <TouchableOpacity
                    style={styles.gpsElegantButton}
                    onPress={useCurrentLocation}
                    disabled={gpsLoading}
                  >
                    <View style={styles.gpsElegantButtonContent}>
                      <MapPin size={18} color="#ffffff" />
                      <Text style={styles.gpsElegantButtonText}>
                        {gpsLoading ? 'Получение...' : 'Использовать текущую геолокацию'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
              
              {(gpsStatus === 'available' || gpsStatus === 'exif-available') && (
                <Text style={styles.gpsRefinementMessage}>
                  Геопозиция может быть уточнена позднее в карточке дерева
                </Text>
              )}
            </View>

            <View style={styles.detectionInfo}>
              <Text style={styles.detectionTitle}>
                Деревьев обнаружено: {detectedTrees.length}
              </Text>
              <Text style={styles.detectionSubtitle}>
                Нажмите на деревья, чтобы выбрать/отменить выбор для сохранения
              </Text>
            </View>

            <View style={styles.treesList}>
              {detectedTrees.map((tree, index) => (
                <TouchableOpacity
                  key={tree.id}
                  style={[
                    styles.treeItem,
                    tree.selected ? styles.treeItemSelected : styles.treeItemUnselected,
                  ]}
                  onPress={() => toggleTreeSelection(tree.id)}
                >
                  <View style={styles.treeItemContent}>
                    <Text style={[
                      styles.treeItemTitle,
                      tree.selected ? styles.selectedText : styles.unselectedText,
                    ]}>
                      Дерево {index + 1}
                    </Text>
                  </View>
                  <View style={[
                    styles.selectionIcon,
                    tree.selected ? styles.selectedIcon : styles.unselectedIcon,
                  ]}>
                    {tree.selected ? (
                      <Check size={20} color="#ffffff" />
                    ) : (
                      <X size={20} color="#9ca3af" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (saving || detectedTrees.filter(t => t.selected).length === 0) && styles.saveButtonDisabled,
              ]}
              onPress={saveSelectedTrees}
              disabled={saving || detectedTrees.filter(t => t.selected).length === 0}
            >
              <Save size={24} color="#ffffff" />
              <Text style={styles.saveButtonText}>
                {saving
                  ? 'Сохранение...'
                  : 'Сохранить'
                }
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    padding: 16,
  },
  imageContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: imageDisplayWidth,
    height: imageDisplayWidth * 0.75,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  detectionInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  detectionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  treesList: {
    marginBottom: 24,
  },
  treeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  treeItemSelected: {
    backgroundColor: '#f0f9ff',
    borderColor: '#22c55e',
  },
  treeItemUnselected: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  treeItemContent: {
    flex: 1,
  },
  treeItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedText: {
    color: '#111827',
  },
  unselectedText: {
    color: '#6b7280',
  },
  selectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIcon: {
    backgroundColor: '#22c55e',
  },
  unselectedIcon: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  gpsStatusContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gpsStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  gpsStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginLeft: 6,
  },
  gpsStatusTitleSuccess: {
    color: '#22c55e',
  },
  gpsStatusTitleError: {
    color: '#ef4444',
  },
  gpsStatusContent: {
    marginTop: 6,
  },
  gpsStatusMessage: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
    lineHeight: 18,
  },
  gpsRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  gpsRetryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  gpsElegantButton: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  gpsElegantButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6b7280',
    borderRadius: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  gpsElegantButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
    letterSpacing: 0.05,
  },
  gpsCoordinates: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  gpsRefinementMessage: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 3,
    lineHeight: 14,
  },
});