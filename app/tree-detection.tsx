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
import { Check, X, Save, ArrowLeft } from 'lucide-react-native';
import Svg, { Rect, Text as SvgText, G, Circle } from 'react-native-svg';
import { preprocessImage } from '@/utils/preprocessImage';
import { yoloModel } from '@/app/(tabs)/index';
import * as ort from 'onnxruntime-react-native';

const { width: screenWidth } = Dimensions.get('window');
const imageDisplayWidth = screenWidth - 32;

interface DetectedTree extends BoundingBox {
  id: string;
  selected: boolean;
}

/**
 * Run YOLO model inference on preprocessed image data
 * @param inputData - Preprocessed image data as Float32Array
 * @returns Array of detected trees with confidence > 0.5
 */
async function runYOLOInference(inputData: Float32Array): Promise<DetectedTree[]> {
  try {
    if (!yoloModel) {
      throw new Error('YOLO model not loaded');
    }

    console.log('Starting YOLO inference...');
    console.log('Input data length:', inputData.length);
    console.log('Model input names:', yoloModel.inputNames);
    console.log('Model output names:', yoloModel.outputNames);

    // Create input tensor with shape [1, 3, 640, 640]
    const inputTensor = new ort.Tensor('float32', inputData, [1, 3, 640, 640]);
    
    // Prepare feeds object
    const feeds: Record<string, ort.Tensor> = {};
    feeds[yoloModel.inputNames[0]] = inputTensor;
    
    // Run inference
    const fetches = await yoloModel.run(feeds);
    
    // Get output tensor
    const output = fetches[yoloModel.outputNames[0]];
    if (!output) {
      throw new Error(`Failed to get output: ${yoloModel.outputNames[0]}`);
    }
    
    console.log('YOLO inference completed successfully');
    console.log('Output shape:', output.dims);
    console.log('Output data length:', output.data.length);
    
    // Parse YOLO output and convert to DetectedTree[]
    const outputData = output.data as Float32Array;
    const detectedTreesWithConfidence: Array<{tree: DetectedTree, confidence: number}> = [];
    const confidenceThreshold = 0.5;
    
    // YOLO output format: [batch, detections, 6]
    // The 6 values represent: [x1, y1, x2, y2, confidence, class_id]
    const numDetections = output.dims[1]; // Should be 300
    
    for (let i = 0; i < numDetections; i++) {
      const baseIndex = i * 6;
      
      const x1 = outputData[baseIndex];     // top-left x
      const y1 = outputData[baseIndex + 1]; // top-left y
      const x2 = outputData[baseIndex + 2]; // bottom-right x
      const y2 = outputData[baseIndex + 3]; // bottom-right y
      const confidence = outputData[baseIndex + 4]; // confidence score
      // const classId = outputData[baseIndex + 5]; // class_id (ignored)
      
      // Filter by confidence threshold
      if (confidence > confidenceThreshold) {
        console.log('Confident box raw: ', x1, y1, x2, y2, confidence);
        
        // Convert from absolute coordinates (0-640) to relative coordinates (0-1)
        const imageSize = 640; // YOLO model input size
        const x1_rel = x1 / imageSize;
        const y1_rel = y1 / imageSize;
        const x2_rel = x2 / imageSize;
        const y2_rel = y2 / imageSize;
        
        // Convert from x1,y1,x2,y2 to x,y,width,height format (relative)
        const x = x1_rel;
        const y = y1_rel;
        const width = x2_rel - x1_rel;
        const height = y2_rel - y1_rel;
        
        console.log('Converted to relative: ', x, y, width, height);
        
        const tree: DetectedTree = {
          id: `tree_${detectedTreesWithConfidence.length + 1}`,
          x: Math.max(0, Math.min(1, x)), // Clamp to [0, 1]
          y: Math.max(0, Math.min(1, y)), // Clamp to [0, 1]
          width: Math.max(0, Math.min(1, width)), // Clamp to [0, 1]
          height: Math.max(0, Math.min(1, height)), // Clamp to [0, 1]
          selected: true, // All detected trees are selected by default
        };
        
        detectedTreesWithConfidence.push({ tree, confidence });
      }
    }
    
    // Sort by confidence score in descending order
    detectedTreesWithConfidence.sort((a, b) => b.confidence - a.confidence);
    
    // Extract just the trees (sorted by confidence)
    const detectedTrees = detectedTreesWithConfidence.map((item, index) => ({
      ...item.tree,
      id: `tree_${index + 1}` // Reassign IDs based on sorted order
    }));
    
    console.log(`Found ${detectedTrees.length} trees with confidence > ${confidenceThreshold}`);
    
    // Debug: Print bounding box coordinates and confidence scores
    if (detectedTrees.length > 0) {
      console.log('Detected trees (sorted by confidence):');
      detectedTreesWithConfidence.forEach((item, index) => {
        const tree = item.tree;
        const confidence = item.confidence;
        console.log(`  Tree ${index + 1}:`);
        console.log(`    Coordinates: x=${tree.x.toFixed(4)}, y=${tree.y.toFixed(4)}, width=${tree.width.toFixed(4)}, height=${tree.height.toFixed(4)}`);
        console.log(`    Confidence: ${confidence.toFixed(4)}`);
        console.log(`    Bounding box: [${tree.x.toFixed(4)}, ${tree.y.toFixed(4)}, ${(tree.x + tree.width).toFixed(4)}, ${(tree.y + tree.height).toFixed(4)}]`);
      });
    } else {
      console.log('No trees detected with confidence > 0.5');
    }
    
    return detectedTrees;
  } catch (error) {
    console.error('YOLO inference failed:', error);
    throw error;
  }
}

export default function TreeDetectionScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const [detectedTrees, setDetectedTrees] = useState<DetectedTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (imageUri) {
      console.log('Image URI received:', imageUri);
      runTreeDetection();
    }
  }, [imageUri]);

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
            'No Trees Detected', 
            'No trees were found in this image with sufficient confidence. Try taking another photo with better lighting or clearer tree visibility.'
          );
        }
      } else {
        // Fallback to mock data if no image URI
        console.log('No image URI provided, using mock detection');
        
        // Mock ML detection - simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Generate 3 random bounding boxes
        const mockDetections: DetectedTree[] = [
          {
            id: '1',
            x: 0.15,
            y: 0.2,
            width: 0.25,
            height: 0.35,
            selected: true,
          },
          {
            id: '2',
            x: 0.5,
            y: 0.15,
            width: 0.3,
            height: 0.4,
            selected: true,
          },
          {
            id: '3',
            x: 0.75,
            y: 0.25,
            width: 0.2,
            height: 0.3,
            selected: true,
          },
        ];
        
        setDetectedTrees(mockDetections);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to detect trees');
      console.error('Detection error:', error);
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
        Alert.alert('No Selection', 'Please select at least one tree to save.');
        return;
      }

      const currentDate = new Date().toISOString();

      // Save each selected tree to the database
      for (const tree of selectedTrees) {
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
        };

        await treeDatabase.insertTree(treeRecord);
      }

      Alert.alert(
        'Success',
        `${selectedTrees.length} tree${selectedTrees.length === 1 ? '' : 's'} saved successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.push('/');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save trees');
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
    if (!imageSize.width || !imageSize.height) return null;

    return (
      <Svg
        style={StyleSheet.absoluteFillObject}
        width={imageSize.width}
        height={imageSize.height}
      >
        {detectedTrees.map((tree, index) => {
          const x = tree.x * imageSize.width;
          const y = tree.y * imageSize.height;
          const width = tree.width * imageSize.width;
          const height = tree.height * imageSize.height;
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
        <Text style={styles.errorText}>No image selected</Text>
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
        <Text style={styles.title}>Tree Detection</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageContainer}>
          {imageError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load image</Text>
              <Text style={styles.errorSubtext}>Please try taking another photo</Text>
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
              onLoad={() => {
                console.log('Image loaded successfully');
                setImageError(false);
              }}
              resizeMode="contain"
            />
          )}
          {!loading && !imageError && renderBoundingBoxes()}
          
          {loading && (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>Detecting trees...</Text>
              <Text style={styles.loadingSubtext}>
                AI is analyzing the image
              </Text>
            </View>
          )}
        </View>

        {!loading && (
          <>
            <View style={styles.detectionInfo}>
              <Text style={styles.detectionTitle}>
                {detectedTrees.length} Trees Detected
              </Text>
              <Text style={styles.detectionSubtitle}>
                Tap trees to select/deselect them for saving
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
                      Tree {index + 1}
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
                  ? 'Saving...'
                  : `Save ${detectedTrees.filter(t => t.selected).length} Trees`
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  detectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
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
});