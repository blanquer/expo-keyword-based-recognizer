import { Subscription } from 'expo-modules-core';
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
  private subscriptions: Subscription[] = [];
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

  // Deactivates the flow BUT it does not clean the subscriptions or unregister the flow...
  async deactivate(): Promise<void> {
    if (!this._isActive) return;
    
    // // Clean up all subscriptions
    // this.cleanupSubscriptions();
    
    // Deactivate native module
    await ExpoKeywordBasedRecognizerModule.deactivate();
    
    this._isActive = false;
    this._options = null;
  }

  onStateChange(callback: (state: KeywordRecognizerState) => void): () => void {
    const subscription = ExpoKeywordBasedRecognizerModule.addListener('onStateChange', callback);
    this.subscriptions.push(subscription);
    
    return () => {
      subscription.remove();
      this.subscriptions = this.subscriptions.filter(s => s !== subscription);
    };
  }

  onKeywordDetected(callback: (event: KeywordDetectionEvent) => void): () => void {
    const subscription = ExpoKeywordBasedRecognizerModule.addListener('onKeywordDetected', callback);
    this.subscriptions.push(subscription);
    
    return () => {
      subscription.remove();
      this.subscriptions = this.subscriptions.filter(s => s !== subscription);
    };
  }

  onRecognitionResult(callback: (result: RecognitionResult) => void): () => void {
    const subscription = ExpoKeywordBasedRecognizerModule.addListener('onRecognitionResult', callback);
    this.subscriptions.push(subscription);
    
    return () => {
      subscription.remove();
      this.subscriptions = this.subscriptions.filter(s => s !== subscription);
    };
  }

  onError(callback: (error: Error) => void): () => void {
    const subscription = ExpoKeywordBasedRecognizerModule.addListener('onError', callback);
    this.subscriptions.push(subscription);
    
    return () => {
      subscription.remove();
      this.subscriptions = this.subscriptions.filter(s => s !== subscription);
    };
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

  cleanupSubscriptions(): void {
    this.subscriptions.forEach(subscription => subscription.remove());
    this.subscriptions = [];
  }

  // Internal method to notify this flow it was taken over
  _notifyTakenOver(newFlowId: string): void {
    this.takenOverCallbacks.forEach(callback => callback(newFlowId));
  }
}