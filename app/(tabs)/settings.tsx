import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import {
  Database,
  Info,
  Trash2,
  Download,
  Upload,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import { treeDatabase } from '@/database/treeDatabase';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();

  const clearDatabase = async () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all tree records? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await treeDatabase.clearAllTrees();
              Alert.alert('Success', 'All tree records have been deleted');
              // Navigate back to main screen to refresh the list
              router.push('/(tabs)/');
            } catch (error) {
              console.error('Clear database error:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const exportData = () => {
    Alert.alert('Coming Soon', 'Data export functionality will be available in a future update.');
  };

  const importData = () => {
    Alert.alert('Coming Soon', 'Data import functionality will be available in a future update.');
  };

  const showAppInfo = () => {
    Alert.alert(
      'Urban Tree Management',
      'Version 1.0.0\n\nA mobile application for city tree care personnel to document and manage urban tree records.\n\nDeveloped for field work with offline capability.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your app preferences</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={exportData}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#3b82f6' }]}>
                <Download size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Export Data</Text>
                <Text style={styles.settingItemSubtitle}>
                  Export all tree records to a file
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={importData}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#10b981' }]}>
                <Upload size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Import Data</Text>
                <Text style={styles.settingItemSubtitle}>
                  Import tree records from a file
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={clearDatabase}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#ef4444' }]}>
                <Trash2 size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Clear All Data</Text>
                <Text style={styles.settingItemSubtitle}>
                  Delete all tree records permanently
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={showAppInfo}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#8b5cf6' }]}>
                <Info size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>About</Text>
                <Text style={styles.settingItemSubtitle}>
                  App version and information
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Database size={48} color="#9ca3af" />
          <Text style={styles.infoTitle}>Local Storage</Text>
          <Text style={styles.infoDescription}>
            All data is stored locally on your device. No internet connection required for basic functionality.
          </Text>
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
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 16,
  },
  settingItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  settingItemSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});