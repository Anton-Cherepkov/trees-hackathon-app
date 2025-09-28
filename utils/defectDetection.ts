/**
 * Defect detection utilities
 * Handles image processing for defect detection and cropping
 */

import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { DefectRecord } from '@/database/treeDatabase';

export interface DefectDetectionResult {
  image_key: string;
  defect_bbox: [number, number, number, number]; // [xtl, ytl, xbr, ybr]
  defect_type: string;
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
 * Mock defect detection API call
 * In a real implementation, this would send the images to a remote server
 */
export async function detectDefects(images: ImageData): Promise<DefectDetectionResult[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock response - simulate finding defects in some images
  const mockDefects: DefectDetectionResult[] = [];
  
  // Add some mock defects based on available images
  const imageKeys = Object.keys(images);
  
  if (imageKeys.includes('tree_crop')) {
    // First hollow defect in tree crop
    mockDefects.push({
      image_key: 'tree_crop',
      defect_bbox: [0.2, 0.3, 0.4, 0.6], // [xtl, ytl, xbr, ybr] as relative coordinates
      defect_type: 'hollow'
    });
  }
  
  if (imageKeys.includes('additional_0')) {
    // Second hollow defect in first additional image
    mockDefects.push({
      image_key: 'additional_0',
      defect_bbox: [0.1, 0.1, 0.3, 0.4],
      defect_type: 'hollow'
    });
  }
  
  if (imageKeys.includes('additional_1')) {
    // Crack defect in second additional image
    mockDefects.push({
      image_key: 'additional_1',
      defect_bbox: [0.5, 0.2, 0.8, 0.5],
      defect_type: 'crack'
    });
  }
  
  // If we have more images, add more hollow defects to reach the target count
  if (imageKeys.length > 2 && imageKeys.includes('additional_2')) {
    // Additional hollow defect if third image exists
    mockDefects.push({
      image_key: 'additional_2',
      defect_bbox: [0.3, 0.4, 0.6, 0.7],
      defect_type: 'hollow'
    });
  }
  
  console.log('Mock defect detection completed:', mockDefects);
  return mockDefects;
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
      } else {
        const additionalIndex = parseInt(defect.image_key.replace('additional_', ''));
        originalImageUri = additionalImages[additionalIndex];
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
