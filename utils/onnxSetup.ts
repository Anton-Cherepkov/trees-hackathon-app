/**
 * ONNX Runtime setup for React Native
 * Based on: https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html
 */

// ES6 style import syntax (recommended)
import * as ort from 'onnxruntime-react-native';

// Alternative CommonJS style import syntax
// const ort = require('onnxruntime-react-native');

/**
 * Check if ONNX Runtime is available
 */
export function checkONNXAvailability(): boolean {
  try {
    return typeof ort.InferenceSession !== 'undefined' && 
           typeof ort.InferenceSession.create === 'function';
  } catch (error) {
    console.log('ONNX Runtime not available:', error);
    return false;
  }
}

/**
 * Get ONNX Runtime instance
 */
export function getONNXRuntime() {
  return ort;
}

/**
 * Log ONNX Runtime availability status
 */
export function logONNXStatus() {
  const isAvailable = checkONNXAvailability();
  console.log('ONNX Runtime available:', isAvailable);
  
  if (isAvailable) {
    console.log('ONNX Runtime version:', ort.env.versions?.common || 'unknown');
    console.log('ONNX Runtime ready for use');
  } else {
    console.log('ONNX Runtime not available - native module may not be linked');
  }
  
  return isAvailable;
}
