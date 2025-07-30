import { SpeechRecognitionFlow } from './SpeechRecognitionFlow';
import { SpeechRecognitionManager as ISpeechRecognitionManager, FlowActivationOptions } from './SpeechRecognitionTypes';
import { KeywordRecognizerState, PermissionResponse, Language, KeywordDetectionEvent, RecognitionResult } from './ExpoKeywordBasedRecognizer.types';
interface FlowCallbacks {
    onStateChange: ((state: KeywordRecognizerState) => void)[];
    onKeywordDetected: ((event: KeywordDetectionEvent) => void)[];
    onRecognitionResult: ((result: RecognitionResult) => void)[];
    onError: ((error: Error) => void)[];
}
export declare class SpeechRecognitionManager implements ISpeechRecognitionManager {
    private static instance;
    private flows;
    private activeFlow;
    private currentState;
    private flowCallbacks;
    private constructor();
    private setupEventRouting;
    static getInstance(): SpeechRecognitionManager;
    registerFlow(flowId: string): SpeechRecognitionFlow;
    unregisterFlow(flowId: string): void;
    getActiveFlow(): SpeechRecognitionFlow | null;
    getState(): KeywordRecognizerState;
    isActive(): boolean;
    requestPermissions(): Promise<PermissionResponse>;
    getAvailableLanguages(): Promise<Language[]>;
    registerCallback(flowId: string, eventType: keyof FlowCallbacks, callback: any): () => void;
    _activateFlow(flow: SpeechRecognitionFlow, options: FlowActivationOptions): Promise<void>;
}
export {};
//# sourceMappingURL=SpeechRecognitionManager.d.ts.map