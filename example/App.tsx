import SpeechRecognitionManager, { 
  SpeechRecognitionFlow
} from 'expo-keyword-based-recognizer';
import React, { useRef, useEffect, useState } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import FlowComponent from './FlowComponent';

export default function App() {
  // Using refs to maintain flow instances
  const mainFlowRef = useRef<SpeechRecognitionFlow | null>(null);
  const tempFlowRef = useRef<SpeechRecognitionFlow | null>(null);
  const [actionsExpanded, setActionsExpanded] = useState<boolean>(false);

  useEffect(() => {
    // Cleanup function
    return () => {
      if (tempFlowRef.current) {
        tempFlowRef.current.deactivate();
        SpeechRecognitionManager.unregisterFlow('temp-example-flow');
      }
    };
  }, []);


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
  
  // Demonstrate flow takeover capability
  const startTemporaryFlow = async () => {
    try {
      // Create or get the temporary flow
      if (!tempFlowRef.current) {
        tempFlowRef.current = SpeechRecognitionManager.registerFlow('temp-example-flow');
        
        // Set up listeners for temporary flow
        tempFlowRef.current.onRecognitionResult((result) => {
          if (result.isFinal) {
            Alert.alert("Temporary Flow Result", result.text);
            // Return to main flow after getting result
            if (mainFlowRef.current) {
              mainFlowRef.current.activate({
                keyword: "Hey Chef",
                language: 'en-US',
                soundEnabled: true
              });
            }
          }
        });
        
        tempFlowRef.current.onTakenOver((newFlowId) => {
          console.log(`🔴 DEBUG: Temporary flow was taken over by flow: ${newFlowId}`);
        });
      }
      
      // This will automatically interrupt the main flow if it's active
      await tempFlowRef.current.activate({
        keyword: null, // Direct recognition without keyword
        language: 'en-US',
        maxSilenceDuration: 5000, // Longer timeout for temporary flow
        soundEnabled: true,
        onInterrupted: () => {
          console.log("Temporary flow was interrupted");
        }
      });
      
      Alert.alert("Temporary Flow Active", "Say something within 5 seconds...");
    } catch (err: any) {
      console.log("🔴 DEBUG: Error in startTemporaryFlow:", err);
      Alert.alert("Error", err.message);
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
              
              <TouchableOpacity 
                style={styles.actionItem}
                onPress={() => {
                  setActionsExpanded(false);
                  startTemporaryFlow();
                }}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color="#666" />
                <Text style={styles.actionText}>Start Temporary Flow (Takeover Demo)</Text>
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
          onFlowCreated={(flow) => { mainFlowRef.current = flow; }} 
        />

        {/* Secondary Flow Component */}
        <FlowComponent 
          flowName="Spanish Flow"
          cardBackgroundColor="#fff5f5"
          initialLanguage="es-ES"
          initialKeyword=""
          initialKeywordEnabled={false}
          initialSilenceDelay={1500}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 8,
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
  groupHeader: {
    fontSize: 16,
    marginBottom: 10,
    fontWeight: 'bold' as const,
  },
  group: {
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },
};
