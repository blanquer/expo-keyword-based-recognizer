import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
import { 
  SpeechRecognitionFlow as ISpeechRecognitionFlow, 
  FlowActivationOptions 
} from './SpeechRecognitionTypes';
import { 
  KeywordRecognizerState, 
  KeywordDetectionEvent, 
  RecognitionResult 
} from './ExpoKeywordBasedRecognizer.types';

export class SpeechRecognitionFlow implements ISpeechRecognitionFlow {
  private _isActive = false;
  private _options: FlowActivationOptions | null = null;
  private manager: any; // Will be typed as SpeechRecognitionManager later
  private takenOverCallbacks: ((newFlowId: string) => void)[] = [];

  constructor(
    public readonly flowId: string,
    manager: any
  ) {
    this.manager = manager;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  async activate(options: FlowActivationOptions): Promise<void> {
    // Manager will handle deactivating current flow
    await this.manager._activateFlow(this, options);
  }

  async deactivate(): Promise<void> {
    if (!this._isActive) return;
    
    // Deactivate native module
    await ExpoKeywordBasedRecognizerModule.deactivate();
    
    this._isActive = false;
    this._options = null;
  }

  onStateChange(callback: (state: KeywordRecognizerState) => void): () => void {
    return this.manager.registerCallback(this.flowId, 'onStateChange', callback);
  }

  onKeywordDetected(callback: (event: KeywordDetectionEvent) => void): () => void {
    return this.manager.registerCallback(this.flowId, 'onKeywordDetected', callback);
  }

  onRecognitionResult(callback: (result: RecognitionResult) => void): () => void {
    return this.manager.registerCallback(this.flowId, 'onRecognitionResult', callback);
  }

  onError(callback: (error: Error) => void): () => void {
    return this.manager.registerCallback(this.flowId, 'onError', callback);
  }

  onTakenOver(callback: (newFlowId: string) => void): () => void {
    this.takenOverCallbacks.push(callback);
    
    return () => {
      this.takenOverCallbacks = this.takenOverCallbacks.filter(cb => cb !== callback);
    };
  }

  getOptions(): FlowActivationOptions | null {
    return this._options;
  }

  // Internal methods called by manager
  _setActive(active: boolean): void {
    this._isActive = active;
  }

  _setOptions(options: FlowActivationOptions | null): void {
    this._options = options;
  }


  // Internal method to notify this flow it was taken over
  _notifyTakenOver(newFlowId: string): void {
    this.takenOverCallbacks.forEach(callback => callback(newFlowId));
  }
  
  // Sound playback methods
  async playKeywordSound(): Promise<void> {
    await ExpoKeywordBasedRecognizerModule.playKeywordSound();
  }
  
  async playSentenceSound(): Promise<void> {
    await ExpoKeywordBasedRecognizerModule.playSentenceSound();
  }
}