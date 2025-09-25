/**
 * Tree classification utilities
 * Handles sending tree crop images to classification API
 */

import * as FileSystem from 'expo-file-system';

const API_URL = 'http://203.31.40.21:8123/classify';

export interface ClassificationResult {
  label: string;
  confidence: number;
  [key: string]: any;
}

/**
 * Convert image file to base64 string
 * @param imagePath - Path to the image file
 * @returns Promise<string> - Base64 encoded image
 */
async function imageToBase64(imagePath: string): Promise<string> {
  try {
    console.log('Converting image to base64:', imagePath);
    
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(imagePath);
    if (!fileInfo.exists) {
      throw new Error(`Image file does not exist: ${imagePath}`);
    }
    
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(imagePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('Image converted to base64 successfully, length:', base64.length);
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Classify tree image using the classification API
 * @param imagePath - Path to the tree crop image
 * @returns Promise<ClassificationResult> - Classification result from API
 */
export async function classifyTreeImage(imagePath: string): Promise<ClassificationResult> {
  try {
    console.log('Starting tree classification for image:', imagePath);
    
    // Convert image to base64
    const imageBase64 = await imageToBase64(imagePath);
    
    // Prepare payload (x1, y1, x2, y2 are null as requested)
    const payload = {
      image_base64: imageBase64,
      x1: null,
      y1: null,
      x2: null,
      y2: null,
    };
    
    console.log('Sending classification request to:', API_URL);
    console.log('Payload size:', JSON.stringify(payload).length, 'characters');
    
    // Send request to classification API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Classification result received:', result);
    
    return result;
  } catch (error) {
    console.error('Error classifying tree image:', error);
    throw error;
  }
}

/**
 * Extract taxon name from classification result
 * @param result - Classification result from API
 * @returns string - Taxon name or null if not available
 */
export function extractTaxonName(result: ClassificationResult): string | null {
  try {
    return result.label || null;
  } catch (error) {
    console.error('Error extracting taxon name:', error);
    return null;
  }
}

/**
 * Format classification result as description text
 * @param result - Classification result from API
 * @returns string - Formatted description text
 */
export function formatClassificationResult(result: ClassificationResult): string {
  try {
    // Convert the JSON result to a readable description
    // Adjust this based on the actual API response structure
    return JSON.stringify(result, null, 2);
  } catch (error) {
    console.error('Error formatting classification result:', error);
    return 'Error formatting classification result';
  }
}
