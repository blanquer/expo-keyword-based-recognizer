import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
import { SpeechRecognitionFlow } from './SpeechRecognitionFlow';
import { 
  SpeechRecognitionManager as ISpeechRecognitionManager,
  FlowActivationOptions 
} from './SpeechRecognitionTypes';
import { 
  KeywordRecognizerState, 
  KeywordRecognizerStateEnum,
  PermissionResponse, 
  Language,
  KeywordDetectionEvent,
  RecognitionResult
} from './ExpoKeywordBasedRecognizer.types';

interface FlowCallbacks {
  onStateChange: ((state: KeywordRecognizerState) => void)[];
  onKeywordDetected: ((event: KeywordDetectionEvent) => void)[];
  onRecognitionResult: ((result: RecognitionResult) => void)[];
  onError: ((error: Error) => void)[];
}

export class SpeechRecognitionManager implements ISpeechRecognitionManager {
  private static instance: SpeechRecognitionManager;
  private flows: Map<string, SpeechRecognitionFlow> = new Map();
  private activeFlow: SpeechRecognitionFlow | null = null;
  private currentState: KeywordRecognizerState = { state: KeywordRecognizerStateEnum.IDLE };
  private flowCallbacks: Map<string, FlowCallbacks> = new Map();

  private constructor() {
    this.setupEventRouting();
  }

  private setupEventRouting(): void {
    // Set up centralized event routing based on flowId
    ExpoKeywordBasedRecognizerModule.addListener('onStateChange', (event: any) => {
      const { flowId, ...data } = event;
      this.currentState = data;
      
      if (flowId) {
        const callbacks = this.flowCallbacks.get(flowId)?.onStateChange || [];
        callbacks.forEach(callback => callback(data));
      }
    });

    ExpoKeywordBasedRecognizerModule.addListener('onKeywordDetected', (event: any) => {
      const { flowId, ...data } = event;
      
      if (flowId) {
        const callbacks = this.flowCallbacks.get(flowId)?.onKeywordDetected || [];
        callbacks.forEach(callback => callback(data));
      }
    });

    ExpoKeywordBasedRecognizerModule.addListener('onRecognitionResult', (event: any) => {
      const { flowId, ...data } = event;
      
      if (flowId) {
        const callbacks = this.flowCallbacks.get(flowId)?.onRecognitionResult || [];
        callbacks.forEach(callback => callback(data));
      }
    });

    ExpoKeywordBasedRecognizerModule.addListener('onError', (event: any) => {
      const { flowId, ...data } = event;
      const error = new Error(data.message);
      
      if (flowId) {
        const callbacks = this.flowCallbacks.get(flowId)?.onError || [];
        callbacks.forEach(callback => callback(error));
      }
    });
  }

  static getInstance(): SpeechRecognitionManager {
    if (!SpeechRecognitionManager.instance) {
      SpeechRecognitionManager.instance = new SpeechRecognitionManager();
    }
    return SpeechRecognitionManager.instance;
  }

  registerFlow(flowId: string): SpeechRecognitionFlow {
    if (this.flows.has(flowId)) {
      throw new Error(`Flow with id "${flowId}" already exists`);
    }
    
    // Initialize callback arrays for this flow
    this.flowCallbacks.set(flowId, {
      onStateChange: [],
      onKeywordDetected: [],
      onRecognitionResult: [],
      onError: [],
    });
    
    const flow = new SpeechRecognitionFlow(flowId, this);
    this.flows.set(flowId, flow);
    return flow;
  }

  unregisterFlow(flowId: string): void {
    const flow = this.flows.get(flowId);
    if (!flow) return;
    
    // If this is the active flow, deactivate it
    if (this.activeFlow === flow) {
      flow.deactivate();
      this.activeFlow = null;
    }
    
    // Callbacks will be cleaned up when we delete from flowCallbacks
    
    // Remove callback registrations
    this.flowCallbacks.delete(flowId);
    
    this.flows.delete(flowId);
  }

  getActiveFlow(): SpeechRecognitionFlow | null {
    return this.activeFlow;
  }

  getState(): KeywordRecognizerState {
    return this.currentState;
  }

  isActive(): boolean {
    return this.activeFlow !== null && this.currentState.state !== KeywordRecognizerStateEnum.IDLE;
  }

  async requestPermissions(): Promise<PermissionResponse> {
    return ExpoKeywordBasedRecognizerModule.requestPermissionsAsync();
  }

  async getAvailableLanguages(): Promise<Language[]> {
    return ExpoKeywordBasedRecognizerModule.getAvailableLanguages();
  }

  // Methods for flows to register callbacks
  registerCallback(flowId: string, eventType: keyof FlowCallbacks, callback: any): () => void {
    const flowCallbacks = this.flowCallbacks.get(flowId);
    if (!flowCallbacks) {
      throw new Error(`Flow "${flowId}" not found`);
    }

    flowCallbacks[eventType].push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.flowCallbacks.get(flowId)?.[eventType];
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Internal method called by flows
  async _activateFlow(flow: SpeechRecognitionFlow, options: FlowActivationOptions): Promise<void> {
    // If there's an active flow, deactivate it first
    if (this.activeFlow && this.activeFlow !== flow) {
      const previousFlow = this.activeFlow;
      const previousOptions = previousFlow.getOptions();
      
      // Notify the previous flow it's being taken over
      (previousFlow as any)._notifyTakenOver(flow.flowId);
      
      // Deactivate the current flow
      await previousFlow.deactivate();
      
      // Call onInterrupted callback if it exists
      if (previousOptions?.onInterrupted) {
        previousOptions.onInterrupted();
      }
    }
    
    // Activate the new flow
    const { onInterrupted, ...nativeOptions } = options;
    const activationOptions = {
      ...nativeOptions,
      flowId: flow.flowId
    };
    await ExpoKeywordBasedRecognizerModule.activate(activationOptions);
    
    // Update flow state
    flow._setActive(true);
    flow._setOptions(options);
    this.activeFlow = flow;
  }
}