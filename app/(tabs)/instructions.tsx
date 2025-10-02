import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Camera, Image as ImageIcon, Wand2, FileText, TreePine, CheckCircle, AlertCircle, X } from 'lucide-react-native';

export default function InstructionsScreen() {
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [modalImageSource, setModalImageSource] = useState(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Инструкция по использованию</Text>
        <Text style={styles.subtitle}>
          Полное руководство по работе с приложением "Городские деревья"
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Добавление растения */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Camera size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>Добавление растения</Text>
          </View>
          
          <Text style={styles.instructionText}>
            Сфотографируйте дерево или несколько деревьев общим планом. Если деревьев несколько, то выберите такой ракурс, чтобы они не перегораживали друг друга.
          </Text>

          <Text style={styles.exampleTitle}>Пример хорошего ракурса:</Text>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={() => {
              setModalImageSource(require('@/assets/images/detection_good_example_1.jpg'));
              setImageModalVisible(true);
            }}
          >
            <Image 
              source={require('@/assets/images/detection_good_example_1.jpg')}
              style={styles.exampleImage}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={styles.badExampleTitle}>Пример плохого ракурса:</Text>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={() => {
              setModalImageSource(require('@/assets/images/detection_bad_example_1.jpg'));
              setImageModalVisible(true);
            }}
          >
            <Image 
              source={require('@/assets/images/detection_bad_example_1.jpg')}
              style={styles.exampleImage}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={styles.instructionText}>
            Дождитесь распознавания деревьев детектором и выберите те, которые вы хотите добавить в базу данных для дальнейшего анализа. Этот шаг работает без интернета.
          </Text>

          <Text style={styles.instructionText}>
            Если у дерева могут быть повреждения, которые плохо видно с общего плана, то вы можете перейти в карточку конкретного дерева и добавить дополнительные фото вблизи. Постарайтесь сделать снимок так, чтобы рядом стоящие деревья не попали в кадр.
          </Text>

          <Text style={styles.exampleTitle}>Пример хорошего доп. фото:</Text>
          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={() => {
              setModalImageSource(require('@/assets/images/additional_good_example_1.jpg'));
              setImageModalVisible(true);
            }}
          >
            <Image 
              source={require('@/assets/images/additional_good_example_1.jpg')}
              style={styles.exampleImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Генерация описания */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Wand2 size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>Генерация описания</Text>
          </View>
          
          <Text style={styles.instructionText}>
            Когда устройство подключено к интернету, вы можете запустить анализ искусственным интеллектом, который произведет классификацию вида растения и обнаружит дефекты (трещина, дупло, гниль, язва). Для этого перейдите в карточку дерева и нажмите на кнопку Обработать ИИ.
          </Text>

          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={() => {
              setModalImageSource(require('@/assets/images/run_ai_button_example.png'));
              setImageModalVisible(true);
            }}
          >
            <Image 
              source={require('@/assets/images/run_ai_button_example.png')}
              style={styles.exampleImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Формирование отчета */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FileText size={24} color="#22c55e" />
            <Text style={styles.sectionTitle}>Формирование отчета</Text>
          </View>
          
          <Text style={styles.instructionText}>
            Для формирования отчета перейдите на главный экран, выберите необходимые растения с помощью чек-боксов и нажмите кнопку Экспорт.
          </Text>

          <TouchableOpacity 
            style={styles.imageContainer}
            onPress={() => {
              setModalImageSource(require('@/assets/images/export_button_example.png'));
              setImageModalVisible(true);
            }}
          >
            <Image 
              source={require('@/assets/images/export_button_example.png')}
              style={styles.exampleImage}
              resizeMode="contain"
            />
          </TouchableOpacity>

          <Text style={styles.instructionText}>
            В результате вы получите отчет в формате PDF, который можно изучить или экспортировать.
          </Text>
        </View>
      </ScrollView>

      {/* Full-screen image modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalCloseButton}
            onPress={() => setImageModalVisible(false)}
          >
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
          {modalImageSource && (
            <Image 
              source={modalImageSource}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
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
  instructionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  exampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  badExampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  imageContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  exampleImage: {
    width: '100%',
    height: 200,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  fullScreenImage: {
    width: Dimensions.get('window').width - 40,
    height: Dimensions.get('window').height - 100,
  },
});
