/**
 * Tree cropping utilities
 * Handles cropping tree images based on bounding box coordinates
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface CropCoordinates {
  x: number;      // top-left x (relative 0-1)
  y: number;      // top-left y (relative 0-1)
  width: number;  // width (relative 0-1)
  height: number; // height (relative 0-1)
}


/**
 * Alternative cropping method that works with actual image dimensions
 * This method gets the image dimensions first, then crops using pixel coordinates
 */
export async function cropTreeWithDimensions(
  imageUri: string,
  coordinates: CropCoordinates,
  treeId: string
): Promise<string> {
  try {
    console.log('Starting tree crop with dimensions for tree:', treeId);
    console.log('Original image URI:', imageUri);
    console.log('Crop coordinates:', coordinates);
    
    // Get image dimensions from the image URI
    const imageInfo = await FileSystem.getInfoAsync(imageUri);
    if (!imageInfo.exists) {
      throw new Error(`Original image does not exist: ${imageUri}`);
    }
    
    // Get image dimensions using expo-image-manipulator
    const imageDimensions = await manipulateAsync(
      imageUri,
      [], // No manipulations, just get info
      { format: SaveFormat.JPEG }
    );
    
    const imageWidth = imageDimensions.width;
    const imageHeight = imageDimensions.height;
    console.log('Image dimensions:', imageWidth, 'x', imageHeight);

    // Convert relative coordinates to pixel coordinates
    const pixelX = Math.round(coordinates.x * imageWidth);
    const pixelY = Math.round(coordinates.y * imageHeight);
    const pixelWidth = Math.round(coordinates.width * imageWidth);
    const pixelHeight = Math.round(coordinates.height * imageHeight);

    console.log('Pixel coordinates:', pixelX, pixelY, pixelWidth, pixelHeight);

    // Ensure coordinates are within image bounds
    const clampedX = Math.max(0, Math.min(pixelX, imageWidth - 1));
    const clampedY = Math.max(0, Math.min(pixelY, imageHeight - 1));
    const clampedWidth = Math.max(1, Math.min(pixelWidth, imageWidth - clampedX));
    const clampedHeight = Math.max(1, Math.min(pixelHeight, imageHeight - clampedY));

    console.log('Clamped coordinates:', clampedX, clampedY, clampedWidth, clampedHeight);

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

    console.log('Crop result URI:', cropResult.uri);

    // Extract filename from the crop result URI (it already has a random name)
    const uriParts = cropResult.uri.split('/');
    const originalFileName = uriParts[uriParts.length - 1];
    const cropFileName = `tree_crop_${originalFileName}`;
    const cropPath = `${FileSystem.documentDirectory}${cropFileName}`;

    // Copy the cropped image to our desired location
    await FileSystem.copyAsync({
      from: cropResult.uri,
      to: cropPath,
    });

    console.log('Tree crop saved to:', cropPath, 'with filename:', cropFileName);
    return cropPath;
  } catch (error) {
    console.error('Error cropping tree with dimensions:', error);
    throw error;
  }
}
