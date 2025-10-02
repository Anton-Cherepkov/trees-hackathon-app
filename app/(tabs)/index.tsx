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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { treeDatabase, TreeRecord, DefectRecord } from '@/database/treeDatabase';
import { TreePine, FileText } from 'lucide-react-native';
import { logONNXStatus } from '@/utils/onnxSetup';
import * as ort from 'onnxruntime-react-native';
import { Asset } from 'expo-asset';
import {
  generatePDF,
  type PDFOptions,
  type PDFResult,
} from 'react-native-html-to-pdf';

let yoloModel: ort.InferenceSession;

// Export the model for use in other components
export { yoloModel };

// Type for tree with defects
type TreeWithDefects = TreeRecord & { defects: DefectRecord[] };

export default function TreeListScreen() {
  const [trees, setTrees] = useState<TreeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedTrees, setSelectedTrees] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    initializeDatabase();
    // Test ONNX Runtime availability
    logONNXStatus();
    // Load YOLO model
    loadYOLOModel();
  }, []);

  const loadYOLOModel = async () => {
    setModelLoading(true);
    try {
      const assets = await Asset.loadAsync(require('@/assets/best-yolov11s-tune-no-freeze-no-single-cls.onnx'));
      const modelUri = assets[0].localUri;
      if (!modelUri) {
        Alert.alert('Не удалось получить URI модели', `${assets[0]}`);
        return;
      }
      
      // ONNX Runtime for React Native requires absolute file path
      // Convert to file:// scheme if needed
      const modelPath = modelUri.startsWith('file://') ? modelUri : `file://${modelUri}`;
      
      yoloModel = await ort.InferenceSession.create(modelPath);
      setModelLoaded(true);
      console.log('YOLO model loaded successfully');
      console.log('Input names:', yoloModel.inputNames);
      console.log('Output names:', yoloModel.outputNames);
    } catch (error) {
      console.error('Failed to load YOLO model:', error);
      Alert.alert('Не удалось загрузить модель', `Ошибка: ${error}`);
    } finally {
      setModelLoading(false);
    }
  };

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
      Alert.alert('Ошибка', 'Не удалось инициализировать базу данных. Перезапустите приложение.');
      setLoading(false);
    }
  };

  const loadTrees = async () => {
    try {
      const allTrees = await treeDatabase.getAllTrees();
      setTrees(allTrees);
      // Clear selection state when loading trees to prevent stale selections
      setSelectedTrees(new Set());
      setIsSelectionMode(false);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить деревья');
      console.error('Load trees error:', error);
    } finally {
      setLoading(false);
    }
  };


  const toggleTreeSelection = useCallback((treeId: number) => {
    setSelectedTrees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(treeId)) {
        newSet.delete(treeId);
      } else {
        newSet.add(treeId);
      }
      return newSet;
    });
  }, []);

  const deselectAllTrees = useCallback(() => {
    setSelectedTrees(new Set());
    setIsSelectionMode(false);
  }, []);

  // Update selection mode when selected trees change
  useEffect(() => {
    if (selectedTrees.size > 0) {
      setIsSelectionMode(true);
    } else {
      setIsSelectionMode(false);
    }
  }, [selectedTrees]);

  const generateTreesPDF = useCallback(async () => {
    const treesToExport = selectedTrees.size > 0 
      ? trees.filter(tree => tree.id && selectedTrees.has(tree.id))
      : trees;

    if (treesToExport.length === 0) {
      Alert.alert('Нет данных', 'Выберите деревья для экспорта в PDF');
      return;
    }

    setIsGeneratingPDF(true);

    // Fetch defects for all trees to export
    const treesWithDefects = await Promise.all(
      treesToExport.map(async (tree) => {
        if (!tree.id) return { ...tree, defects: [] };
        
        try {
          const defects = await treeDatabase.getDefectsByTreeId(tree.id);
          return { ...tree, defects };
        } catch (error) {
          console.error(`Error fetching defects for tree ${tree.id}:`, error);
          return { ...tree, defects: [] };
        }
      })
    );

    // Generate HTML content for the PDF
    const htmlContent = `
<html>
<head>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 20px; 
      line-height: 1.6;
    }
    h1 { 
      color: #22c55e; 
      text-align: center; 
      border-bottom: 3px solid #22c55e;
      padding-bottom: 10px;
    }
    h2 { 
      color: #374151; 
      border-bottom: 2px solid #e5e7eb; 
      padding-bottom: 5px;
      margin-top: 30px;
    }
    .summary { 
      background-color: #f0f9ff; 
      border: 1px solid #0ea5e9; 
      padding: 15px; 
      border-radius: 8px; 
      margin: 20px 0; 
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 20px 0;
      font-size: 12px;
    }
    th, td { 
      border: 1px solid #ddd; 
      padding: 8px; 
      text-align: left; 
      vertical-align: top;
    }
    th { 
      background-color: #f2f2f2; 
      font-weight: bold;
    }
    .date-col { width: 10%; }
    .taxon-col { width: 15%; }
    .photos-col { width: 30%; }
    .description-col { width: 15%; }
    .defects-col { width: 30%; }
    .photo-container {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .photo-item {
      text-align: center;
      margin-bottom: 5px;
    }
    .photo-item img {
      max-width: 100px;
      max-height: 100px;
      object-fit: cover;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .defect-container {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .defect-item {
      text-align: center;
      margin-bottom: 5px;
    }
    .defect-item img {
      max-width: 80px;
      max-height: 80px;
      object-fit: cover;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .defect-type {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <h1>🌳 Отчет по городским деревьям</h1>
  
  <div class="summary">
    <h2>📊 Общая информация</h2>
    <p>Дата создания отчета: ${new Date().toLocaleDateString('ru-RU')}</p>
    <p>Количество экспортированных деревьев: ${treesWithDefects.length}</p>
    <p>Режим: Выборочный экспорт</p>
  </div>

  <h2>🌲 Детальная таблица деревьев</h2>
  <table>
    <thead>
      <tr>
        <th class="date-col">Дата</th>
        <th class="taxon-col">Таксон</th>
        <th class="photos-col">Фотографии</th>
        <th class="description-col">Описание</th>
        <th class="defects-col">Дефекты</th>
      </tr>
    </thead>
    <tbody>
      ${treesWithDefects.map((tree, index) => `
        <tr>
          <td class="date-col">${new Date(tree.dateTaken).toLocaleDateString('ru-RU')}</td>
          <td class="taxon-col">${tree.taxonName || 'Не определен'}</td>
          <td class="photos-col">
            <div class="photo-container">
              <div class="photo-item">
                <strong>Основное фото:</strong><br>
                <img src="${tree.cropPath || tree.imageUri}" alt="Основное фото" />
              </div>
              ${tree.additionalImages.map((img, imgIndex) => `
                <div class="photo-item">
                  <strong>Доп. фото ${imgIndex + 1}:</strong><br>
                  <img src="${img}" alt="Дополнительное фото ${imgIndex + 1}" />
                </div>
              `).join('')}
            </div>
          </td>
          <td class="description-col">${tree.description || 'Описание не сгенерировано'}</td>
          <td class="defects-col">
            <div class="defect-container">
              ${tree.defects && tree.defects.length > 0 ? tree.defects.map((defect, defectIndex) => `
                <div class="defect-item">
                  <strong>Дефект ${defectIndex + 1}:</strong><br>
                  <img src="${defect.crop_path}" alt="Дефект ${defectIndex + 1}" />
                  <div class="defect-type">${defect.defect_type}</div>
                </div>
              `).join('') : `
                <div class="defect-item">
                  <strong>Дефекты не обнаружены</strong><br>
                  <span class="defect-type">Нет данных о дефектах</span>
                </div>
              `}
            </div>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div style="text-align: center; margin-top: 40px; padding: 20px; background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px;">
    <h3>✅ Отчет успешно сгенерирован!</h3>
    <p>Создано с помощью приложения "Городские деревья"</p>
  </div>
</body>
</html>
    `;

    const options: PDFOptions = {
      html: htmlContent,
      fileName: `Trees_Report_${new Date().toISOString().split('T')[0]}`,
      base64: false,
      width: 612,
      height: 792,
      padding: 24,
      bgColor: '#FFFFFF',
    };

    try {
      const result: PDFResult = await generatePDF(options);
      console.log('PDF Generated:', result);
      
      // Deselect all trees and exit selection mode after successful PDF creation
      setSelectedTrees(new Set());
      setIsSelectionMode(false);
      
      Alert.alert(
        '✅ PDF успешно создан!',
        `Файл: ${result.filePath}\nСтраниц: ${result.numberOfPages}`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      console.error('PDF Generation Error:', error);
      Alert.alert(
        '❌ Ошибка создания PDF',
        `Ошибка: ${error instanceof Error ? error.message : String(error)}`,
        [{ text: 'OK', style: 'destructive' }]
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [trees, selectedTrees]);

  const renderTreeItem = ({ item }: { item: TreeRecord }) => {
    const isSelected = item.id ? selectedTrees.has(item.id) : false;
    
    return (
      <View style={[
        styles.treeCard,
        isSelected && styles.treeCardSelected
      ]}>
        <TouchableOpacity
          style={styles.selectionCheckbox}
          onPress={() => {
            if (item.id) {
              toggleTreeSelection(item.id);
            }
          }}
        >
          <View style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected
          ]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.treeCardContent}
          onPress={() => {
            if (isSelectionMode) {
              // In selection mode, tap anywhere to select/deselect
              if (item.id) {
                toggleTreeSelection(item.id);
              }
            } else {
              // Not in selection mode, navigate to details
              router.push(`/tree-detail/${item.id}`);
            }
          }}
        >
          <Image 
            source={{ uri: item.cropPath || item.imageUri }} 
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
            {item.taxonName && (
              <Text style={styles.treeTaxon} numberOfLines={2}>
                Таксон: {item.taxonName}
              </Text>
            )}
            <Text style={styles.additionalCount}>
              {item.additionalImages.length} дополнительных фото
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <TreePine size={64} color="#9ca3af" />
      <Text style={styles.emptyTitle}>Пока нет деревьев</Text>
      <Text style={styles.emptyDescription}>
        Начните с фотографирования деревьев, используя вкладку камеры
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Загрузка деревьев...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Городские деревья</Text>
            <Text style={styles.subtitle}>
              {isSelectionMode 
                ? `Выбрано деревьев: ${selectedTrees.size} из ${trees.length}`
                : `Деревьев в базе: ${trees.length}`
              }
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[
                styles.pdfButton, 
                isGeneratingPDF && styles.pdfButtonDisabled,
                selectedTrees.size === 0 && styles.pdfButtonDisabled
              ]}
              onPress={generateTreesPDF}
              disabled={isGeneratingPDF || trees.length === 0 || selectedTrees.size === 0}
            >
              {isGeneratingPDF ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <FileText size={20} color="#ffffff" />
              )}
              <Text style={styles.pdfButtonText}>
                {isGeneratingPDF ? 'Создание...' : 'Экспорт'}
              </Text>
            </TouchableOpacity>
            {isSelectionMode && (
              <TouchableOpacity
                style={styles.deselectButton}
                onPress={deselectAllTrees}
              >
                <Text style={styles.deselectButtonText}>Отменить все</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  deselectButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: 'transparent',
  },
  deselectButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pdfButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  pdfButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
    position: 'relative',
  },
  treeCardContent: {
    flex: 1,
  },
  treeCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  selectionCheckbox: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#22c55e',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  treeImage: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    backgroundColor: '#f9fafb',
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
  treeTaxon: {
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