import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { treeDatabase, TreeRecord } from '@/database/treeDatabase';
import { ArrowLeft, Save, Trash2, Camera, Image as ImageIcon, Wand as Wand2, Calendar } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import Svg, { Rect } from 'react-native-svg';
import { classifyTreeImage, formatClassificationResult, extractTaxonName } from '@/utils/treeClassifier';

const { width: screenWidth } = Dimensions.get('window');
const imageDisplayWidth = screenWidth - 32;

export default function TreeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tree, setTree] = useState<TreeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const router = useRouter();

  useEffect(() => {
    if (id) {
      loadTreeData();
    }
  }, [id]);

  const loadTreeData = async () => {
    try {
      setLoading(true);
      
      // Ensure database is initialized
      await treeDatabase.init();
      
      const treeData = await treeDatabase.getTreeById(parseInt(id!));
      if (treeData) {
        setTree(treeData);
        setDescription(treeData.description);
      } else {
        console.log('Tree not found for id:', id);
        Alert.alert('Error', 'Tree not found. It may have been deleted.');
        router.back();
      }
    } catch (error) {
      console.error('Load tree error:', error);
      Alert.alert('Error', 'Failed to load tree data. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const saveChanges = async () => {
    if (!tree) return;

    try {
      setSaving(true);
      await treeDatabase.updateTree(tree.id!, { description });
      Alert.alert('Success', 'Changes saved successfully');
      setTree({ ...tree, description });
    } catch (error) {
      Alert.alert('Error', 'Failed to save changes');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  const deleteTree = async () => {
    if (!tree) return;

    Alert.alert(
      'Delete Tree',
      'Are you sure you want to delete this tree record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await treeDatabase.deleteTree(tree.id!);
              router.push('/');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete tree');
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
      'Add Photo',
      'How would you like to add a photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Camera',
          onPress: () => takePhoto(),
        },
        {
          text: 'Gallery',
          onPress: () => selectFromGallery(),
        },
      ]
    );
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
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
      Alert.alert('Error', 'Failed to take photo');
      console.error('Camera error:', error);
    }
  };

  const selectFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Gallery access permission is required.');
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
      Alert.alert('Error', 'Failed to select image');
      console.error('Gallery error:', error);
    }
  };

  const deleteImage = async (imageUri: string) => {
    if (!tree) return;

    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const newImages = tree.additionalImages.filter(uri => uri !== imageUri);
              await treeDatabase.updateTree(tree.id!, { additionalImages: newImages });
              setTree({ ...tree, additionalImages: newImages });
            } catch (error) {
              Alert.alert('Error', 'Failed to delete image');
              console.error('Delete image error:', error);
            }
          },
        },
      ]
    );
  };

  const generateDescription = async () => {
    if (!tree || !tree.cropPath) {
      Alert.alert('Error', 'No tree crop image available for classification.');
      return;
    }

    try {
      setGeneratingDescription(true);
      console.log('Starting description generation for tree:', tree.id);
      console.log('Using crop path:', tree.cropPath);

      // Classify the tree crop image
      const classificationResult = await classifyTreeImage(tree.cropPath);
      
      // Extract taxon name and format the result as description text
      const taxonName = extractTaxonName(classificationResult);
      const descriptionText = formatClassificationResult(classificationResult);
      
      // Update the description in the UI
      setDescription(descriptionText);
      
      // Update the tree record in the database with both description and taxon name
      await treeDatabase.updateTree(tree.id!, { 
        description: descriptionText,
        taxonName: taxonName || undefined
      });
      
      // Update the local tree state
      setTree({ ...tree, description: descriptionText, taxonName: taxonName || undefined });
      
      console.log('Description generated and saved successfully');
      Alert.alert('Success', 'Tree description generated successfully!');
      
    } catch (error) {
      console.error('Error generating description:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        'Error', 
        `Failed to generate description: ${errorMessage}\n\nPlease check your internet connection and try again.`
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
    if (!tree || !imageSize.width || !imageSize.height) return null;

    return (
      <Svg
        style={StyleSheet.absoluteFillObject}
        width={imageSize.width}
        height={imageSize.height}
      >
        <Rect
          x={tree.boundingBox.x * imageSize.width}
          y={tree.boundingBox.y * imageSize.height}
          width={tree.boundingBox.width * imageSize.width}
          height={tree.boundingBox.height * imageSize.height}
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
          <Text style={styles.loadingText}>Loading tree details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tree) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Tree not found</Text>
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
        <Text style={styles.title}>Tree Details</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={deleteTree}
        >
          <Trash2 size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: tree.imageUri }}
            style={styles.image}
            onLayout={getImageLayout}
            onError={(error) => {
              console.log('Image load error in tree detail:', error);
            }}
            onLoad={() => {
              console.log('Image loaded successfully in tree detail');
            }}
            resizeMode="contain"
          />
          {renderBoundingBox()}
        </View>

        <View style={styles.metadataContainer}>
          <View style={styles.metadataItem}>
            <Calendar size={20} color="#6b7280" />
            <Text style={styles.metadataText}>
              {new Date(tree.dateTaken).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.taxonNameItem}>
            <Text style={styles.taxonNameText}>
              Taxon name: {tree.taxonName || 'unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a description for this tree..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.generateButton,
              generatingDescription && styles.generateButtonDisabled
            ]}
            onPress={generateDescription}
            disabled={generatingDescription}
          >
            <Wand2 size={20} color={generatingDescription ? "#9ca3af" : "#6b7280"} />
            <Text style={[
              styles.generateButtonText,
              generatingDescription && styles.generateButtonTextDisabled
            ]}>
              {generatingDescription ? 'Generating...' : 'Generate Description'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photosContainer}>
          <View style={styles.photosHeader}>
            <Text style={styles.sectionTitle}>Additional Photos</Text>
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={addPhoto}
            >
              <Camera size={20} color="#ffffff" />
              <Text style={styles.addPhotoText}>Add Photo</Text>
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
              <Text style={styles.emptyPhotosText}>No additional photos yet</Text>
              <Text style={styles.emptyPhotosSubtext}>
                Add detailed photos of this tree using the button above
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={saveChanges}
          disabled={saving}
        >
          <Save size={24} color="#ffffff" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
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
  metadataContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taxonNameItem: {
    marginTop: 8,
    marginLeft: 32, // Align with the date text (icon width + marginLeft)
  },
  taxonNameText: {
    fontSize: 16,
    color: '#374151',
  },
  metadataText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  descriptionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#374151',
    minHeight: 100,
    marginBottom: 12,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#f9fafb',
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  generateButtonTextDisabled: {
    color: '#9ca3af',
  },
  photosContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    padding: 40,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
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
});