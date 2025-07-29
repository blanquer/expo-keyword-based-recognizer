import { 
  KeywordRecognizerState, 
  KeywordRecognizerOptions, 
  KeywordDetectionEvent, 
  RecognitionResult, 
  PermissionResponse, 
  Language 
} from './ExpoKeywordBasedRecognizer.types';

export interface FlowActivationOptions extends KeywordRecognizerOptions {
  onInterrupted?: () => void;
}

export interface SpeechRecognitionFlow {
  readonly flowId: string;
  readonly isActive: boolean;
  
  activate(options: FlowActivationOptions): Promise<void>;
  deactivate(): Promise<void>;
  
  onStateChange(callback: (state: KeywordRecognizerState) => void): () => void;
  onKeywordDetected(callback: (event: KeywordDetectionEvent) => void): () => void;
  onRecognitionResult(callback: (result: RecognitionResult) => void): () => void;
  onError(callback: (error: Error) => void): () => void;
  onTakenOver(callback: (newFlowId: string) => void): () => void;
  
  getOptions(): FlowActivationOptions | null;
}

export interface SpeechRecognitionManager {
  registerFlow(flowId: string): SpeechRecognitionFlow;
  unregisterFlow(flowId: string): void;
  getActiveFlow(): SpeechRecognitionFlow | null;
  
  getState(): KeywordRecognizerState;
  isActive(): boolean;
  
  requestPermissions(): Promise<PermissionResponse>;
  getAvailableLanguages(): Promise<Language[]>;
}