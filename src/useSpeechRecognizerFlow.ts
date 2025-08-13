import { useEffect, useRef, useState, useCallback } from 'react';
import SpeechRecognitionManager from './index';
import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
import { 
  SpeechRecognitionFlow,
  FlowActivationOptions
} from './SpeechRecognitionTypes';
import {
  KeywordRecognizerState,
  KeywordRecognizerStateEnum
} from './ExpoKeywordBasedRecognizer.types';

export interface UseSpeechRecognizerFlowOptions {
  flowName: string;
  // Optional initial configuration
  initialKeyword?: string;
  initialLanguage?: string;
  initialSilenceDelay?: number;
  initialKeywordEnabled?: boolean;
  initializeAudioSession?: boolean;
  
  // Optional callbacks for side effects
  onKeywordDetected?: (keyword: string) => void;
  onRecognitionResult?: (text: string) => void;
  onError?: (error: Error) => void;
  onTakenOver?: (newFlowId: string) => void;
  onStateChange?: (state: KeywordRecognizerState) => void;
}

export interface UseSpeechRecognizerFlowReturn {
  // State
  state: KeywordRecognizerState;
  isActive: boolean;
  isListening: boolean; // Computed: state !== IDLE && isActive
  detectedKeyword: string | null;
  recognizedText: string | null;
  error: Error | null;
  takenOverBy: string | null;
  
  // Configuration state
  keyword: string;
  keywordEnabled: boolean;
  language: string;
  silenceDelay: number;
  
  // Configuration setters
  setKeyword: (keyword: string) => void;
  setKeywordEnabled: (enabled: boolean) => void;
  setLanguage: (language: string) => void;
  setSilenceDelay: (delay: number) => void;
  
  // Actions
  startListening: (options?: Partial<FlowActivationOptions>) => Promise<void>;
  stopListening: () => Promise<void>;
  clearResults: () => void; // Clears detectedKeyword, recognizedText, error
  playKeywordSound: () => Promise<void>;
  playSentenceSound: () => Promise<void>;
  
  // Flow instance (for advanced use cases)
  flow: SpeechRecognitionFlow | null;
}

export function useSpeechRecognizerFlow(options: UseSpeechRecognizerFlowOptions): UseSpeechRecognizerFlowReturn {
  const {
    flowName,
    initialKeyword = '',
    initialLanguage = 'en-US',
    initialSilenceDelay = 2000,
    initialKeywordEnabled = true,
    initializeAudioSession = false,
    onKeywordDetected: onKeywordDetectedCallback,
    onRecognitionResult: onRecognitionResultCallback,
    onError: onErrorCallback,
    onTakenOver: onTakenOverCallback,
    onStateChange: onStateChangeCallback,
  } = options;

  // Flow instance
  const flowRef = useRef<SpeechRecognitionFlow | null>(null);
  
  // State management
  const [state, setState] = useState<KeywordRecognizerState>({ state: KeywordRecognizerStateEnum.IDLE });
  const [isActive, setIsActive] = useState(false);
  const [detectedKeyword, setDetectedKeyword] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [takenOverBy, setTakenOverBy] = useState<string | null>(null);
  
  // Configuration state
  const [keyword, setKeyword] = useState(initialKeyword);
  const [keywordEnabled, setKeywordEnabled] = useState(initialKeywordEnabled);
  const [language, setLanguage] = useState(initialLanguage);
  const [silenceDelay, setSilenceDelay] = useState(initialSilenceDelay);
  
  // Computed properties
  const isListening = isActive && state.state !== KeywordRecognizerStateEnum.IDLE;
  
  // Initialize flow and set up event listeners
  useEffect(() => {
    const flow = SpeechRecognitionManager.registerFlow(flowName);
    flowRef.current = flow;
    
    // Set up event listeners
    const unsubscribeState = flow.onStateChange((newState) => {
      setState(newState);
      setIsActive(flow.isActive);
      onStateChangeCallback?.(newState);
    });
    
    const unsubscribeKeyword = flow.onKeywordDetected((event) => {
      setDetectedKeyword(event.keyword);
      onKeywordDetectedCallback?.(event.keyword);
    });
    
    const unsubscribeResult = flow.onRecognitionResult((result) => {
      setRecognizedText(result.text);
      onRecognitionResultCallback?.(result.text);
    });
    
    const unsubscribeError = flow.onError((err) => {
      setError(err);
      onErrorCallback?.(err);
    });
    
    const unsubscribeTakenOver = flow.onTakenOver((newFlowId) => {
      // Reset state when taken over
      setState({ state: KeywordRecognizerStateEnum.IDLE });
      setDetectedKeyword(null);
      setRecognizedText(null);
      setError(null);
      setTakenOverBy(newFlowId);
      onTakenOverCallback?.(newFlowId);
    });
    
    // Cleanup
    return () => {
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
  }, [flowName]); // Only re-run if flowName changes
  
  // Actions
  const startListening = useCallback(async (overrideOptions?: Partial<FlowActivationOptions>) => {
    if (!flowRef.current) {
      console.error('Flow not initialized');
      return;
    }
    
    try {
      // Clear previous results
      setDetectedKeyword(null);
      setRecognizedText(null);
      setError(null);
      setTakenOverBy(null);
      
      const activationOptions: FlowActivationOptions = {
        keyword: keywordEnabled ? keyword : null,
        language,
        maxSilenceDuration: silenceDelay,
        soundEnabled: true,
        interimResults: true,
        contextualHints: [],
        initializeAudioSession,
        ...overrideOptions, // Allow override of any option
      };
      
      await flowRef.current.activate(activationOptions);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onErrorCallback?.(error);
    }
  }, [keyword, keywordEnabled, language, silenceDelay, onErrorCallback]);
  
  const stopListening = useCallback(async () => {
    if (!flowRef.current) {
      console.error('Flow not initialized');
      return;
    }
    
    try {
      await flowRef.current.deactivate();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onErrorCallback?.(error);
    }
  }, [onErrorCallback]);
  
  const clearResults = useCallback(() => {
    setDetectedKeyword(null);
    setRecognizedText(null);
    setError(null);
    setTakenOverBy(null);
  }, []);
  
  const playKeywordSound = useCallback(async () => {
    try {
      await ExpoKeywordBasedRecognizerModule.playKeywordSound();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to play keyword sound:', error);
    }
  }, []);
  
  const playSentenceSound = useCallback(async () => {
    try {
      await ExpoKeywordBasedRecognizerModule.playSentenceSound();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to play sentence sound:', error);
    }
  }, []);
  
  return {
    // State
    state,
    isActive,
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
    clearResults,
    playKeywordSound,
    playSentenceSound,
    
    // Flow instance
    flow: flowRef.current,
  };
}