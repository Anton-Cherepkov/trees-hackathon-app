import { treeDatabase, TreeRecord } from '@/database/treeDatabase';

export interface TreeWithMarkerInfo extends TreeRecord {
  hasDefects: boolean;
  markerIcon: any; // require() result for marker image
}

export interface MapRegion {
  lat: number;
  lon: number;
  zoom: number;
}

/**
 * Get trees for map display with marker information
 * @param treeIds - Array of tree IDs to fetch, or null to fetch all trees
 * @returns Array of trees with GPS coordinates and marker info
 */
export const getTreesForMap = async (treeIds: number[] | null): Promise<TreeWithMarkerInfo[]> => {
  try {
    let trees: TreeRecord[];
    
    if (treeIds === null) {
      // Fetch all trees
      trees = await treeDatabase.getAllTrees();
    } else {
      // Fetch specific trees
      trees = [];
      for (const id of treeIds) {
        const tree = await treeDatabase.getTreeById(id);
        if (tree) {
          trees.push(tree);
        }
      }
    }
    
    // Filter out trees without GPS coordinates
    const treesWithGPS = trees.filter(tree => 
      tree.latitude !== null && 
      tree.longitude !== null && 
      tree.latitude !== undefined && 
      tree.longitude !== undefined
    );
    
    // For each tree, check if it has defects and determine marker icon
    const treesWithMarkerInfo: TreeWithMarkerInfo[] = [];
    
    for (const tree of treesWithGPS) {
      if (!tree.id) continue;
      
      // Check if tree has defects
      const defects = await treeDatabase.getDefectsByTreeId(tree.id);
      const hasDefects = defects.length > 0;
      
      // Determine marker icon based on taxon and defects
      const markerIcon = getMarkerIcon(tree, hasDefects);
      
      treesWithMarkerInfo.push({
        ...tree,
        hasDefects,
        markerIcon,
      });
    }
    
    return treesWithMarkerInfo;
  } catch (error) {
    console.error('Error getting trees for map:', error);
    return [];
  }
};

/**
 * Get appropriate marker icon for a tree based on its status
 * @param tree - Tree record
 * @param hasDefects - Whether the tree has defects
 * @returns Marker icon (require() result)
 */
export const getMarkerIcon = (tree: TreeRecord, hasDefects: boolean): any => {
  // No taxon predicted - gray marker
  if (!tree.taxonName) {
    return require('@/assets/images/tree_map_marker_gray.png');
  }
  
  // Has taxon but no defects - green marker
  if (!hasDefects) {
    return require('@/assets/images/tree_map_marker_green.png');
  }
  
  // Has taxon and has defects - orange marker
  return require('@/assets/images/tree_map_marker_orange.png');
};

/**
 * Calculate map region to show 400x400m area around a specific tree
 * @param tree - Tree with GPS coordinates
 * @returns Map region centered on the tree with appropriate zoom
 */
export const calculateTreeDetailMapRegion = (tree: TreeRecord): MapRegion => {
  if (!tree.latitude || !tree.longitude) {
    // Fallback to Moscow center if no GPS
    return {
      lat: 55.7558,
      lon: 37.6176,
      zoom: 15,
    };
  }
  
  return {
    lat: tree.latitude,
    lon: tree.longitude,
    zoom: 15, // This zoom level shows approximately 400x400m area
  };
};

/**
 * Calculate map region to show all trees
 * @param trees - Array of trees with GPS coordinates
 * @returns Map region with center and zoom level
 */
export const calculateMapRegion = (trees: TreeRecord[]): MapRegion => {
  if (trees.length === 0) {
    // Default to Moscow center if no trees
    return {
      lat: 55.7558,
      lon: 37.6176,
      zoom: 10,
    };
  }
  
  if (trees.length === 1) {
    // Single tree - center on it with close zoom
    const tree = trees[0];
    return {
      lat: tree.latitude!,
      lon: tree.longitude!,
      zoom: 16,
    };
  }
  
  // Multiple trees - calculate bounding box
  const latitudes = trees.map(tree => tree.latitude!).filter(lat => lat !== null);
  const longitudes = trees.map(tree => tree.longitude!).filter(lon => lon !== null);
  
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  
  // Calculate center
  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;
  
  // Calculate zoom level based on bounding box size
  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;
  const maxDiff = Math.max(latDiff, lonDiff);
  
  let zoom: number;
  if (maxDiff > 0.1) {
    zoom = 8; // Very wide area
  } else if (maxDiff > 0.05) {
    zoom = 10; // Wide area
  } else if (maxDiff > 0.01) {
    zoom = 12; // Medium area
  } else if (maxDiff > 0.005) {
    zoom = 14; // Small area
  } else {
    zoom = 16; // Very small area
  }
  
  return {
    lat: centerLat,
    lon: centerLon,
    zoom,
  };
};
