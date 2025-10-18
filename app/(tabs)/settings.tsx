import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {
  Info,
  Trash2,
  Plus,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { treeDatabase } from '@/database/treeDatabase';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const [showRandomTreesModal, setShowRandomTreesModal] = useState(false);
  const [numberOfTrees, setNumberOfTrees] = useState('');

  const clearDatabase = async () => {
    Alert.alert(
      'Очистить все данные',
      'Вы уверены, что хотите удалить все записи о деревьях? Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить все',
          style: 'destructive',
          onPress: async () => {
            try {
              await treeDatabase.clearAllTrees();
              Alert.alert('Успешно', 'Все записи о деревьях были удалены');
              // Navigate back to main screen to refresh the list
              router.push('/(tabs)');
            } catch (error) {
              console.error('Clear database error:', error);
              Alert.alert('Ошибка', 'Не удалось очистить данные. Попробуйте снова.');
            }
          },
        },
      ]
    );
  };


  const showAppInfo = () => {
    Alert.alert(
      'Управление городскими деревьями',
      'Версия 1.0.0\n\nМобильное приложение для персонала по уходу за городскими деревьями для документирования и управления записями о городских деревьях.\n\nРазработано для полевых работ с возможностью работы в автономном режиме.',
      [{ text: 'ОК' }]
    );
  };

  const createRandomTrees = async () => {
    const numTrees = parseInt(numberOfTrees);
    
    if (isNaN(numTrees) || numTrees <= 0) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректное количество деревьев');
      return;
    }


    try {
      const createdTrees = [];
      
      // Load assets and get their URIs
      const assets = await Asset.loadAsync([
        require('@/assets/images/dummy_trees/full/1.png'),
        require('@/assets/images/dummy_trees/full/2.png'),
        require('@/assets/images/dummy_trees/crop/1.png'),
        require('@/assets/images/dummy_trees/crop/2.png'),
        require('@/assets/images/dummy_trees/defects/crack.png'),
        require('@/assets/images/dummy_trees/defects/hollow.png'),
      ]);
      
      const [asset1Full, asset2Full, asset1Crop, asset2Crop, crackDefect, hollowDefect] = assets;
      
      // Copy assets to document directory
      const timestamp = Date.now();
      const asset1FullPath = `${FileSystem.documentDirectory}dummy_tree_1_full_${timestamp}.png`;
      const asset2FullPath = `${FileSystem.documentDirectory}dummy_tree_2_full_${timestamp}.png`;
      const asset1CropPath = `${FileSystem.documentDirectory}dummy_tree_1_crop_${timestamp}.png`;
      const asset2CropPath = `${FileSystem.documentDirectory}dummy_tree_2_crop_${timestamp}.png`;
      const crackDefectPath = `${FileSystem.documentDirectory}crack_defect_${timestamp}.png`;
      const hollowDefectPath = `${FileSystem.documentDirectory}hollow_defect_${timestamp}.png`;
      
      await FileSystem.copyAsync({
        from: asset1Full.localUri!,
        to: asset1FullPath,
      });
      await FileSystem.copyAsync({
        from: asset2Full.localUri!,
        to: asset2FullPath,
      });
      await FileSystem.copyAsync({
        from: asset1Crop.localUri!,
        to: asset1CropPath,
      });
      await FileSystem.copyAsync({
        from: asset2Crop.localUri!,
        to: asset2CropPath,
      });
      await FileSystem.copyAsync({
        from: crackDefect.localUri!,
        to: crackDefectPath,
      });
      await FileSystem.copyAsync({
        from: hollowDefect.localUri!,
        to: hollowDefectPath,
      });
      
      // Define high-density defect areas around Moscow (squares with higher defect probability)
      const highDensityAreas = [
        { lat: 55.75, lon: 37.6, size: 0.02 },   // Red Square area
        { lat: 55.76, lon: 37.65, size: 0.015 }, // Arbat area
        { lat: 55.74, lon: 37.58, size: 0.018 }, // Zamoskvorechye area
        { lat: 55.77, lon: 37.62, size: 0.012 }, // Tverskaya area
      ];
      
      for (let i = 0; i < numTrees; i++) {
        // Random number 1 or 2
        const randomNum = Math.random() < 0.5 ? 1 : 2;
        
        // Calculate relative bounding box values
        // Original: x=173, y=47, width=685, height=939, image=1024x1024
        const relativeX = 173 / 1024;
        const relativeY = 47 / 1024;
        const relativeWidth = 685 / 1024;
        const relativeHeight = 939 / 1024;
        
        // Random coordinates around Moscow area
        const latitude = 55.7558 + (Math.random() - 0.5) * 0.1; // ±0.05 degrees
        const longitude = 37.6176 + (Math.random() - 0.5) * 0.1; // ±0.05 degrees
        
        // Check if tree is in high-density area
        const isInHighDensityArea = highDensityAreas.some(area => 
          Math.abs(latitude - area.lat) < area.size && 
          Math.abs(longitude - area.lon) < area.size
        );
        
        // Determine defect probability based on location
        const baseDefectProbability = 0.3; // 30% chance of having defects
        const highDensityMultiplier = 0.8; // 80% chance in high-density areas
        const defectProbability = isInHighDensityArea ? highDensityMultiplier : baseDefectProbability;
        
        const tree = {
          imageUri: randomNum === 1 ? asset1FullPath : asset2FullPath,
          boundingBox: {
            x: relativeX,
            y: relativeY,
            width: relativeWidth,
            height: relativeHeight,
          },
          dateTaken: new Date().toISOString(),
          description: 'random tree description',
          additionalImages: [],
          cropPath: randomNum === 1 ? asset1CropPath : asset2CropPath,
          taxonName: 'some taxon',
          latitude: latitude,
          longitude: longitude,
        };
        
        const treeId = await treeDatabase.insertTree(tree);
        createdTrees.push(treeId);
        
        // Generate defects for this tree
        if (Math.random() < defectProbability) {
          // Random number of defects (0-3, but weighted towards fewer defects)
          const numDefects = Math.random() < 0.5 ? 1 : 
                           Math.random() < 0.7 ? 2 : 
                           Math.random() < 0.9 ? 3 : 0;
          
          for (let j = 0; j < numDefects; j++) {
            // Random defect type
            const defectType = Math.random() < 0.5 ? 'Трещина' : 'Дупло';
            const defectImagePath = defectType === 'Трещина' ? crackDefectPath : hollowDefectPath;
            
            // Random defect position within the tree crop (relative coordinates)
            const defectX = Math.random() * 0.6 + 0.2; // 0.2 to 0.8
            const defectY = Math.random() * 0.6 + 0.2; // 0.2 to 0.8
            const defectSize = 0.1 + Math.random() * 0.1; // 0.1 to 0.2
            
            const defect = {
              tree_id: treeId,
              xtl: defectX,
              ytl: defectY,
              xbr: defectX + defectSize,
              ybr: defectY + defectSize,
              image_path: defectImagePath,
              crop_path: defectImagePath,
              defect_type: defectType,
            };
            
            await treeDatabase.insertDefect(defect);
          }
        }
      }
      
      setShowRandomTreesModal(false);
      setNumberOfTrees('');
      Alert.alert(
        'Успешно', 
        `Создано ${createdTrees.length} случайных деревьев`
      );
      
      // Navigate back to main screen to refresh the list
      router.push('/(tabs)');
      
    } catch (error) {
      console.error('Create random trees error:', error);
      Alert.alert('Ошибка', 'Не удалось создать случайные деревья. Попробуйте снова.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.subtitle}>Управление настройками приложения</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Управление данными</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={() => setShowRandomTreesModal(true)}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#22c55e' }]}>
                <Plus size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>Создать случайные деревья</Text>
                <Text style={styles.settingItemSubtitle}>
                  Добавить тестовые деревья в базу данных
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
                <Text style={styles.settingItemTitle}>Очистить все данные</Text>
                <Text style={styles.settingItemSubtitle}>
                  Удалить все записи о деревьях навсегда
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Приложение</Text>
          
          <TouchableOpacity style={styles.settingItem} onPress={showAppInfo}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#8b5cf6' }]}>
                <Info size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.settingItemTitle}>О программе</Text>
                <Text style={styles.settingItemSubtitle}>
                  Версия приложения и информация
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

      </View>

      {/* Random Trees Modal */}
      <Modal
        visible={showRandomTreesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRandomTreesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Создать случайные деревья</Text>
            <Text style={styles.modalSubtitle}>
              Введите количество деревьев для создания
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Количество деревьев"
              value={numberOfTrees}
              onChangeText={setNumberOfTrees}
              keyboardType="numeric"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRandomTreesModal(false);
                  setNumberOfTrees('');
                }}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={createRandomTrees}
              >
                <Text style={styles.createButtonText}>Создать</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#ffffff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  createButton: {
    backgroundColor: '#22c55e',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});