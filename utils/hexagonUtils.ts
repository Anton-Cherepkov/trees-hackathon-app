import * as h3 from 'h3-react-native';
import { treeDatabase, TreeRecord, DefectRecord } from '@/database/treeDatabase';

export interface HexagonData {
  hexagonId: string;
  trees: TreeRecord[];
  defectRatio: number;
  color: string;
}

export interface TreeWithDefects extends TreeRecord {
  hasDefects: boolean;
}

/**
 * Get trees with non-null descriptions and GPS coordinates for hexagon analysis
 */
export const getTreesForHexagonMap = async (): Promise<TreeWithDefects[]> => {
  try {
    const allTrees = await treeDatabase.getAllTrees();
    
    // Filter trees with non-null descriptions and GPS coordinates
    const treesWithGPS = allTrees.filter(tree => 
      tree.description !== null && 
      tree.description !== '' &&
      tree.latitude !== null && 
      tree.longitude !== null && 
      tree.latitude !== undefined && 
      tree.longitude !== undefined
    );
    
    // Check defects for each tree
    const treesWithDefects: TreeWithDefects[] = [];
    
    for (const tree of treesWithGPS) {
      if (!tree.id) continue;
      
      const defects = await treeDatabase.getDefectsByTreeId(tree.id);
      const hasDefects = defects.length > 0;
      
      treesWithDefects.push({
        ...tree,
        hasDefects,
      });
    }
    
    return treesWithDefects;
  } catch (error) {
    console.error('Error getting trees for hexagon map:', error);
    return [];
  }
};

/**
 * Group trees by H3 hexagon cell ID
 */
export const groupTreesByHexagon = (trees: TreeWithDefects[], resolution: number = 8): Map<string, TreeWithDefects[]> => {
  const hexagonMap = new Map<string, TreeWithDefects[]>();
  
  for (const tree of trees) {
    try {
      const hexagonId = h3.latLngToCell(tree.latitude!, tree.longitude!, resolution);
      
      if (!hexagonMap.has(hexagonId)) {
        hexagonMap.set(hexagonId, []);
      }
      
      hexagonMap.get(hexagonId)!.push(tree);
    } catch (error) {
      console.error('Error converting lat/lng to H3 cell:', error);
    }
  }
  
  return hexagonMap;
};

/**
 * Calculate defect ratio for each hexagon
 */
export const calculateHexagonDefectRatio = (trees: TreeWithDefects[]): number => {
  if (trees.length === 0) return 0;
  
  const treesWithDefects = trees.filter(tree => tree.hasDefects);
  return treesWithDefects.length / trees.length;
};

/**
 * Convert HSV color to RGB hex string
 */
export const hsvToRgb = (h: number, s: number, v: number): string => {
  // Normalize values
  h = h / 360;
  s = s / 100;
  v = v / 100;
  
  const c = v * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = v - c;
  
  let r = 0, g = 0, b = 0;
  
  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);
  
  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
};

/**
 * Get color for hexagon based on defect ratio
 * Maps ratio (0-1) to color (green→red in HSV space) with 50% transparency
 */
export const getHexagonColor = (ratio: number): string => {
  // Clamp ratio between 0 and 1
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  
  // Map ratio to hue: 120° (green) to 0° (red)
  const hue = 120 * (1 - clampedRatio);
  
  const rgbColor = hsvToRgb(hue, 100, 100);
  
  // Convert hex to RGBA with 50% transparency
  const hex = rgbColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, 0.35)`;
};

/**
 * Get hexagon boundary coordinates for polygon rendering
 */
export const getHexagonBoundary = (hexagonId: string): { lat: number; lon: number }[] => {
  try {
    const boundary = h3.cellToBoundary(hexagonId);
    return boundary.map((coord: [number, number]) => ({
      lat: coord[0],
      lon: coord[1]
    }));
  } catch (error) {
    console.error('Error getting hexagon boundary:', error);
    return [];
  }
};

/**
 * Process all trees and create hexagon data for visualization
 */
export const processHexagonData = async (): Promise<HexagonData[]> => {
  try {
    const trees = await getTreesForHexagonMap();
    const hexagonMap = groupTreesByHexagon(trees);
    
    const hexagonData: HexagonData[] = [];
    
    for (const [hexagonId, hexagonTrees] of hexagonMap) {
      const defectRatio = calculateHexagonDefectRatio(hexagonTrees);
      const color = getHexagonColor(defectRatio);
      
      hexagonData.push({
        hexagonId,
        trees: hexagonTrees,
        defectRatio,
        color,
      });
    }
    
    return hexagonData;
  } catch (error) {
    console.error('Error processing hexagon data:', error);
    return [];
  }
};
