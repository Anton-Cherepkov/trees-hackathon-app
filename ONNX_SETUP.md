# ONNX Runtime Integration

This project has been configured with ONNX Runtime for React Native according to the [official documentation](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html).

## Setup Complete

### ✅ Package Installation
- `onnxruntime-react-native` package installed
- ONNX Runtime Extensions enabled in `package.json`

### ✅ Configuration
- Added `"onnxruntimeExtensionsEnabled": "true"` to `package.json`
- Created `utils/onnxSetup.ts` with basic import and availability checking

### ✅ Import Setup
```typescript
// ES6 style import (recommended)
import * as ort from 'onnxruntime-react-native';

// Or CommonJS style
const ort = require('onnxruntime-react-native');
```

## Next Steps

To use ONNX Runtime with native modules, you need to build a custom development build:

```bash
npx expo run:android
```

This will:
1. Generate native Android code
2. Link the ONNX Runtime native module
3. Create a development build with ONNX Runtime support

## Available Functions

- `checkONNXAvailability()` - Check if ONNX Runtime is available
- `getONNXRuntime()` - Get the ONNX Runtime instance
- `logONNXStatus()` - Log availability status to console

## Notes

- No inference code has been written yet
- Ready for custom development build
- ONNX Runtime will only work after running `npx expo run:android`
