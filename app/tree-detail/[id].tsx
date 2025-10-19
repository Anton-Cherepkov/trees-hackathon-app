import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  TextInput,
  Alert,
  ScrollView,
  FlatList,
  Dimensions,
  Modal,
  Clipboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { treeDatabase, TreeRecord } from '@/database/treeDatabase';
import { ArrowLeft, Save, Trash2, Camera, Image as ImageIcon, Wand as Wand2, Calendar, Copy, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { classifyTreeImage, formatClassificationResult, extractTaxonName } from '@/utils/treeClassifier';
import { processDefectsForTree } from '@/utils/defectDetection';
import { DefectRecord } from '@/database/treeDatabase';
import Svg, { Rect } from 'react-native-svg';
import { Yamap, Marker } from 'react-native-yamap-plus';
import { getTreesForMap, calculateTreeDetailMapRegion, TreeWithMarkerInfo, getMapStyle, getMarkerIconWithSelection, calculateDistanceMeters } from '@/utils/mapUtils';
import { cropTreeWithDimensions } from '@/utils/treeCropper';

const { width: screenWidth } = Dimensions.get('window');
const imageDisplayWidth = screenWidth - 32;

export default function TreeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tree, setTree] = useState<TreeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [actualImageSize, setActualImageSize] = useState({ width: 0, height: 0 });
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [defects, setDefects] = useState<DefectRecord[]>([]);
  const [defectZoomModalVisible, setDefectZoomModalVisible] = useState(false);
  const [selectedDefectImage, setSelectedDefectImage] = useState<string | null>(null);
  const [mapTrees, setMapTrees] = useState<TreeWithMarkerInfo[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyIndex, setNearbyIndex] = useState(0);
  const [nearbyTrees, setNearbyTrees] = useState<{
    tree: TreeRecord;
    distance: number;
    cropUri: string;
  }[]>([]);
  const nearbyListRef = useRef<FlatList<any> | null>(null);
  const [carouselWidth, setCarouselWidth] = useState(imageDisplayWidth);
  const router = useRouter();

  type NearbyItem = { tree: TreeRecord; distance: number; cropUri: string };

  const navigateToTree = useCallback((treeId: number) => {
    router.push(`/tree-detail/${treeId}`);
  }, [router]);

  const NearbyCard = memo(function NearbyCard({
    id,
    distance,
    imageUri,
    onPress,
    width,
  }: { id: number; distance: number; imageUri: string; onPress: (id: number) => void; width: number }) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(id)}
        style={[styles.nearbyCard, { width }]}
      >
        <Image source={{ uri: imageUri }} style={styles.nearbyImage} resizeMode="contain" />
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>{distance} м</Text>
        </View>
      </TouchableOpacity>
    );
  });

  const renderNearbyItem = useCallback(({ item }: { item: NearbyItem }) => (
    <NearbyCard
      id={item.tree.id!}
      distance={Math.round(item.distance)}
      imageUri={item.cropUri}
      onPress={navigateToTree}
      width={carouselWidth}
    />
  ), [navigateToTree, carouselWidth]);

  useEffect(() => {
    if (id) {
      loadTreeData();
    }
  }, [id]);

  // Refresh tree data when screen comes back into focus (e.g., after editing location)
  useFocusEffect(
    React.useCallback(() => {
      if (id) {
        loadTreeData();
      }
    }, [id])
  );

  const loadTreeData = async () => {
    try {
      setLoading(true);
      
      // Ensure database is initialized
      await treeDatabase.init();
      
      const treeData = await treeDatabase.getTreeById(parseInt(id!));
      if (treeData) {
        setTree(treeData);
        setDescription(treeData.description);
        
        // Load defects for this tree
        const treeDefects = await treeDatabase.getDefectsByTreeId(parseInt(id!));
        setDefects(treeDefects);
        
        // Load all trees for map display
        await loadMapTrees();
        // Load nearby trees if location is available
        await loadNearbyTrees(treeData);
      } else {
        console.log('Tree not found for id:', id);
        Alert.alert('Ошибка', 'Дерево не найдено. Возможно, оно было удалено.');
        router.back();
      }
    } catch (error) {
      console.error('Load tree error:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить данные о дереве. Попробуйте снова.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadMapTrees = async () => {
    try {
      setMapLoading(true);
      const trees = await getTreesForMap(null);
      setMapTrees(trees);
    } catch (error) {
      console.error('Error loading trees for map:', error);
    } finally {
      setMapLoading(false);
    }
  };

  const ensureCropForTree = async (t: TreeRecord): Promise<string> => {
    if (t.cropPath && t.cropPath.length > 0) {
      return t.cropPath;
    }
    try {
      const cropPath = await cropTreeWithDimensions(t.imageUri, t.boundingBox, String(t.id!));
      await treeDatabase.updateTree(t.id!, { cropPath });
      return cropPath;
    } catch (e) {
      console.log('Failed to crop tree, falling back to imageUri:', t.id, e);
      return t.imageUri;
    }
  };

  const loadNearbyTrees = async (baseTree: TreeRecord | null) => {
    try {
      if (!baseTree || !baseTree.latitude || !baseTree.longitude) {
        setNearbyTrees([]);
        return;
      }
      setNearbyLoading(true);
      const all = await treeDatabase.getAllTrees();
      const candidates = all.filter(t => t.id !== baseTree.id && t.latitude != null && t.longitude != null);
      // Compute distance and filter <= 500m
      const withDistance = candidates.map(t => ({
        tree: t,
        distance: calculateDistanceMeters(baseTree.latitude!, baseTree.longitude!, t.latitude!, t.longitude!),
      })).filter(x => x.distance <= 500);
      withDistance.sort((a, b) => a.distance - b.distance);

      const result: { tree: TreeRecord; distance: number; cropUri: string }[] = [];
      for (const item of withDistance) {
        const cropUri = await ensureCropForTree(item.tree);
        result.push({ ...item, cropUri });
      }
      setNearbyTrees(result);
      setNearbyIndex(0);
    } catch (err) {
      console.error('Error loading nearby trees:', err);
      setNearbyTrees([]);
    } finally {
      setNearbyLoading(false);
    }
  };

  const goToNearbyIndex = (index: number) => {
    if (!nearbyListRef.current) return;
    const clamped = Math.max(0, Math.min(index, nearbyTrees.length - 1));
    nearbyListRef.current.scrollToIndex({ index: clamped, animated: true });
    setNearbyIndex(clamped);
  };

  const onViewRef = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const idx = viewableItems[0].index ?? 0;
      if (idx !== nearbyIndex) setNearbyIndex(idx);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });


  const copyCoordinates = () => {
    if (!tree || !tree.latitude || !tree.longitude) return;
    
    const coordinates = `${tree.latitude.toFixed(6)}, ${tree.longitude.toFixed(6)}`;
    Clipboard.setString(coordinates);
    Alert.alert('Скопировано', 'Координаты скопированы в буфер обмена');
  };

  const deleteTree = async () => {
    if (!tree) return;

    Alert.alert(
      'Удалить дерево',
      'Вы уверены, что хотите удалить эту запись о дереве? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await treeDatabase.deleteTree(tree.id!);
              router.push('/');
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить дерево');
              console.error('Delete error:', error);
            }
          },
        },
      ]
    );
  };

  const addPhoto = async () => {
    if (!tree) return;

    Alert.alert(
      'Добавить фото',
      'Как вы хотите добавить фото?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Камера',
          onPress: () => takePhoto(),
        },
        {
          text: 'Галерея',
          onPress: () => selectFromGallery(),
        },
      ]
    );
  };

  const takePhoto = async () => {
    try {
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

      if (!result.canceled && result.assets[0] && tree) {
        try {
          // Copy image to document directory for persistence
          const fileName = `additional_${Date.now()}.jpg`;
          const destinationUri = `${FileSystem.documentDirectory}${fileName}`;
          
          await FileSystem.copyAsync({
            from: result.assets[0].uri,
            to: destinationUri,
          });
          
          const newImages = [...tree.additionalImages, destinationUri];
          await treeDatabase.updateTree(tree.id!, { additionalImages: newImages });
          setTree({ ...tree, additionalImages: newImages });
        } catch (copyError) {
          console.log('Failed to copy additional image:', copyError);
          // Fallback to original URI
          const newImages = [...tree.additionalImages, result.assets[0].uri];
          await treeDatabase.updateTree(tree.id!, { additionalImages: newImages });
          setTree({ ...tree, additionalImages: newImages });
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сделать снимок');
      console.error('Camera error:', error);
    }
  };

  const selectFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Требуется разрешение', 'Требуется разрешение на доступ к галерее.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && tree) {
        try {
          // Copy image to document directory for persistence
          const fileName = `additional_${Date.now()}.jpg`;
          const destinationUri = `${FileSystem.documentDirectory}${fileName}`;
          
          await FileSystem.copyAsync({
            from: result.assets[0].uri,
            to: destinationUri,
          });
          
          const newImages = [...tree.additionalImages, destinationUri];
          await treeDatabase.updateTree(tree.id!, { additionalImages: newImages });
          setTree({ ...tree, additionalImages: newImages });
        } catch (copyError) {
          console.log('Failed to copy additional image from gallery:', copyError);
          // Fallback to original URI
          const newImages = [...tree.additionalImages, result.assets[0].uri];
          await treeDatabase.updateTree(tree.id!, { additionalImages: newImages });
          setTree({ ...tree, additionalImages: newImages });
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
      console.error('Gallery error:', error);
    }
  };

  const deleteImage = async (imageUri: string) => {
    if (!tree) return;

    Alert.alert(
      'Удалить изображение',
      'Вы уверены, что хотите удалить это изображение?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              const newImages = tree.additionalImages.filter(uri => uri !== imageUri);
              await treeDatabase.updateTree(tree.id!, { additionalImages: newImages });
              setTree({ ...tree, additionalImages: newImages });
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить изображение');
              console.error('Delete image error:', error);
            }
          },
        },
      ]
    );
  };

  const deleteDefect = async (defectId: number) => {
    console.log('Attempting to delete defect with ID:', defectId);
    console.log('Current defects:', defects.map(d => ({ id: d.defect_id, type: d.defect_type })));
    
    Alert.alert(
      'Удалить дефект',
      'Вы уверены, что хотите удалить этот дефект? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await treeDatabase.deleteDefect(defectId);
              // Update local defects state
              const updatedDefects = defects.filter(defect => defect.defect_id !== defectId);
              console.log('Defects after deletion:', updatedDefects.map(d => ({ id: d.defect_id, type: d.defect_type })));
              setDefects(updatedDefects);
              console.log('Defect deleted successfully');
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить дефект');
              console.error('Delete defect error:', error);
            }
          },
        },
      ]
    );
  };

  const deleteLocation = async () => {
    if (!tree) return;

    Alert.alert(
      'Удалить местоположение',
      'Вы уверены, что хотите удалить GPS координаты для этого дерева? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await treeDatabase.updateTree(tree.id!, {
                latitude: null,
                longitude: null,
              });
              
              // Force complete refresh of tree data
              await loadTreeData();
              
              Alert.alert('Успешно', 'Местоположение дерева удалено');
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить местоположение');
              console.error('Delete location error:', error);
            }
          },
        },
      ]
    );
  };

  const generateDescription = async () => {
    if (!tree || !tree.cropPath) {
      Alert.alert('Ошибка', 'Нет изображения обрезки дерева для классификации.');
      return;
    }

    try {
      setGeneratingDescription(true);
      console.log('Starting description generation for tree:', tree.id);
      console.log('Using crop path:', tree.cropPath);

      // Classify the tree crop image
      const classificationResult = await classifyTreeImage(tree.cropPath);
      
      // Extract taxon name only
      const taxonName = extractTaxonName(classificationResult);
      
      // Delete all existing defects for this tree before processing new ones
      console.log('Deleting existing defects for tree:', tree.id);
      await treeDatabase.deleteDefectsByTreeId(tree.id!);
      
      // Clear defects from local state
      setDefects([]);
      
      // Process defects for this tree
      console.log('Starting defect detection for tree:', tree.id);
      const defectRecords = await processDefectsForTree(
        tree.id!,
        tree.cropPath,
        tree.additionalImages
      );
      
      // Save defects to database and collect the inserted records with IDs
      const insertedDefects: DefectRecord[] = [];
      for (const defectRecord of defectRecords) {
        const defectId = await treeDatabase.insertDefect(defectRecord);
        insertedDefects.push({
          ...defectRecord,
          defect_id: defectId
        });
      }
      
      // Generate description based on detected defects
      let generatedDescription = "";
      if (defectRecords.length === 0) {
        generatedDescription = "Дерево без повреждений";
      } else {
        // Group defects by type and count them
        const defectCounts = defectRecords.reduce((acc, defect) => {
          const type = defect.defect_type;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // Create description text
        const defectDescriptions = Object.entries(defectCounts).map(([type, count]) => {
          return `${type}: ${count} шт.`;
        });
        
        generatedDescription = `Имеются следующие дефекты: ${defectDescriptions.join(', ')}`;
      }
      
      // Update the description in the UI
      setDescription(generatedDescription);
      
      // Update the tree record in the database with taxon name and generated description
      await treeDatabase.updateTree(tree.id!, { 
        description: generatedDescription,
        taxonName: taxonName || undefined
      });
      
      // Update the local tree state
      setTree({ ...tree, description: generatedDescription, taxonName: taxonName || undefined });
      
      // Update defects state with the inserted records that have IDs
      setDefects(insertedDefects);
      
      // Reload map trees to update marker colors after AI analysis
      await loadMapTrees();
      
      console.log('Description and defects generated and saved successfully');
      Alert.alert('Успешно', `Анализ дерева завершён! Найдено ${defectRecords.length} дефектов. Описание сгенерировано автоматически.`);
      
    } catch (error) {
      console.error('Error generating description:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Ошибка', 
        `Не удалось сгенерировать описание: ${errorMessage}\n\nПроверьте подключение к интернету и попробуйте снова.`
      );
    } finally {
      setGeneratingDescription(false);
    }
  };

  const getImageLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setImageSize({ width, height });
  };

  const renderBoundingBox = () => {
    if (!tree || !imageSize.width || !imageSize.height || !actualImageSize.width || !actualImageSize.height) return null;

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

    // Convert relative coordinates to actual image coordinates
    const x = tree.boundingBox.x * displayedImageWidth + offsetX;
    const y = tree.boundingBox.y * displayedImageHeight + offsetY;
    const width = tree.boundingBox.width * displayedImageWidth;
    const height = tree.boundingBox.height * displayedImageHeight;

    return (
      <Svg
        style={StyleSheet.absoluteFillObject}
        width={containerWidth}
        height={containerHeight}
      >
        <Rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke="#22c55e"
          strokeWidth={3}
        />
      </Svg>
    );
  };

  const renderAdditionalImage = ({ item, index }: { item: string; index: number }) => (
    <View style={styles.additionalImageContainer}>
      <Image source={{ uri: item }} style={styles.additionalImage} />
      <TouchableOpacity
        style={styles.deleteImageButton}
        onPress={() => deleteImage(item)}
      >
        <Trash2 size={16} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Загрузка деталей дерева...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tree) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Дерево не найдено</Text>
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Детали дерева</Text>
          <Text style={styles.headerDate}>
            {new Date(tree.dateTaken).toLocaleDateString('ru-RU', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={deleteTree}
        >
          <Trash2 size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageContainer}>
          <TouchableOpacity
            onPress={() => setZoomModalVisible(true)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: tree.imageUri }}
              style={styles.image}
              onLayout={getImageLayout}
              onError={(error) => {
                console.log('Image load error in tree detail:', error);
              }}
              onLoad={(event) => {
                console.log('Image loaded successfully in tree detail');
                const { width, height } = event.nativeEvent.source;
                setActualImageSize({ width, height });
              }}
              resizeMode="contain"
            />
            {renderBoundingBox()}
          </TouchableOpacity>
        </View>


        <View style={styles.photosContainer}>
          <View style={styles.photosHeader}>
            <Text style={styles.sectionTitle}>Дополнительные фото</Text>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={addPhoto}
            >
              <Camera size={20} color="#ffffff" />
              <Text style={styles.addPhotoText}>Добавить фото</Text>
            </TouchableOpacity>
          </View>

          {tree.additionalImages.length > 0 ? (
            <FlatList
              data={tree.additionalImages}
              renderItem={renderAdditionalImage}
              keyExtractor={(item, index) => index.toString()}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.additionalImagesGrid}
            />
          ) : (
            <View style={styles.emptyPhotos}>
              <ImageIcon size={48} color="#9ca3af" />
              <Text style={styles.emptyPhotosText}>Пока нет дополнительных фото</Text>
              <Text style={styles.emptyPhotosSubtext}>
                Добавьте детальные фото этого дерева, используя кнопку выше
              </Text>
            </View>
          )}
        </View>

        <View style={styles.descriptionContainer}>
          <View style={styles.descriptionHeader}>
            <Text style={styles.sectionTitle}>ИИ Анализ</Text>
            <TouchableOpacity
              style={[
                styles.processAIButton,
                generatingDescription && styles.processAIButtonDisabled
              ]}
              onPress={generateDescription}
              disabled={generatingDescription}
            >
              <Wand2 size={20} color="#ffffff" />
              <Text style={styles.processAIButtonText}>
                {generatingDescription ? 'Обработка...' : 'Обработать ИИ'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.analysisTable}>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Название таксона:</Text>
              <View style={styles.analysisValue}>
                {tree.taxonName ? (
                  <Text style={styles.analysisValueText}>{tree.taxonName}</Text>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <Text style={styles.placeholderText}>Запустить ИИ</Text>
                    <Text style={styles.placeholderIcon}>✨</Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Текстовое описание:</Text>
              <View style={styles.analysisValue}>
                {tree.description ? (
                  <Text style={styles.analysisValueText}>{tree.description}</Text>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <Text style={styles.placeholderText}>Запустить ИИ</Text>
                    <Text style={styles.placeholderIcon}>✨</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Defects Section */}
        <View style={styles.defectsContainer}>
          <Text style={styles.sectionTitle}>Дефекты</Text>
          
          {defects.length > 0 ? (
            <View style={styles.defectsContent}>
              {Object.entries(
                defects.reduce((acc, defect) => {
                  if (!acc[defect.defect_type]) {
                    acc[defect.defect_type] = [];
                  }
                  acc[defect.defect_type].push(defect);
                  return acc;
                }, {} as Record<string, DefectRecord[]>)
              ).map(([defectType, typeDefects]) => (
                <View key={defectType} style={styles.defectTypeContainer}>
                  <Text style={styles.defectTypeTitle}>{defectType}</Text>
                  <View style={styles.defectCropsContainer}>
                    {typeDefects.map((defect, index) => (
                      <View key={defect.defect_id || index} style={styles.defectCropWrapper}>
                        <TouchableOpacity
                          style={styles.defectCropContainer}
                          onPress={() => {
                            setSelectedDefectImage(defect.crop_path);
                            setDefectZoomModalVisible(true);
                          }}
                        >
                          <Image
                            source={{ uri: defect.crop_path }}
                            style={styles.defectCropImage}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteDefectButton}
                          onPress={() => deleteDefect(defect.defect_id!)}
                        >
                          <Trash2 size={16} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyDefects}>
              <Text style={styles.emptyDefectsText}>Дефекты пока не обнаружены</Text>
              <Text style={styles.emptyDefectsSubtext}>
                Запустите ИИ анализ для обнаружения потенциальных проблем
              </Text>
            </View>
          )}
        </View>

        {/* Location Map Section */}
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.sectionTitle}>Местоположение</Text>
            <TouchableOpacity
              style={styles.editLocationButton}
              onPress={() => router.push(`/edit-location/${tree.id}`)}
            >
              <Text style={styles.editLocationButtonText}>
                {tree.latitude && tree.longitude ? 'Изменить' : 'Добавить'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {tree.latitude && tree.longitude ? (
            <>
              {/* GPS Coordinates Display */}
              <View style={styles.coordinatesContainer}>
                <View style={styles.coordinatesHeader}>
                  <Text style={styles.coordinatesTitle}>GPS координаты</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={copyCoordinates}
                  >
                    <Copy size={16} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
                <View style={styles.coordinateRow}>
                  <Text style={styles.coordinateLabel}>Широта:</Text>
                  <Text style={styles.coordinateValue}>{tree.latitude.toFixed(6)}°</Text>
                </View>
                <View style={styles.coordinateRow}>
                  <Text style={styles.coordinateLabel}>Долгота:</Text>
                  <Text style={styles.coordinateValue}>{tree.longitude.toFixed(6)}°</Text>
                </View>
              </View>
              
              <View style={styles.mapWrapper}>
                {mapLoading ? (
                  <View style={styles.mapLoadingContainer}>
                    <Text style={styles.mapLoadingText}>Загрузка карты...</Text>
                  </View>
                ) : (
                  <Yamap
                    style={styles.map}
                    initialRegion={calculateTreeDetailMapRegion(tree)}
                    logoPosition={{ horizontal: 'left', vertical: 'bottom' }}
                    logoPadding={{ horizontal: 16, vertical: 16 }}
                    mapStyle={getMapStyle()}
                    onMapLoaded={() => {
                      // Map loaded successfully
                    }}
                  >
                    {mapTrees.map((mapTree) => {
                      const isCurrentTree = mapTree.id === tree.id;
                      // Get the appropriate marker icon with selection state
                      const markerIcon = getMarkerIconWithSelection(mapTree, mapTree.hasDefects, isCurrentTree);
                      
                      return (
                        <Marker
                          key={mapTree.id}
                          point={{
                            lat: mapTree.latitude!,
                            lon: mapTree.longitude!,
                          }}
                          source={markerIcon}
                          scale={isCurrentTree ? 1.0 : 0.7}
                          // No onPress handler - trees are not clickable on tree detail page
                        />
                      );
                    })}
                  </Yamap>
                )}
              </View>
              
              {/* Delete Location Button */}
              <TouchableOpacity
                style={styles.deleteLocationButton}
                onPress={deleteLocation}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteLocationButtonText}>
                  Удалить местоположение
                </Text>
              </TouchableOpacity>

            </>
          ) : (
            <View style={styles.noLocationContainer}>
              <Text style={styles.noLocationText}>Информация о местоположении недоступна</Text>
              <Text style={styles.noLocationSubtext}>
                GPS координаты не были сохранены для этого дерева
              </Text>
            </View>
          )}
        </View>

        {/* Nearby Trees - Separate Block after Location */}
        {tree.latitude && tree.longitude && (
          <View style={styles.nearbyContainer}>
            <View style={styles.nearbyHeader}>
              <Text style={styles.sectionTitle}>Деревья рядом</Text>
            </View>
            {nearbyLoading ? (
              <View style={styles.nearbyLoading}>
                <Text style={styles.mapLoadingText}>Загрузка ближайших деревьев...</Text>
              </View>
            ) : nearbyTrees.length === 0 ? (
              <View style={styles.nearbyEmpty}>
                <Text style={styles.emptyDefectsText}>В радиусе 500 метров нет деревьев.</Text>
              </View>
            ) : (
              <View style={styles.carouselWrapper} onLayout={(e) => setCarouselWidth(e.nativeEvent.layout.width)}>
                <TouchableOpacity
                  style={[styles.navButton, { left: 4, opacity: nearbyIndex === 0 ? 0.3 : 1 }]}
                  onPress={() => goToNearbyIndex(nearbyIndex - 1)}
                  disabled={nearbyIndex === 0}
                >
                  <ChevronLeft size={22} color="#111827" />
                </TouchableOpacity>

                <FlatList
                  style={styles.nearbyList}
                  ref={nearbyListRef}
                  data={nearbyTrees}
                  keyExtractor={(item) => String(item.tree.id)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  initialNumToRender={3}
                  windowSize={5}
                  maxToRenderPerBatch={3}
                  removeClippedSubviews
                  renderItem={renderNearbyItem}
                  snapToInterval={carouselWidth}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  onViewableItemsChanged={onViewRef.current}
                  viewabilityConfig={viewConfigRef.current}
                  getItemLayout={(_, index) => ({ length: carouselWidth || 1, offset: (carouselWidth || 1) * index, index })}
                />

                <TouchableOpacity
                  style={[styles.navButton, { right: 4, opacity: nearbyIndex >= nearbyTrees.length - 1 ? 0.3 : 1 }]}
                  onPress={() => goToNearbyIndex(nearbyIndex + 1)}
                  disabled={nearbyIndex >= nearbyTrees.length - 1}
                >
                  <ChevronRight size={22} color="#111827" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Zoom Modal */}
      <Modal
        visible={zoomModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setZoomModalVisible(false)}
      >
        <View style={styles.zoomModalContainer}>
          <TouchableOpacity
            style={styles.zoomModalBackground}
            activeOpacity={1}
            onPress={() => setZoomModalVisible(false)}
          >
            <View style={styles.zoomModalContent}>
              <TouchableOpacity
                style={styles.zoomCloseButton}
                onPress={() => setZoomModalVisible(false)}
              >
                <Text style={styles.zoomCloseButtonText}>✕</Text>
              </TouchableOpacity>
              <ScrollView
                style={styles.zoomScrollView}
                contentContainerStyle={styles.zoomScrollContent}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Image
                  source={{ uri: tree?.imageUri }}
                  style={styles.zoomImage}
                  resizeMode="contain"
                />
              </ScrollView>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Defect Zoom Modal */}
      <Modal
        visible={defectZoomModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDefectZoomModalVisible(false)}
      >
        <View style={styles.zoomModalContainer}>
          <TouchableOpacity
            style={styles.zoomModalBackground}
            activeOpacity={1}
            onPress={() => setDefectZoomModalVisible(false)}
          >
            <View style={styles.zoomModalContent}>
              <TouchableOpacity
                style={styles.zoomCloseButton}
                onPress={() => setDefectZoomModalVisible(false)}
              >
                <Text style={styles.zoomCloseButtonText}>✕</Text>
              </TouchableOpacity>
              <ScrollView
                style={styles.zoomScrollView}
                contentContainerStyle={styles.zoomScrollContent}
                maximumZoomScale={3}
                minimumZoomScale={1}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {selectedDefectImage && (
                  <Image
                    source={{ uri: selectedDefectImage }}
                    style={styles.zoomImage}
                    resizeMode="contain"
                  />
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
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
  zoomModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomModalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomScrollView: {
    flex: 1,
    width: '100%',
  },
  zoomScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: screenWidth,
    height: screenWidth * 0.75,
  },
  descriptionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  processAIButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  processAIButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  processAIButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  analysisTable: {
    gap: 12,
  },
  analysisRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  analysisLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    width: 140,
    flexShrink: 0,
  },
  analysisValue: {
    flex: 1,
    marginLeft: 12,
  },
  analysisValueText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 22,
  },
  placeholderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  placeholderIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    flex: 1,
    marginRight: 12,
  },
  photosContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editLocationButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  editLocationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  coordinatesContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  coordinatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  coordinatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  copyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    minWidth: 32,
    minHeight: 32,
  },
  coordinateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  coordinateLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  coordinateValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  mapWrapper: {
    height: 300,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
  },
  map: {
    flex: 1,
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  mapLoadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  addPhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  additionalImagesGrid: {
    gap: 8,
  },
  additionalImageContainer: {
    position: 'relative',
    flex: 1,
    margin: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
  additionalImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'contain',
  },
  deleteImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPhotos: {
    alignItems: 'center',
    padding: 20,
  },
  emptyPhotosText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyPhotosSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 40,
  },
  defectsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  defectsContent: {
    gap: 16,
  },
  defectTypeContainer: {
    gap: 8,
  },
  defectTypeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
    flexWrap: 'wrap',
  },
  defectCropsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  defectCropWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  defectCropContainer: {
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  defectCropImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  deleteDefectButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyDefects: {
    alignItems: 'center',
    padding: 20,
  },
  emptyDefectsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  emptyDefectsSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  noLocationContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noLocationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  noLocationSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteLocationButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.7)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginTop: 16,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteLocationButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  nearbyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  nearbyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nearbyLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  nearbyEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  carouselWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButton: {
    position: 'absolute',
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
    top: '45%',
  },
  nearbyCard: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  nearbyImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
  },
  nearbyList: {
    width: '100%',
  },
  distanceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distanceText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});