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
  Info,
  Trash2,
} from 'lucide-react-native';
import { treeDatabase } from '@/database/treeDatabase';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройки</Text>
        <Text style={styles.subtitle}>Управление настройками приложения</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Управление данными</Text>
          
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
});