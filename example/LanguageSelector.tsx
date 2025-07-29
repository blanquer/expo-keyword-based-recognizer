import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as ExpoKeywordBasedRecognizer from 'expo-keyword-based-recognizer';

interface Language {
  code: string;
  name: string;
}

interface LanguageSelectorProps {
  value: string;
  onValueChange: (language: string) => void;
}

export default function LanguageSelector({ value, onValueChange }: LanguageSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailableLanguages();
  }, []);

  const loadAvailableLanguages = async () => {
    try {
      const availableLanguages = await ExpoKeywordBasedRecognizer.getAvailableLanguages();
      setLanguages(availableLanguages);
    } catch (error) {
      console.error('Failed to load languages:', error);
      // Fallback to common languages
      setLanguages([
        { code: 'en-US', name: 'English (US)' },
        { code: 'es-ES', name: 'Spanish (Spain)' },
        { code: 'fr-FR', name: 'French (France)' },
        { code: 'de-DE', name: 'German (Germany)' },
        { code: 'it-IT', name: 'Italian (Italy)' },
        { code: 'pt-BR', name: 'Portuguese (Brazil)' },
        { code: 'ja-JP', name: 'Japanese' },
        { code: 'ko-KR', name: 'Korean' },
        { code: 'zh-CN', name: 'Chinese (Simplified)' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const selectedLanguage = languages.find(lang => lang.code === value);

  const renderLanguageItem = ({ item }: { item: Language }) => (
    <TouchableOpacity
      style={[styles.languageItem, item.code === value && styles.selectedItem]}
      onPress={() => {
        onValueChange(item.code);
        setModalVisible(false);
      }}
    >
      <Text style={[styles.languageText, item.code === value && styles.selectedText]}>
        {item.name}
      </Text>
      <Text style={[styles.languageCode, item.code === value && styles.selectedText]}>
        {item.code}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Language</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" />
        ) : (
          <>
            <Text style={styles.selectorText}>
              {selectedLanguage ? selectedLanguage.name : 'Select Language'}
            </Text>
            <Text style={styles.arrow}>▼</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={languages}
              renderItem={renderLanguageItem}
              keyExtractor={item => item.code}
              style={styles.languageList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectorText: {
    fontSize: 14,
    color: '#333',
  },
  arrow: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  languageList: {
    paddingBottom: 20,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedItem: {
    backgroundColor: '#f0f8ff',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  languageCode: {
    fontSize: 14,
    color: '#666',
  },
  selectedText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});