import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Yamap } from 'react-native-yamap-plus';
import { MapPin, Navigation, ArrowLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import { treeDatabase, TreeRecord } from '@/database/treeDatabase';
import { getMapStyle } from '@/utils/mapUtils';

export default function EditLocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tree, setTree] = useState<TreeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (id) {
      loadTreeData();
    }
  }, [id]);

  const loadTreeData = async () => {
    try {
      setLoading(true);
      
      // Ensure database is initialized
      await treeDatabase.init();
      
      const treeData = await treeDatabase.getTreeById(parseInt(id!));
      if (treeData) {
        setTree(treeData);
      } else {
        Alert.alert('Ошибка', 'Дерево не найдено');
        router.back();
      }
    } catch (error) {
      console.error('Load tree error:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить данные о дереве');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getInitialMapRegion = () => {
    // Priority: tree location → user GPS → Moscow default
    if (tree?.latitude && tree?.longitude) {
      return {
        lat: tree.latitude,
        lon: tree.longitude,
        zoom: 15,
      };
    }
    
    // Default to Moscow center
    return {
      lat: 55.7558,
      lon: 37.6176,
      zoom: 15,
    };
  };

  const handleGpsPress = async () => {
    try {
      setGpsLoading(true);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;
      
      // Center map on current location
      if (mapRef.current) {
        console.log('Setting map center to GPS location:', latitude, longitude);
        mapRef.current.setCenter({ lat: latitude, lon: longitude }, 16);
        
        // Verify the center was set correctly
        setTimeout(() => {
          mapRef.current?.getCameraPosition((position: any) => {
            console.log('Map center after GPS button:', position.point.lat, position.point.lon);
          });
        }, 500);
      }
      
    } catch (error) {
      console.log('GPS location not available:', error instanceof Error ? error.message : 'Unknown error');
      // Silently handle GPS unavailability - don't show error to user
    } finally {
      setGpsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tree || !mapRef.current) return;

    try {
      setSaving(true);
      
      // Get current map center coordinates using getCameraPosition
      mapRef.current.getCameraPosition((position: any) => {
        console.log('Saving location:', position.point.lat, position.point.lon);
        
        // Update tree in database
        treeDatabase.updateTree(tree.id!, {
          latitude: position.point.lat,
          longitude: position.point.lon,
        }).then(() => {
          console.log('Location saved successfully');
          // Show success message
          Alert.alert(
            'Успешно',
            'Местоположение дерева сохранено',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]
          );
        }).catch((error) => {
          console.error('Save location error:', error);
          Alert.alert('Ошибка', 'Не удалось сохранить местоположение');
        }).finally(() => {
          setSaving(false);
        });
      });
      
    } catch (error) {
      console.error('Save location error:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить местоположение');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tree) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Дерево не найдено</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initialRegion = getInitialMapRegion();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {tree.latitude && tree.longitude ? 'Изменить местоположение' : 'Добавить местоположение'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        <Yamap
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          logoPosition={{ horizontal: 'left', vertical: 'bottom' }}
          logoPadding={{ horizontal: 16, vertical: 16 }}
          mapStyle={getMapStyle()}
          onMapLoaded={() => {
            console.log('Location editor map loaded successfully');
          }}
        />
        
        {/* Centered Pin Marker */}
        <View style={styles.pinContainer}>
          <MapPin size={32} color="#ef4444" />
        </View>
        
        {/* Save Button - positioned over the map */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Сохранить</Text>
          )}
        </TouchableOpacity>
        
        {/* GPS Button */}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32, // Same width as back button to center title
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  pinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16, // Half of icon size
    marginLeft: -16, // Half of icon size
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
  saveButton: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 88, // 16 (right margin) + 56 (GPS button width) + 16 (margin between buttons)
    height: 56,
    backgroundColor: '#22c55e',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});
