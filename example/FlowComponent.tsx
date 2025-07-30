import Ionicons from '@expo/vector-icons/Ionicons';
import SpeechRecognitionManager, { 
  SpeechRecognitionFlow,
  KeywordRecognizerState, 
  KeywordRecognizerStateEnum
} from 'expo-keyword-based-recognizer';
import React, { ReactElement, useEffect, useRef, useState } from 'react';
import { Alert, Button, Switch, Text, TextInput, View, TouchableOpacity } from 'react-native';
import LanguageSelector from './LanguageSelector';

interface FlowComponentProps {
  flowName: string;
  cardBackgroundColor?: string;
  initialLanguage?: string;
  initialKeyword?: string;
  initialKeywordEnabled?: boolean;
  initialSilenceDelay?: number;
  onFlowCreated?: (flow: SpeechRecognitionFlow) => void;
}

export default function FlowComponent({ 
  flowName,
  cardBackgroundColor = "#fff",
  initialLanguage = "en-US",
  initialKeyword = "Hey Chef",
  initialKeywordEnabled = true,
  initialSilenceDelay = 2000,
  onFlowCreated 
}: FlowComponentProps) {
  const [keyword, setKeyword] = useState<string>(initialKeyword);
  const [keywordEnabled, setKeywordEnabled] = useState<boolean>(initialKeywordEnabled);
  const [silenceDelay, setSilenceDelay] = useState<number>(initialSilenceDelay);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLanguage);
  
  // Using ref to maintain flow instance
  const flowRef = useRef<SpeechRecognitionFlow | null>(null);
  
  // State for UI
  const [listeningState, setListeningState] = useState<KeywordRecognizerState>({state: KeywordRecognizerStateEnum.IDLE});
  const [error, setError] = useState<any>(null);
  const [detectedKeyword, setDetectedKeyword] = useState<string|null>(null);
  const [recognizedSentence, setRecognizedSentence] = useState<string|null>(null);
  const [takenOverBy, setTakenOverBy] = useState<string|null>(null);

  useEffect(() => {
    // Initialize the flow when component mounts
    const flow = SpeechRecognitionManager.registerFlow(flowName);
    flowRef.current = flow;
    
    // Notify parent component if callback provided
    if (onFlowCreated) {
      onFlowCreated(flow);
    }
    
    // Set up event listeners using the new flow-based API
    const unsubscribeState = flow.onStateChange((state) => {
      setListeningState(state);
    });
    
    const unsubscribeKeyword = flow.onKeywordDetected((event) => {
      setDetectedKeyword(event.keyword);
    });
    
    const unsubscribeResult = flow.onRecognitionResult((result) => {
      setRecognizedSentence(result.text);
    });
    
    const unsubscribeError = flow.onError((error) => {
      setError(error);
      console.log(`🔴 DEBUG: Error in ${flowName}:`, error);
    });
    
    const unsubscribeTakenOver = flow.onTakenOver((newFlowId) => {
      console.log(`🔴 DEBUG: ${flowName} was taken over by flow: ${newFlowId}`);
      
      // Reset all UI state when taken over
      setListeningState({ state: KeywordRecognizerStateEnum.IDLE });
      setDetectedKeyword(null);
      setRecognizedSentence(null);
      setError(null);
      
      // Show takeover notification
      setTakenOverBy(newFlowId);
      // Clear the takeover message after 3 seconds
      // setTimeout(() => setTakenOverBy(null), 3000);
    });
    
    // Cleanup function
    return () => {
      // The flow automatically cleans up its subscriptions when deactivated
      if (flowRef.current) {
        flowRef.current.deactivate();
        SpeechRecognitionManager.unregisterFlow(flowName);
      }
      unsubscribeState();
      unsubscribeKeyword();
      unsubscribeResult();
      unsubscribeError();
      unsubscribeTakenOver();
    };
  }, [flowName, onFlowCreated]);

  const startListening = async () => {
    if (!flowRef.current) {
      console.error("Flow not initialized");
      return;
    }
    
    try {
      // Clear all previous state including errors
      setDetectedKeyword(null);
      setRecognizedSentence(null);
      setError(null);
      setTakenOverBy(null);
      console.log(`🔴 DEBUG: Starting to activate ${flowName}...`);

      const options = {
        keyword: keywordEnabled ? keyword : null,
        language: selectedLanguage,
        confidenceThreshold: 0.7,
        maxSilenceDuration: silenceDelay,
        soundEnabled: true,
        interimResults: true,
        contextualHints: [],
        onInterrupted: () => {
          console.log(`🔴 DEBUG: ${flowName} was interrupted by another flow`);
        }
      };

      await flowRef.current.activate(options);
      console.log(`🔴 DEBUG: ${flowName} activate completed successfully`);
    } catch (err: any) {
      console.log(`🔴 DEBUG: Error in ${flowName} startListening:`, err);
      setError(err);
      Alert.alert("Error", err.message);
    }
  };

  const cancelListening = async () => {
    if (!flowRef.current) {
      console.error("Flow not initialized");
      return;
    }
    
    try {
      console.log(`🔴 DEBUG: Cancelling ${flowName}...`);
      await flowRef.current.deactivate();
      console.log(`🔴 DEBUG: ${flowName} cancel completed successfully`);
    } catch (err: any) {
      console.log(`🔴 DEBUG: Error in ${flowName} cancelListening:`, err);
      setError(err);
      Alert.alert("Error", err.message);
    }
  };
  
  const listeningStateToComponent = (state: KeywordRecognizerState | null): ReactElement => {
    const commonState = state?.state  || KeywordRecognizerStateEnum.IDLE as KeywordRecognizerStateEnum;
    let string = '';
    let icon: React.ComponentProps<typeof Ionicons>['name'] = "checkmark-circle";
    switch (commonState) {
      case KeywordRecognizerStateEnum.IDLE:
        string = 'Idle';
        icon = "pause-circle-outline";
        break;
      case KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD:
        string = 'Listening for keyword';
        icon = "mic-outline";
        break;
      case KeywordRecognizerStateEnum.RECOGNIZING_SPEECH:
        string = 'Recognizing speech';
        icon = "chatbubbles-outline"
        break;
      case KeywordRecognizerStateEnum.PROCESSING:
        string = 'Processing';
        icon = "chatbubbles-outline"
        break;
      default:
        string = 'Unknown state';
        icon = "help-circle-outline";
        break;
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon && <Ionicons name={icon} size={18} />}
        <Text style={{ fontStyle: 'italic', marginLeft: 6, fontSize: 14 }}>({string})</Text>
      </View>
    )
  };
  
  // Check if this specific flow is active AND currently listening/recognizing
  const isThisFlowActive = (flowRef.current?.isActive || false) && 
                          listeningState?.state !== KeywordRecognizerStateEnum.IDLE;
  
  return (
    <View style={[styles.card, { backgroundColor: cardBackgroundColor }]}>
      {/* Flow Name Header with Action Button */}
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardHeader}>{flowName}</Text>
        {!isThisFlowActive ? (
          <TouchableOpacity style={styles.actionButton} onPress={startListening}>
            <Ionicons name="play" size={16} color="#007AFF" />
            <Text style={styles.actionButtonText}>Listen</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionButton} onPress={cancelListening}>
            <Ionicons name="stop" size={16} color="#FF3B30" />
            <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <Group>
        {/* Language selector first */}
        <View style={{ marginBottom: 8 }}>
          <LanguageSelector
            value={selectedLanguage}
            onValueChange={setSelectedLanguage}
          />
        </View>
        
        {/* Keyword input and Enable switch side by side */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={{ flex: 2 }}>
            <Text style={{ marginBottom: 4, fontSize: 14 }}>Keyword:</Text>
            <TextInput
              style={[styles.input, styles.inputCompact, (!keywordEnabled || isThisFlowActive) && styles.inputDisabled]}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="Enter keyword"
              editable={keywordEnabled && !isThisFlowActive}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ marginBottom: 4, fontSize: 14 }}>Enable:</Text>
            <Switch
              value={keywordEnabled}
              onValueChange={setKeywordEnabled}
              disabled={isThisFlowActive}
            />
          </View>
        </View>
        
        {/* Silence Delay */}
        <View>
          <Text style={{ marginBottom: 4, fontSize: 14 }}>Silence Delay (ms):</Text>
          <TextInput
            style={[styles.input, styles.inputCompact, isThisFlowActive && styles.inputDisabled]}
            value={silenceDelay.toString()}
            onChangeText={(text) => setSilenceDelay(parseInt(text) || 0)}
            placeholder="Enter delay"
            keyboardType="numeric"
            editable={!isThisFlowActive}
          />
        </View>
      </Group>
      
      <Group name="Recognition" compact>
        {/* Detection State */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 14 }}>State: </Text>
            {listeningStateToComponent(listeningState)}
          </View>
          {keywordEnabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 14 }}>Keyword:</Text>
              { detectedKeyword ? (
                <Ionicons name="checkmark-circle" size={20} color="green" />  
              ) : (
                <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={'gray'}/>  
              )}
            </View>
          )}
        </View>
        
        {/* Recognition Result */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>Result:</Text>
          <Text style={{ fontSize: 14 }}>{recognizedSentence || '---'}</Text>
        </View>
        
        {/* Takeover notification */}
        {takenOverBy && (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 14 }}>
              Flow taken over by: {takenOverBy}
            </Text>
          </View>
        )}
        
        {/* Error */}
        {error && (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>Error:</Text>
            <Text style={{ fontSize: 14, color: 'red' }}>{error.message}</Text>
          </View>
        )}
      </Group>
    </View>
  );
}

function Group(props: { name?: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <View style={[styles.group, props.compact && styles.groupCompact]}>
      {props.name && (
        <Text style={[styles.groupHeader, props.compact && styles.groupHeaderCompact]}>{props.name}</Text>
      )}
      {props.children}
    </View>
  );
}

const styles = {
  card: {
    margin: 8,
    borderRadius: 12,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 2,
    marginRight: 10,
    marginLeft: 10,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#333',
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
  groupHeader: {
    fontSize: 14,
    marginBottom: 10,
    fontWeight: 'bold' as const,
  },
  groupHeaderCompact: {
    fontSize: 14,
    marginBottom: 6,
  },
  group: {
    margin: 4,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
    padding: 8,
  },
  groupCompact: {
    margin: 3,
    padding: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 1,
    backgroundColor: '#f9f9f9',
  },
  inputCompact: {
    padding: 8,
    fontSize: 14,
  },
  inputDisabled: {
    backgroundColor: '#e0e0e0',
    color: '#666',
  },
};