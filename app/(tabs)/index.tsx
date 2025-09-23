import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { treeDatabase, TreeRecord } from '@/database/treeDatabase';
import { TreePine } from 'lucide-react-native';

export default function TreeListScreen() {
  const [trees, setTrees] = useState<TreeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    initializeDatabase();
  }, []);

  // Refresh data when screen comes into focus (e.g., after clearing data)
  useFocusEffect(
    useCallback(() => {
      loadTrees();
    }, [])
  );

  const initializeDatabase = async () => {
    try {
      await treeDatabase.init();
      await loadTrees();
    } catch (error) {
      console.error('Database initialization error:', error);
      Alert.alert('Error', 'Failed to initialize database. Please restart the app.');
      setLoading(false);
    }
  };

  const loadTrees = async () => {
    try {
      const allTrees = await treeDatabase.getAllTrees();
      setTrees(allTrees);
    } catch (error) {
      Alert.alert('Error', 'Failed to load trees');
      console.error('Load trees error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTreeItem = ({ item }: { item: TreeRecord }) => (
    <TouchableOpacity
      style={styles.treeCard}
      onPress={() => router.push(`/tree-detail/${item.id}`)}
    >
      <Image 
        source={{ uri: item.imageUri }} 
        style={styles.treeImage}
        onError={(error) => {
          console.log('Image load error in tree list:', error);
        }}
        onLoad={() => {
          console.log('Image loaded successfully in tree list');
        }}
      />
      <View style={styles.treeInfo}>
        <Text style={styles.treeDate}>
          {new Date(item.dateTaken).toLocaleDateString()}
        </Text>
        <Text style={styles.treeDescription} numberOfLines={2}>
          {item.description || 'No description'}
        </Text>
        <Text style={styles.additionalCount}>
          {item.additionalImages.length} additional photos
        </Text>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <TreePine size={64} color="#9ca3af" />
      <Text style={styles.emptyTitle}>No Trees Yet</Text>
      <Text style={styles.emptyDescription}>
        Start by capturing trees using the camera tab
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading trees...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Urban Trees</Text>
        <Text style={styles.subtitle}>{trees.length} trees recorded</Text>
      </View>

      <FlatList
        data={trees}
        renderItem={renderTreeItem}
        keyExtractor={(item) => item.id?.toString() || ''}
        contentContainerStyle={[
          styles.listContainer,
          trees.length === 0 && styles.emptyContainer,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={EmptyState}
        onRefresh={loadTrees}
        refreshing={loading}
      />

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
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  treeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  treeImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  treeInfo: {
    padding: 16,
  },
  treeDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 8,
  },
  treeDescription: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 22,
  },
  additionalCount: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
});