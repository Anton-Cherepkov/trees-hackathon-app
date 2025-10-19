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
import { processHexagonData, HexagonData, getHexagonBoundary, getHexagonColor } from '@/utils/hexagonUtils';
import { treeDatabase } from '@/database/treeDatabase';
import { TreePine, Navigation, Grid3x3, HelpCircle } from 'lucide-react-native';
import * as Location from 'expo-location';

export default function MapScreen() {
  const [trees, setTrees] = useState<TreeWithMarkerInfo[]>([]);
  const [hexagonData, setHexagonData] = useState<HexagonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showHexagonView, setShowHexagonView] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<any>(null);
  const [selectedDefectType, setSelectedDefectType] = useState<string | null>(null);
  const [availableDefectTypes, setAvailableDefectTypes] = useState<string[]>([]);
  const [showDefectTypePicker, setShowDefectTypePicker] = useState(false);
  const [dropdownHeight, setDropdownHeight] = useState(0);
  const [showHeatmapExplanation, setShowHeatmapExplanation] = useState(false);

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
      // If database error, try to reinitialize and retry once
      if (error instanceof Error && error.message && error.message.includes('NativeStatement')) {
        console.log('Database connection error detected, attempting to reinitialize...');
        try {
          const { treeDatabase } = await import('@/database/treeDatabase');
          await treeDatabase.reinitialize();
          const treesWithGPS = await getTreesForMap(null);
          setTrees(treesWithGPS);
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          setTrees([]);
        }
      } else {
        setTrees([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDefectTypes = async () => {
    try {
      const defectTypes = await treeDatabase.getAllDefectTypes();
      setAvailableDefectTypes(defectTypes);
    } catch (error) {
      console.error('Error loading defect types:', error);
      setAvailableDefectTypes([]);
    }
  };

  const loadHexagonData = async () => {
    try {
      setLoading(true);
      const data = await processHexagonData(selectedDefectType);
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

  const saveCurrentRegion = (callback?: () => void) => {
    if (mapRef.current) {
      // Get both camera position and visible region for complete state
      mapRef.current.getCameraPosition((position: any) => {
        mapRef.current.getVisibleRegion((region: any) => {
          const savedRegion = {
            lat: position.point.lat,
            lon: position.point.lon,
            zoom: position.zoom,
            azimuth: position.azimuth,
            tilt: position.tilt,
            visibleRegion: region
          };
          setCurrentRegion(savedRegion);
          // Call callback after state is set
          if (callback) {
            setTimeout(callback, 50); // Small delay to ensure state update
          }
        });
      });
    } else {
      if (callback) callback();
    }
  };


  const handleDensityMapPress = async () => {
    if (showHexagonView) {
      // Save current region before switching
      saveCurrentRegion(() => {
        console.log('Switching from hexagon to tree view - no recalculation needed');
        setShowHexagonView(false);
      });
    } else {
      // Save current region before switching
      saveCurrentRegion(async () => {
        console.log('Switching from tree to hexagon view');
        await loadDefectTypes();
        await loadHexagonData();
        setShowHexagonView(true);
      });
    }
  };

  const handleBackToMapPress = () => {
    // Save current region before switching
    saveCurrentRegion(() => {
      console.log('Back to tree view - no recalculation needed');
      setShowHexagonView(false);
    });
  };

  const handleRefreshHexagons = async () => {
    // Recalculate hexagon data
    await loadHexagonData();
  };

  const handleDefectTypeChange = async (defectType: string | null) => {
    setSelectedDefectType(defectType);
    setShowDefectTypePicker(false);
    
    // Save current region before switching defect types
    saveCurrentRegion(async () => {
      console.log('Switching defect type to:', defectType || 'Любой дефект');
      // Small delay to allow legend to re-render and update height
      setTimeout(async () => {
        await loadHexagonData();
      }, 100);
    });
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

  // Calculate InitialRegion - use saved region if available, otherwise use default
  const initialRegion = currentRegion 
    ? {
        lat: currentRegion.lat,
        lon: currentRegion.lon,
        zoom: currentRegion.zoom,
        azimuth: currentRegion.azimuth,
        tilt: currentRegion.tilt
      }
    : { lat: 55.75598562797027, lon: 37.617383149475614, zoom: 10 };

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
            initialRegion={initialRegion}
            logoPosition={{ horizontal: 'left', vertical: 'bottom' }}
            logoPadding={{ horizontal: 16, vertical: 16 }}
            mapStyle={getMapStyle()}
            onMapLoaded={() => {
              console.log('Hexagon map loaded successfully');
            }}
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
            initialRegion={initialRegion}
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
                scale={0.7}
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
        <View style={[styles.legendContainer, { top: showHexagonView ? 16 + dropdownHeight + 8 : 16 }]}>
          {showHexagonView ? (
            <>
              <View style={styles.legendTitleContainer}>
                <Text style={styles.legendTitle}>
                  {selectedDefectType ? (
                    <>
                      Плотность деревьев с дефектом <Text style={styles.legendTitleItalic}>{selectedDefectType}</Text>
                    </>
                  ) : (
                    'Плотность дефектных деревьев'
                  )}
                </Text>
                <TouchableOpacity
                  style={styles.helpButton}
                  onPress={() => setShowHeatmapExplanation(true)}
                >
                  <HelpCircle size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <View style={styles.legendGradient}>
                {Array.from({ length: 50 }, (_, index) => {
                  // Sample 50 points in interval [0, 1]
                  const ratio = index / 49; // 0 to 1
                  
                  // Use getHexagonColor method to get the color
                  const rgbaColor = getHexagonColor(ratio);
                  
                  // Extract RGB values and ignore alpha channel
                  const rgbaMatch = rgbaColor.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
                  if (!rgbaMatch) {
                    // Fallback to a default color if parsing fails
                    return (
                      <View 
                        key={index}
                        style={[
                          styles.legendColor, 
                          { 
                            backgroundColor: '#22c55e',
                            borderWidth: 0,
                          }
                        ]} 
                      />
                    );
                  }
                  
                  const r = parseInt(rgbaMatch[1], 10);
                  const g = parseInt(rgbaMatch[2], 10);
                  const b = parseInt(rgbaMatch[3], 10);
                  
                  return (
                    <View 
                      key={index}
                      style={[
                        styles.legendColor, 
                        { 
                          backgroundColor: `rgb(${r}, ${g}, ${b})`,
                          borderWidth: 0, // Remove borders for smoother look
                        }
                      ]} 
                    />
                  );
                })}
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

        {/* Defect Type Picker - only shown in hexagon view */}
        {showHexagonView && (
          <View style={styles.defectTypeContainer}>
            <TouchableOpacity
              style={styles.defectTypePicker}
              onPress={() => setShowDefectTypePicker(true)}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                setDropdownHeight(height);
              }}
            >
              <Text style={styles.defectTypePickerText}>
                {selectedDefectType || 'Любой дефект'}
              </Text>
              <Text style={styles.defectTypePickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Defect Type Picker Modal */}
        {showDefectTypePicker && (
          <View style={styles.defectTypeModal}>
            <View style={styles.defectTypeModalContent}>
              <Text style={styles.defectTypeModalTitle}>Выберите тип дефекта</Text>
              <TouchableOpacity
                style={styles.defectTypeOption}
                onPress={() => handleDefectTypeChange(null)}
              >
                <Text style={styles.defectTypeOptionText}>Любой дефект</Text>
                {selectedDefectType === null && <Text style={styles.defectTypeCheckmark}>✓</Text>}
              </TouchableOpacity>
              {availableDefectTypes.map((defectType) => (
                <TouchableOpacity
                  key={defectType}
                  style={styles.defectTypeOption}
                  onPress={() => handleDefectTypeChange(defectType)}
                >
                  <Text style={styles.defectTypeOptionText}>{defectType}</Text>
                  {selectedDefectType === defectType && <Text style={styles.defectTypeCheckmark}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.defectTypeCancel}
                onPress={() => setShowDefectTypePicker(false)}
              >
                <Text style={styles.defectTypeCancelText}>Отмена</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Heatmap Explanation Modal */}
        {showHeatmapExplanation && (
          <View style={styles.defectTypeModal}>
            <View style={styles.defectTypeModalContent}>
              <Text style={styles.defectTypeModalTitle}>Как рассчитывается тепловая карта</Text>
              <View style={styles.explanationContent}>
                <Text style={styles.explanationText}>
                  <Text style={styles.explanationBold}>Метрика:</Text> Доля деревьев с дефектами в каждом гексагоне
                </Text>
                <Text style={styles.explanationText}>
                  <Text style={styles.explanationBold}>Расчет:</Text> Количество деревьев с дефектами ÷ Общее количество деревьев × 100%
                </Text>
                {selectedDefectType && (
                  <Text style={styles.explanationText}>
                    <Text style={styles.explanationBold}>Фильтр:</Text> Показываются только деревья с дефектом "{selectedDefectType}"
                  </Text>
                )}
                {!selectedDefectType && (
                  <Text style={styles.explanationText}>
                    <Text style={styles.explanationBold}>Фильтр:</Text> Показываются все деревья с любыми дефектами
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.defectTypeCancel}
                onPress={() => setShowHeatmapExplanation(false)}
              >
                <Text style={styles.defectTypeCancelText}>Понятно</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    width: 220, // Increased width for continuous gradient
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
  legendTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    textAlign: 'center',
  },
  legendTitleItalic: {
    fontStyle: 'italic',
  },
  helpButton: {
    marginLeft: 6,
    marginRight: 8,
    padding: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
  legendGradient: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  legendColor: {
    flex: 1,
    height: 16,
    borderWidth: 0, // Remove borders for continuous gradient
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
  defectTypeContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1000,
    width: 220, // Match the legend container width
  },
  defectTypePicker: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%', // Use full container width
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  defectTypePickerText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  defectTypePickerArrow: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  defectTypeModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  defectTypeModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '70%',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  defectTypeModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  defectTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  defectTypeOptionText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  defectTypeCheckmark: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  defectTypeCancel: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  defectTypeCancelText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  explanationContent: {
    marginBottom: 16,
  },
  explanationText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  explanationBold: {
    fontWeight: 'bold',
    color: '#111827',
  },
});
