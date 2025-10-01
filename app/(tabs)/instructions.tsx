import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Camera, Image as ImageIcon, Wand2, FileText, TreePine, CheckCircle, AlertCircle } from 'lucide-react-native';

export default function InstructionsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Инструкция по использованию</Text>
        <Text style={styles.subtitle}>
          Полное руководство по работе с приложением "Городские деревья"
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Добавление новых деревьев */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Camera size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>1. Процесс добавления новых деревьев</Text>
          </View>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Съёмка или выбор фотографии</Text>
              <Text style={styles.stepDescription}>
                • Нажмите на красную кнопку "Сфотографировать" для съёмки через камеру{'\n'}
                • Или выберите "Выбрать из галереи" для загрузки существующего фото{'\n'}
                • Рекомендуется делать фото в хорошем освещении с чёткой видимостью деревьев
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Автоматическое обнаружение деревьев</Text>
              <Text style={styles.stepDescription}>
                • Приложение автоматически анализирует изображение с помощью ИИ{'\n'}
                • YOLO-модель находит деревья с уверенностью более 50%{'\n'}
                • На экране появятся красные рамки вокруг обнаруженных деревьев
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Выбор деревьев для сохранения</Text>
              <Text style={styles.stepDescription}>
                • Нажмите на зелёные галочки рядом с нужными деревьями{'\n'}
                • Выбранные деревья будут выделены зелёным цветом{'\n'}
                • Нажмите "Сохранить выбранные" для добавления в базу данных
              </Text>
            </View>
          </View>

          <View style={styles.tipBox}>
            <AlertCircle size={20} color="#3b82f6" />
            <Text style={styles.tipText}>
              <Text style={styles.tipTitle}>Совет:</Text> Для лучшего качества обнаружения делайте фото при хорошем освещении, избегайте сильных теней и размытых изображений.
            </Text>
          </View>
        </View>

        {/* 2. Загрузка дополнительных фотографий */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ImageIcon size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>2. Процесс загрузки дополнительных фотографий</Text>
          </View>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Открытие детальной страницы дерева</Text>
              <Text style={styles.stepDescription}>
                • Перейдите на вкладку "Деревья" в нижнем меню{'\n'}
                • Нажмите на любое сохранённое дерево для открытия детальной страницы
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Добавление дополнительных фото</Text>
              <Text style={styles.stepDescription}>
                • Нажмите кнопку "📷" рядом с разделом "Дополнительные фотографии"{'\n'}
                • Выберите "Сфотографировать" или "Выбрать из галереи"{'\n'}
                • Фото автоматически сохранится и появится в списке
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Управление фотографиями</Text>
              <Text style={styles.stepDescription}>
                • Для удаления фото нажмите на кнопку "🗑️" рядом с изображением{'\n'}
                • Для увеличения фото нажмите на само изображение{'\n'}
                • Дополнительные фото используются для более точного анализа дефектов
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Запуск ИИ анализа */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Wand2 size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>3. Как запустить ИИ-анализ</Text>
          </View>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Открытие детальной страницы дерева</Text>
              <Text style={styles.stepDescription}>
                • Перейдите на вкладку "Деревья"{'\n'}
                • Выберите дерево для анализа из списка
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Запуск классификации и анализа дефектов</Text>
              <Text style={styles.stepDescription}>
                • Нажмите кнопку "🪄 Сгенерировать описание" в разделе "Описание дерева"{'\n'}
                • Приложение автоматически выполнит следующие действия:{'\n'}
                • Классификация вида дерева с помощью ИИ{'\n'}
                • Анализ дефектов на основном и дополнительных фото{'\n'}
                • Генерация подробного описания на основе результатов
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Просмотр результатов анализа</Text>
              <Text style={styles.stepDescription}>
                • В разделе "Описание" появится сгенерированное описание дерева{'\n'}
                • В разделе "Дефекты" отобразятся обнаруженные проблемы с фотографиями{'\n'}
                • Каждый дефект содержит тип проблемы и обрезанное изображение
              </Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <AlertCircle size={20} color="#ef4444" />
            <Text style={styles.warningText}>
              <Text style={styles.warningTitle}>Важно:</Text> Процесс ИИ-анализа может занять несколько минут. Убедитесь, что у вас стабильное интернет-соединение.
            </Text>
          </View>
        </View>

        {/* 4. Экспорт данных */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>4. Как экспортировать данные</Text>
          </View>
          
          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Выбор деревьев для экспорта</Text>
              <Text style={styles.stepDescription}>
                • Перейдите на вкладку "Деревья"{'\n'}
                • Нажмите на зелёные галочки рядом с нужными деревьями{'\n'}
                • Выбранные деревья будут выделены зелёным цветом
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Создание PDF-отчёта</Text>
              <Text style={styles.stepDescription}>
                • Нажмите красную кнопку "Экспорт" в правом верхнем углу{'\n'}
                • Приложение создаст подробный PDF-отчёт со всеми данными{'\n'}
                • В отчёте будут включены: фотографии, описания, дефекты, даты
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Сохранение и использование отчёта</Text>
              <Text style={styles.stepDescription}>
                • PDF-файл автоматически сохранится на устройстве{'\n'}
                • Путь к файлу будет показан в уведомлении{'\n'}
                • Файл можно найти в папке документов устройства{'\n'}
                • Отчёт можно отправить по email или сохранить в облаке
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <CheckCircle size={20} color="#22c55e" />
            <Text style={styles.infoText}>
              <Text style={styles.infoTitle}>Информация:</Text> PDF-отчёт содержит профессионально оформленную таблицу с фотографиями, описаниями деревьев, обнаруженными дефектами и датами съёмки.
            </Text>
          </View>
        </View>

        {/* Дополнительная информация */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TreePine size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>Дополнительная информация</Text>
          </View>
          
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• Все данные сохраняются локально в базе данных SQLite</Text>
            <Text style={styles.infoItem}>• ИИ-модели работают на устройстве для обеспечения конфиденциальности</Text>
            <Text style={styles.infoItem}>• Приложение поддерживает работу без интернета для базовых функций</Text>
            <Text style={styles.infoItem}>• Для ИИ-анализа требуется подключение к интернету</Text>
            <Text style={styles.infoItem}>• Все фотографии оптимизируются для экономии места</Text>
          </View>
        </View>
      </ScrollView>
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
    lineHeight: 24,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  tipText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  tipTitle: {
    fontWeight: 'bold',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#dc2626',
    lineHeight: 20,
  },
  warningTitle: {
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  infoTitle: {
    fontWeight: 'bold',
  },
  infoList: {
    marginTop: 16,
  },
  infoItem: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 8,
  },
});
