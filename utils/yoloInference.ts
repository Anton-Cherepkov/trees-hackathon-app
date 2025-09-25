/**
 * YOLO Inference utilities for tree detection
 * Handles model inference, output parsing, and bounding box processing
 */

import * as ort from 'onnxruntime-react-native';
import { yoloModel } from '@/app/(tabs)/index';

export interface DetectedTree {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  xbr: number;
  ybr: number;
  selected: boolean;
}

/**
 * Run YOLO model inference on preprocessed image data
 * @param inputData - Preprocessed image data as Float32Array
 * @returns Array of detected trees with confidence > 0.5
 */
export async function runYOLOInference(inputData: Float32Array): Promise<DetectedTree[]> {
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
          xbr: Math.max(0, Math.min(1, x + width)),
          ybr: Math.max(0, Math.min(1, y + height)),
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
