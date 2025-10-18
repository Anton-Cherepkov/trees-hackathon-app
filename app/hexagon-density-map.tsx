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
import { useRouter } from 'expo-router';
import { Yamap, Polygon } from 'react-native-yamap-plus';
import { processHexagonData, HexagonData, getHexagonBoundary } from '@/utils/hexagonUtils';
import { X, Grid3x3 } from 'lucide-react-native';

export default function HexagonDensityMapScreen() {
  const [hexagonData, setHexagonData] = useState<HexagonData[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadHexagonData();
  }, []);

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

  const handleClose = () => {
    router.back();
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Grid3x3 size={64} color="#9ca3af" />
      <Text style={styles.emptyTitle}>Нет данных для анализа</Text>
      <Text style={styles.emptyDescription}>
        Недостаточно деревьев с GPS координатами и анализом ИИ для построения карты плотности
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.title}>Карта плотности дефектов</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Анализ данных...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hexagonData.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.title}>Карта плотности дефектов</Text>
          </View>
        </View>
        <EmptyState />
      </SafeAreaView>
    );
  }

  // Calculate map region based on hexagon centers
  const hexagonCenters = hexagonData.map(hex => {
    const boundary = getHexagonBoundary(hex.hexagonId);
    if (boundary.length === 0) return null;
    
    // Calculate center of hexagon
    const avgLat = boundary.reduce((sum, coord) => sum + coord.lat, 0) / boundary.length;
    const avgLon = boundary.reduce((sum, coord) => sum + coord.lon, 0) / boundary.length;
    
    return { lat: avgLat, lon: avgLon };
  }).filter(Boolean) as { lat: number; lon: number }[];

  // Calculate map region from coordinates
  const mapRegion = (() => {
    if (hexagonCenters.length === 0) {
      return { lat: 55.7558, lon: 37.6176, zoom: 10 };
    }
    
    if (hexagonCenters.length === 1) {
      return { lat: hexagonCenters[0].lat, lon: hexagonCenters[0].lon, zoom: 16 };
    }
    
    // Calculate bounds for multiple points
    const lats = hexagonCenters.map(center => center.lat);
    const lons = hexagonCenters.map(center => center.lon);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    
    // Calculate zoom based on bounds
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
  })();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>Карта плотности дефектов</Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <Yamap
          ref={mapRef}
          style={styles.map}
          initialRegion={mapRegion}
          logoPosition={{ horizontal: 'left', vertical: 'bottom' }}
          logoPadding={{ horizontal: 16, vertical: 16 }}
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

        {/* Color Legend */}
        <View style={styles.legendContainer}>
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  legendContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
    minWidth: 140,
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
