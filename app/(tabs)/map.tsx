import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ClusteredYamap, Marker, Yamap, Polygon } from 'react-native-yamap-plus';
import { getTreesForMap, calculateMapRegion, TreeWithMarkerInfo, getMapStyle } from '@/utils/mapUtils';
import { processHexagonData, HexagonData, getHexagonBoundary } from '@/utils/hexagonUtils';
import { TreePine, Navigation, Grid3x3 } from 'lucide-react-native';
import * as Location from 'expo-location';

export default function MapScreen() {
  const [trees, setTrees] = useState<TreeWithMarkerInfo[]>([]);
  const [hexagonData, setHexagonData] = useState<HexagonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showHexagonView, setShowHexagonView] = useState(false);
  const mapRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadTrees();
  }, []);

  // Reload trees when screen comes into focus (e.g., after AI analysis)
  useFocusEffect(
    React.useCallback(() => {
      loadTrees();
    }, [])
  );

  const loadTrees = async () => {
    try {
      setLoading(true);
      const treesWithGPS = await getTreesForMap(null);
      setTrees(treesWithGPS);
    } catch (error) {
      console.error('Error loading trees for map:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHexagonData = async () => {
    try {
      setLoading(true);
      const data = await processHexagonData();
      setHexagonData(data);
    } catch (error) {
      console.error('Error loading hexagon data:', error);
      Alert.alert(
        'Ошибка загрузки',
        'Не удалось загрузить данные для карты плотности дефектов.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerPress = (treeId: number) => {
    router.push(`/tree-detail/${treeId}`);
  };

  const handleGpsPress = async () => {
    try {
      setGpsLoading(true);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Разрешение на местоположение',
          'Для определения вашего местоположения необходимо разрешение на доступ к GPS.'
        );
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      
      // Center map on current location
      if (mapRef.current) {
        mapRef.current.setCenter({ lat: latitude, lon: longitude }, 16);
      }
      
    } catch (error) {
      console.error('GPS location error:', error);
      Alert.alert(
        'Ошибка GPS',
        'Не удалось определить ваше местоположение. Проверьте, что GPS включен и доступен.'
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleDensityMapPress = async () => {
    if (showHexagonView) {
      setShowHexagonView(false);
    } else {
      await loadHexagonData();
      setShowHexagonView(true);
    }
  };

  const handleBackToMapPress = () => {
    setShowHexagonView(false);
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <TreePine size={64} color="#9ca3af" />
      <Text style={styles.emptyTitle}>Нет деревьев на карте</Text>
      <Text style={styles.emptyDescription}>
        Сфотографируйте деревья, чтобы увидеть их на карте
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Карта деревьев</Text>
          <Text style={styles.subtitle}>Загрузка...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Загрузка деревьев...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (trees.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Карта деревьев</Text>
          <Text style={styles.subtitle}>Нет деревьев с GPS координатами</Text>
        </View>
        <EmptyState />
      </SafeAreaView>
    );
  }

  // Calculate map region based on current view
  const mapRegion = showHexagonView 
    ? (() => {
        if (hexagonData.length === 0) {
          return { lat: 55.7558, lon: 37.6176, zoom: 10 };
        }
        
        const hexagonCenters = hexagonData.map(hex => {
          const boundary = getHexagonBoundary(hex.hexagonId);
          if (boundary.length === 0) return null;
          
          const avgLat = boundary.reduce((sum, coord) => sum + coord.lat, 0) / boundary.length;
          const avgLon = boundary.reduce((sum, coord) => sum + coord.lon, 0) / boundary.length;
          
          return { lat: avgLat, lon: avgLon };
        }).filter(Boolean) as { lat: number; lon: number }[];

        if (hexagonCenters.length === 0) {
          return { lat: 55.7558, lon: 37.6176, zoom: 10 };
        }
        
        if (hexagonCenters.length === 1) {
          return { lat: hexagonCenters[0].lat, lon: hexagonCenters[0].lon, zoom: 16 };
        }
        
        const lats = hexagonCenters.map(center => center.lat);
        const lons = hexagonCenters.map(center => center.lon);
        
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        
        const latDiff = maxLat - minLat;
        const lonDiff = maxLon - minLon;
        const maxDiff = Math.max(latDiff, lonDiff);
        
        let zoom = 10;
        if (maxDiff < 0.01) zoom = 16;
        else if (maxDiff < 0.05) zoom = 14;
        else if (maxDiff < 0.1) zoom = 12;
        else if (maxDiff < 0.5) zoom = 10;
        else zoom = 8;
        
        return { lat: centerLat, lon: centerLon, zoom };
      })()
    : calculateMapRegion(trees);

  // Convert trees to clusteredMarkers format
  const clusteredMarkers = trees.map((tree) => ({
    point: {
      lat: tree.latitude!,
      lon: tree.longitude!,
    },
    data: {
      id: tree.id,
      markerIcon: tree.markerIcon,
    },
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {showHexagonView ? 'Карта плотности дефектов' : 'Карта деревьев'}
        </Text>
        <Text style={styles.subtitle}>
          {showHexagonView 
            ? `${hexagonData.length} ${hexagonData.length === 1 ? 'гексагон' : hexagonData.length < 5 ? 'гексагона' : 'гексагонов'} на карте`
            : `${trees.length} ${trees.length === 1 ? 'дерево' : trees.length < 5 ? 'дерева' : 'деревьев'} на карте`
          }
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {showHexagonView ? (
          <Yamap
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            logoPosition={{ horizontal: 'left', vertical: 'bottom' }}
            logoPadding={{ horizontal: 16, vertical: 16 }}
            mapStyle={getMapStyle()}
          >
            {hexagonData.map((hex, index) => {
              const boundary = getHexagonBoundary(hex.hexagonId);
              if (boundary.length === 0) return null;

              return (
                <Polygon
                  key={hex.hexagonId}
                  points={boundary}
                  fillColor={hex.color}
                  strokeColor="#ffffff"
                  strokeWidth={1}
                  zIndex={index}
                />
              );
            })}
          </Yamap>
        ) : (
          <ClusteredYamap
            ref={mapRef}
            style={styles.map}
            initialRegion={mapRegion}
            logoPosition={{ horizontal: 'left', vertical: 'bottom' }}
            logoPadding={{ horizontal: 16, vertical: 16 }}
            mapStyle={getMapStyle()}
            clusterColor="#22c55e"
            clusteredMarkers={clusteredMarkers}
            renderMarker={(info, index) => (
              <Marker
                key={index}
                point={info.point}
                source={info.data.markerIcon}
                scale={1.0}
                onPress={() => {
                  if (info.data.id) {
                    handleMarkerPress(info.data.id);
                  }
                }}
              />
            )}
            onMapLoaded={() => {
              console.log('Map loaded successfully');
            }}
          />
        )}
        
        {/* GPS Button - positioned over the map */}
        <TouchableOpacity
          style={[styles.gpsButton, gpsLoading && styles.gpsButtonDisabled]}
          onPress={handleGpsPress}
          disabled={gpsLoading}
        >
          {gpsLoading ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <Navigation size={24} color="#22c55e" />
          )}
        </TouchableOpacity>

        {/* Back to Map Button - only shown in hexagon view */}
        {showHexagonView && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToMapPress}
          >
            <TreePine size={24} color="#22c55e" />
          </TouchableOpacity>
        )}

        {/* Density Map Button - only shown in tree view */}
        {!showHexagonView && (
          <TouchableOpacity
            style={styles.densityButton}
            onPress={handleDensityMapPress}
          >
            <Grid3x3 size={24} color="#22c55e" />
          </TouchableOpacity>
        )}

        {/* Legend - positioned over the map */}
        <View style={styles.legendContainer}>
          {showHexagonView ? (
            <>
              <Text style={styles.legendTitle}>Плотность дефектов</Text>
              <View style={styles.legendGradient}>
                <View style={[styles.legendColor, { backgroundColor: '#22c55e' }]} />
                <View style={[styles.legendColor, { backgroundColor: '#84cc16' }]} />
                <View style={[styles.legendColor, { backgroundColor: '#eab308' }]} />
                <View style={[styles.legendColor, { backgroundColor: '#f97316' }]} />
                <View style={[styles.legendColor, { backgroundColor: '#ef4444' }]} />
              </View>
              <View style={styles.legendLabels}>
                <Text style={styles.legendLabel}>0%</Text>
                <Text style={styles.legendLabel}>25%</Text>
                <Text style={styles.legendLabel}>50%</Text>
                <Text style={styles.legendLabel}>75%</Text>
                <Text style={styles.legendLabel}>100%</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendMarker, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.legendText}>Без дефектов</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendMarker, { backgroundColor: '#f97316' }]} />
                <Text style={styles.legendText}>С дефектами</Text>
              </View>
              <View style={[styles.legendItem, { marginBottom: 0 }]}>
                <View style={[styles.legendMarker, { backgroundColor: '#9ca3af' }]} />
                <Text style={styles.legendText}>Не проанализировано ИИ</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  legendContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  legendMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  legendText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
    flexShrink: 1,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  legendGradient: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  legendColor: {
    flex: 1,
    height: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  legendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  gpsButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  gpsButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#9ca3af',
  },
  densityButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  backButton: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
  },
});
