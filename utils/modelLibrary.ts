import { ModelInfo } from './onnxUtils';

/**
 * Model Asset Library for managing ONNX models
 * This library provides a centralized way to manage and access ONNX models
 */

export interface ModelCatalog {
  [key: string]: ModelInfo;
}

/**
 * Available ONNX models in the assets directory
 */
export const MODEL_CATALOG: ModelCatalog = {
  'yolo11s': {
    name: 'yolo custom',
    path: 'assets/models/best-yolov11s-tune-no-freeze-no-single-cls.onnx',
    inputShape: [1, 3, 640, 640],
    outputShape: [1, 300, 6],
    description: 'coco yolo',
  },
};


/**
 * Get a specific model by key
 */
export function getModel(key: string): ModelInfo | undefined {
  return MODEL_CATALOG[key];
}

/**
 * Get all available models
 */
export function getAllModels(): ModelInfo[] {
  return Object.values(MODEL_CATALOG);
}

/**
 * Get model keys (IDs)
 */
export function getModelKeys(): string[] {
  return Object.keys(MODEL_CATALOG);
}

/**
 * Search models by name or description
 */
export function searchModels(query: string): ModelInfo[] {
  const lowercaseQuery = query.toLowerCase();
  return Object.values(MODEL_CATALOG).filter(model =>
    model.name.toLowerCase().includes(lowercaseQuery) ||
    model.description.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Get models suitable for mobile deployment (smaller input size)
 */
export function getMobileOptimizedModels(): ModelInfo[] {
  return Object.values(MODEL_CATALOG).filter(model =>
    model.inputShape[2] <= 640 && // Width <= 640
    model.inputShape[3] <= 640    // Height <= 640
  );
}

/**
 * Get models by input size
 */
export function getModelsByInputSize(size: number): ModelInfo[] {
  return Object.values(MODEL_CATALOG).filter(model =>
    model.inputShape[2] === size && model.inputShape[3] === size
  );
}

/**
 * Model validation utilities
 */
export class ModelValidator {
  /**
   * Validate if a model info object has all required fields
   */
  static validateModelInfo(modelInfo: ModelInfo): boolean {
    return !!(
      modelInfo.name &&
      modelInfo.path &&
      modelInfo.inputShape &&
      modelInfo.outputShape &&
      modelInfo.description &&
      Array.isArray(modelInfo.inputShape) &&
      Array.isArray(modelInfo.outputShape) &&
      modelInfo.inputShape.length > 0 &&
      modelInfo.outputShape.length > 0
    );
  }

  /**
   * Check if model path exists (placeholder - would need file system access)
   */
  static async validateModelPath(path: string): Promise<boolean> {
    // This is a placeholder implementation
    // In a real scenario, you would check if the file exists
    console.log(`Validating model path: ${path}`);
    return path.startsWith('assets/models/') && path.endsWith('.onnx');
  }

  /**
   * Get model size information (placeholder)
   */
  static async getModelSize(path: string): Promise<number> {
    // This is a placeholder implementation
    // In a real scenario, you would get the actual file size
    console.log(`Getting model size for: ${path}`);
    return 0; // Placeholder
  }
}

