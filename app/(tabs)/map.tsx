import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Yamap, Marker } from 'react-native-yamap-plus';
import { getTreesForMap, calculateMapRegion, TreeWithMarkerInfo } from '@/utils/mapUtils';
import { TreePine } from 'lucide-react-native';

export default function MapScreen() {
  const [trees, setTrees] = useState<TreeWithMarkerInfo[]>([]);
  const [loading, setLoading] = useState(true);
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

  const handleMarkerPress = (treeId: number) => {
    router.push(`/tree-detail/${treeId}`);
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

  const mapRegion = calculateMapRegion(trees);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Карта деревьев</Text>
        <Text style={styles.subtitle}>
          {trees.length} {trees.length === 1 ? 'дерево' : trees.length < 5 ? 'дерева' : 'деревьев'} на карте
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <Yamap
          style={styles.map}
          initialRegion={mapRegion}
          onMapLoaded={() => {
            console.log('Map loaded successfully');
          }}
        >
          {trees.map((tree) => (
            <Marker
              key={tree.id}
              point={{
                lat: tree.latitude!,
                lon: tree.longitude!,
              }}
              source={tree.markerIcon}
              scale={1.0}
              onPress={() => {
                if (tree.id) {
                  handleMarkerPress(tree.id);
                }
              }}
            />
          ))}
        </Yamap>
        
        {/* Legend - positioned over the map */}
        <View style={styles.legendContainer}>
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
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
