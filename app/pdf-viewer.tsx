import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Pdf from 'react-native-pdf';
import { ArrowLeft, Download, Share } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PDFViewerScreen() {
  const { filePath, fileName } = useLocalSearchParams<{
    filePath: string;
    fileName: string;
  }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numberOfPages, setNumberOfPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const source = { 
    uri: filePath, 
    cache: true 
  };

  // Debug logging
  console.log('PDF Viewer - filePath:', filePath);
  console.log('PDF Viewer - fileName:', fileName);

  // Fallback: Hide loading after a short delay to prevent it from staying visible
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000); // Hide loading after 2 seconds as fallback

    return () => clearTimeout(timer);
  }, []);

  const handleLoadComplete = (pages: number, filePath: string) => {
    console.log(`Number of pages: ${pages}`);
    setNumberOfPages(pages);
    setLoading(false);
  };

  const handleLoadProgress = (percent: number) => {
    console.log(`PDF Load Progress: ${percent}%`);
    // Hide loading when PDF starts rendering (even at 1% progress)
    if (percent > 0) {
      setLoading(false);
    }
  };

  const handlePageChanged = (page: number, pages: number) => {
    console.log(`Current page: ${page}`);
    setCurrentPage(page);
  };

  const handleError = (error: any) => {
    console.error('PDF Error:', error);
    setError(error.message || 'Failed to load PDF');
    setLoading(false);
  };

  const handlePressLink = (uri: string) => {
    console.log(`Link pressed: ${uri}`);
    // You can add link handling logic here if needed
  };

  const handleShare = async () => {
    try {
      // Validate file path
      if (!filePath) {
        Alert.alert('Share Error', 'PDF file path is not available');
        return;
      }

      // Ensure file path has proper scheme
      const validFilePath = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      
      console.log('Attempting to share PDF:', validFilePath);
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(validFilePath, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share PDF Report',
        });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Error', `Failed to share PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (error || !filePath) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PDF Viewer</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>
            {!filePath ? 'PDF file not found' : 'Failed to load PDF'}
          </Text>
          <Text style={styles.errorMessage}>
            {!filePath ? 'The PDF file path is not available. Please try generating the PDF again.' : error}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleBack}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {fileName || 'PDF Report'}
          </Text>
          {numberOfPages > 0 && (
            <Text style={styles.pageInfo}>
              Page {currentPage} of {numberOfPages}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Share size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}

      <View style={styles.pdfContainer}>
        <Pdf
          source={source}
          onLoadComplete={handleLoadComplete}
          onLoadProgress={handleLoadProgress}
          onPageChanged={handlePageChanged}
          onError={handleError}
          onPressLink={handlePressLink}
          style={styles.pdf}
          enablePaging={true}
          enableRTL={false}
          enableAnnotationRendering={true}
          trustAllCerts={Platform.OS === 'ios'}
          password=""
          spacing={0}
          minScale={1.0}
          maxScale={3.0}
          scale={1.0}
          horizontal={false}
          fitPolicy={0}
          activityIndicator={
            <ActivityIndicator size="large" color="#22c55e" />
          }
        />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  pageInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  pdfContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  pdf: {
    flex: 1,
    width: screenWidth,
    height: screenHeight - 100, // Account for header height
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f9fafb',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
