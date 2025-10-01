/**
 * Defect detection utilities
 * Handles image processing for defect detection and cropping
 */

import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { DefectRecord } from '@/database/treeDatabase';

export interface DefectDetectionResult {
  image_key: string;
  defect_bbox: [number, number, number, number]; // [xtl, ytl, xbr, ybr] as relative coordinates
  defect_type: string;
}

// API request/response interfaces
export interface ImageKeyPair {
  key: string;
  image_base64: string;
}

export interface DetectionRequest {
  requests: ImageKeyPair[];
}

export interface ObjectBoxResponse {
  key: string;
  label: string;
  confidence: number;
  x1: number; // relative coordinate (0.0-1.0)
  y1: number; // relative coordinate (0.0-1.0)
  x2: number; // relative coordinate (0.0-1.0)
  y2: number; // relative coordinate (0.0-1.0)
}

export interface DetectionResponse {
  results: ObjectBoxResponse[];
}

export interface ImageData {
  [key: string]: string; // key -> base64 image data
}

/**
 * Convert image to base64 string
 */
export async function imageToBase64(imageUri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Prepare all images for defect detection
 * Returns a dictionary of image_key -> base64_data
 */
export async function prepareImagesForDefectDetection(
  treeCropPath: string,
  additionalImages: string[]
): Promise<ImageData> {
  const imageData: ImageData = {};
  
  try {
    // Add tree crop image
    if (treeCropPath) {
      const cropBase64 = await imageToBase64(treeCropPath);
      imageData['tree_crop'] = cropBase64;
    }
    
    // Add additional images
    for (let i = 0; i < additionalImages.length; i++) {
      const imageUri = additionalImages[i];
      const base64 = await imageToBase64(imageUri);
      imageData[`additional_${i}`] = base64;
    }
    
    return imageData;
  } catch (error) {
    console.error('Error preparing images for defect detection:', error);
    throw error;
  }
}

/**
 * Real defect detection API call to remote server
 */
export async function detectDefects(images: ImageData): Promise<DefectDetectionResult[]> {
  try {
    console.log('Sending images to defect detection API...');
    
    // Prepare request data
    const requests: ImageKeyPair[] = Object.entries(images).map(([key, base64Data]) => ({
      key,
      image_base64: base64Data
    }));
    
    const requestBody: DetectionRequest = {
      requests
    };
    
    console.log('API request prepared with', requests.length, 'images');
    
    // Make API call
    const response = await fetch('http://203.31.40.21:8123/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status} ${response.statusText}`);
    }
    
    const detectionResponse: DetectionResponse = await response.json();
    console.log('API response received:', detectionResponse);
    
    // Convert API response to our format and filter by confidence
    const defects: DefectDetectionResult[] = [];
    
    for (const result of detectionResponse.results) {
      // Only process results with confidence > 0.25
      if (result.confidence > 0.25) {
        // API returns relative coordinates directly (0.0-1.0 range)
        // No need to convert from absolute to relative coordinates
        defects.push({
          image_key: result.key,
          defect_bbox: [result.x1, result.y1, result.x2, result.y2], // [xtl, ytl, xbr, ybr] as relative coordinates
          defect_type: result.label
        });
      }
    }
    
    console.log('Defect detection completed:', defects);
    return defects;
    
  } catch (error) {
    console.error('Error calling defect detection API:', error);
    throw error;
  }
}

/**
 * Crop defect from image based on bounding box coordinates
 */
export async function cropDefect(
  imageUri: string,
  defectBbox: [number, number, number, number], // [xtl, ytl, xbr, ybr] as relative coordinates
  treeId: number,
  defectType: string,
  defectIndex: number
): Promise<string> {
  try {
    console.log('Cropping defect from image:', imageUri);
    console.log('Defect bbox (relative):', defectBbox);
    
    // Get image dimensions
    const imageDimensions = await manipulateAsync(
      imageUri,
      [], // No manipulations, just get info
      { format: SaveFormat.JPEG }
    );
    
    const imageWidth = imageDimensions.width;
    const imageHeight = imageDimensions.height;
    console.log('Image dimensions:', imageWidth, 'x', imageHeight);
    
    // Convert relative coordinates to pixel coordinates
    const [xtl, ytl, xbr, ybr] = defectBbox;
    const pixelX = Math.round(xtl * imageWidth);
    const pixelY = Math.round(ytl * imageHeight);
    const pixelWidth = Math.round((xbr - xtl) * imageWidth);
    const pixelHeight = Math.round((ybr - ytl) * imageHeight);
    
    console.log('Pixel coordinates:', pixelX, pixelY, pixelWidth, pixelHeight);
    
    // Ensure coordinates are within image bounds
    const clampedX = Math.max(0, Math.min(pixelX, imageWidth - 1));
    const clampedY = Math.max(0, Math.min(pixelY, imageHeight - 1));
    const clampedWidth = Math.max(1, Math.min(pixelWidth, imageWidth - clampedX));
    const clampedHeight = Math.max(1, Math.min(pixelHeight, imageHeight - clampedY));
    
    console.log('Clamped coordinates:', clampedX, clampedY, clampedWidth, clampedHeight);
    
    // Crop the defect
    const cropResult = await manipulateAsync(
      imageUri,
      [
        {
          crop: {
            originX: clampedX,
            originY: clampedY,
            width: clampedWidth,
            height: clampedHeight,
          },
        },
      ],
      {
        compress: 1,
        format: SaveFormat.JPEG,
        base64: false,
      }
    );
    
    // Generate filename for defect crop
    const defectFileName = `defect_${treeId}_${defectType.replace(/\s+/g, '_')}_${defectIndex}_${Date.now()}.jpg`;
    const defectCropPath = `${FileSystem.documentDirectory}${defectFileName}`;
    
    // Copy the cropped defect to our desired location
    await FileSystem.copyAsync({
      from: cropResult.uri,
      to: defectCropPath,
    });
    
    console.log('Defect crop saved to:', defectCropPath);
    return defectCropPath;
  } catch (error) {
    console.error('Error cropping defect:', error);
    throw error;
  }
}

/**
 * Process defects for a tree - main function that orchestrates the entire process
 */
export async function processDefectsForTree(
  treeId: number,
  treeCropPath: string,
  additionalImages: string[]
): Promise<DefectRecord[]> {
  try {
    console.log('Starting defect processing for tree:', treeId);
    
    // 1. Prepare all images for defect detection
    const images = await prepareImagesForDefectDetection(treeCropPath, additionalImages);
    console.log('Prepared images for defect detection:', Object.keys(images));
    
    // 2. Send to mock defect detection API
    const detectedDefects = await detectDefects(images);
    console.log('Detected defects:', detectedDefects);
    
    // 3. Process each detected defect
    const defectRecords: DefectRecord[] = [];
    
    for (let i = 0; i < detectedDefects.length; i++) {
      const defect = detectedDefects[i];
      
      // Find the original image URI based on the image_key
      let originalImageUri: string;
      if (defect.image_key === 'tree_crop') {
        originalImageUri = treeCropPath;
      } else if (defect.image_key.startsWith('additional_')) {
        // Extract the index from the key (e.g., "additional_0" -> "0")
        const indexMatch = defect.image_key.match(/^additional_(\d+)$/);
        if (indexMatch) {
          const additionalIndex = parseInt(indexMatch[1]);
          originalImageUri = additionalImages[additionalIndex];
        } else {
          console.error('Could not parse additional image index from key:', defect.image_key);
          continue; // Skip this defect
        }
      } else {
        console.error('Unknown image key format:', defect.image_key);
        continue; // Skip this defect
      }
      
      // Crop the defect
      const defectCropPath = await cropDefect(
        originalImageUri,
        defect.defect_bbox,
        treeId,
        defect.defect_type,
        i
      );
      
      // Create defect record
      const defectRecord: Omit<DefectRecord, 'defect_id'> = {
        tree_id: treeId,
        xtl: defect.defect_bbox[0],
        ytl: defect.defect_bbox[1],
        xbr: defect.defect_bbox[2],
        ybr: defect.defect_bbox[3],
        image_path: originalImageUri,
        crop_path: defectCropPath,
        defect_type: defect.defect_type,
      };
      
      defectRecords.push(defectRecord as DefectRecord);
    }
    
    console.log('Processed defect records:', defectRecords);
    return defectRecords;
  } catch (error) {
    console.error('Error processing defects for tree:', error);
    throw error;
  }
}
