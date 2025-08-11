import SpeechRecognitionManager, { 
  SpeechRecognitionFlow
} from 'expo-keyword-based-recognizer';
import React, { useRef, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FlowComponent from './FlowComponent';
import FlowComponentHook from './FlowComponentHook';

export default function App() {
  // Using refs to maintain flow instances
  const mainFlowRef = useRef<SpeechRecognitionFlow | null>(null);
  const [actionsExpanded, setActionsExpanded] = useState<boolean>(false);


  const requestPermissions = async () => {
    try {
      const permissions = await SpeechRecognitionManager.requestPermissions();
      Alert.alert(
        "Permission Request Result",
        `Speech Recognition: ${permissions.status}\\n` +
          `Granted: ${permissions.granted ? "Yes" : "No"}\\n` +
          `Can Ask Again: ${permissions.canAskAgain ? "Yes" : "No"}`
      );
    } catch (error: any) {
      Alert.alert("Permission Error", error.message);
    }
  };
  
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        {/* Header with Actions Menu */}
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.header}>Example App</Text>
            
            {/* Actions Menu Button */}
            <TouchableOpacity 
              style={styles.actionsButton}
              onPress={() => setActionsExpanded(!actionsExpanded)}
            >
              <Text style={styles.actionsButtonText}>Actions</Text>
              <Ionicons 
                name={actionsExpanded ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#666" 
              />
            </TouchableOpacity>
          </View>
          
          {actionsExpanded && (
            <View style={styles.actionsMenu}>
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => {
                  setActionsExpanded(false);
                  requestPermissions();
                }}
              >
                <Ionicons name="shield-checkmark-outline" size={18} color="#666" />
                <Text style={styles.actionText}>Request Permissions</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Main Flow Component */}
        <FlowComponent 
          flowName="Main Flow"
          cardBackgroundColor="#f0f8ff"
          initialLanguage="en-US"
          initialKeyword="Hey Chef"
          initialKeywordEnabled={true}
          initialSilenceDelay={2000}
          initializeAudioSession={true}
          onFlowCreated={(flow) => { mainFlowRef.current = flow; }} 
        />

        {/* Secondary Flow Component using the new hook */}
        <FlowComponentHook 
          flowName="Spanish Flow"
          cardBackgroundColor="#fff5f5"
          initialLanguage="es-ES"
          initialKeyword=""
          initialKeywordEnabled={false}
          initialSilenceDelay={1500}
          initializeAudioSession={true}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#eee',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#333',
    flex: 1,
  },
  actionsButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionsButtonText: {
    marginRight: 4,
    fontSize: 13,
    color: '#666',
    fontWeight: '500' as const,
  },
  actionsMenu: {
    position: 'absolute' as const,
    top: 50,
    right: 16,
    width: 250,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  actionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
};
