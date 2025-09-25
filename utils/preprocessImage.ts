// preprocessImage.ts
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Buffer } from "buffer";
import { PNG } from "pngjs/browser";

export type PreprocessResult = {
  data: Float32Array;      // length = 1*3*640*640
  dims: [number, number, number, number]; // [1,3,640,640]
  width: number;           // 640
  height: number;          // 640
};

/**
 * Preprocess an image at `uri` for models expecting NCHW [1,3,640,640] float32 RGB in [0..1].
 * Works in Expo (managed or bare).
 */
export async function preprocessImage(uri: string): Promise<PreprocessResult> {
  // 1) Resize to 640x640 and export as PNG (lossless, predictable decoding)
  const { base64, width, height } = await manipulateAsync(
    uri,
    [{ resize: { width: 640, height: 640 } }],
    { compress: 1, format: SaveFormat.PNG, base64: true }
  );

  if (!base64) {
    throw new Error("Failed to obtain base64 from ImageManipulator.");
  }

  // 2) Decode PNG into raw RGBA bytes
  const pngBuffer = Buffer.from(base64, "base64");
  const png = PNG.sync.read(pngBuffer); // png.data = Uint8Array RGBA
  const w = png.width;
  const h = png.height;

  if (w !== 640 || h !== 640) {
    // (shouldn't happen, but guard anyway)
    throw new Error(`Unexpected decoded size: ${w}x${h}`);
  }

  const rgba = png.data; // length = w*h*4
  const pixelCount = w * h;

  // 3) Convert RGBA -> RGB, normalize to [0..1], and pack as NCHW
  //    [1, 3, 640, 640] with channel-major (R plane, then G, then B)
  const out = new Float32Array(3 * pixelCount);

  let rPtr = 0;
  let gPtr = pixelCount;
  let bPtr = pixelCount * 2;

  // RGBA stride = 4
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    const r = rgba[p];
    const g = rgba[p + 1];
    const b = rgba[p + 2];
    // alpha (rgba[p + 3]) ignored

    out[rPtr++] = r / 255;
    out[gPtr++] = g / 255;
    out[bPtr++] = b / 255;
  }

  return {
    data: out,
    dims: [1, 3, 640, 640],
    width: w,
    height: h,
  };
}
