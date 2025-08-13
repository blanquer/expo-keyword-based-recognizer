import Ionicons from '@expo/vector-icons/Ionicons';
import { 
  useSpeechRecognizerFlow,
  KeywordRecognizerStateEnum
} from 'expo-keyword-based-recognizer';
import React, { ReactElement } from 'react';
import { Switch, Text, TextInput, View, TouchableOpacity } from 'react-native';
import LanguageSelector from './LanguageSelector';

interface FlowComponentHookProps {
  flowName: string;
  cardBackgroundColor?: string;
  initialLanguage?: string;
  initialKeyword?: string;
  initialKeywordEnabled?: boolean;
  initialSilenceDelay?: number;
  initializeAudioSession?: boolean;
}

export default function FlowComponentHook({ 
  flowName,
  cardBackgroundColor = "#fff",
  initialLanguage = "en-US",
  initialKeyword = "Hey Chef",
  initialKeywordEnabled = true,
  initialSilenceDelay = 2000,
  initializeAudioSession = false,
}: FlowComponentHookProps) {
  // Use the hook for all speech recognition functionality
  const {
    // State
    state,
    isListening,
    detectedKeyword,
    recognizedText,
    error,
    takenOverBy,
    
    // Configuration
    keyword,
    keywordEnabled,
    language,
    silenceDelay,
    
    // Configuration setters
    setKeyword,
    setKeywordEnabled,
    setLanguage,
    setSilenceDelay,
    
    // Actions
    startListening,
    stopListening,
    playKeywordSound,
    playSentenceSound,
  } = useSpeechRecognizerFlow({
    flowName,
    initialKeyword,
    initialLanguage,
    initialSilenceDelay,
    initialKeywordEnabled,
    initializeAudioSession,
  });
  
  const listeningStateToComponent = (): ReactElement => {
    const commonState = state?.state || KeywordRecognizerStateEnum.IDLE;
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
  
  return (
    <View style={[styles.card, { backgroundColor: cardBackgroundColor }]}>
      {/* Flow Name Header with Action Button */}
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardHeader}>{flowName} (Hook)</Text>
        {!isListening ? (
          <TouchableOpacity style={styles.actionButton} onPress={() => startListening()}>
            <Ionicons name="play" size={16} color="#007AFF" />
            <Text style={styles.actionButtonText}>Listen</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.actionButton} onPress={stopListening}>
            <Ionicons name="stop" size={16} color="#FF3B30" />
            <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <Group>
        {/* Language selector first */}
        <View style={{ marginBottom: 8 }}>
          <LanguageSelector
            value={language}
            onValueChange={setLanguage}
          />
        </View>
        
        {/* Keyword input and Enable switch side by side */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={{ flex: 2 }}>
            <Text style={{ marginBottom: 4, fontSize: 14 }}>Keyword:</Text>
            <TextInput
              style={[styles.input, styles.inputCompact, (!keywordEnabled || isListening) && styles.inputDisabled]}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="Enter keyword"
              editable={keywordEnabled && !isListening}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ marginBottom: 4, fontSize: 14 }}>Enable:</Text>
            <Switch
              value={keywordEnabled}
              onValueChange={setKeywordEnabled}
              disabled={isListening}
            />
          </View>
        </View>
        
        {/* Silence Delay */}
        <View>
          <Text style={{ marginBottom: 4, fontSize: 14 }}>Silence Delay (ms):</Text>
          <TextInput
            style={[styles.input, styles.inputCompact, isListening && styles.inputDisabled]}
            value={silenceDelay.toString()}
            onChangeText={(text) => setSilenceDelay(parseInt(text) || 0)}
            placeholder="Enter delay"
            keyboardType="numeric"
            editable={!isListening}
          />
        </View>
      </Group>
      
      <Group name="Recognition" compact>
        {/* Detection State */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 14 }}>State: </Text>
            {listeningStateToComponent()}
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
          <Text style={{ fontSize: 14 }}>{recognizedText || '---'}</Text>
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
      
      {/* Sound Test Buttons */}
      <Group name="Sound Tests" compact>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity 
            style={[styles.soundButton, { flex: 1 }]} 
            onPress={() => playKeywordSound()}
          >
            <Ionicons name="play-circle" size={20} color="#007AFF" />
            <Text style={styles.soundButtonText}>Keyword Sound</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.soundButton, { flex: 1 }]} 
            onPress={() => playSentenceSound()}
          >
            <Ionicons name="stop-circle" size={20} color="#007AFF" />
            <Text style={styles.soundButtonText}>Sentence Sound</Text>
          </TouchableOpacity>
        </View>
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
  soundButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.2)',
  },
  soundButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#007AFF',
  },
};