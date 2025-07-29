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
  Language 
} from './ExpoKeywordBasedRecognizer.types';

export class SpeechRecognitionManager implements ISpeechRecognitionManager {
  private static instance: SpeechRecognitionManager;
  private flows: Map<string, SpeechRecognitionFlow> = new Map();
  private activeFlow: SpeechRecognitionFlow | null = null;
  private currentState: KeywordRecognizerState = { state: KeywordRecognizerStateEnum.IDLE };

  private constructor() {
    // Subscribe to state changes to keep track
    ExpoKeywordBasedRecognizerModule.addListener('onStateChange', (state: KeywordRecognizerState) => {
      this.currentState = state;
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
    
    // Clean up any remaining subscriptions
    flow.cleanupSubscriptions();
    
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
    await ExpoKeywordBasedRecognizerModule.activate(nativeOptions);
    
    // Update flow state
    flow._setActive(true);
    flow._setOptions(options);
    this.activeFlow = flow;
  }
}