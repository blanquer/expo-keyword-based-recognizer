import { SpeechRecognitionFlow as ISpeechRecognitionFlow, FlowActivationOptions } from './SpeechRecognitionTypes';
import { KeywordRecognizerState, KeywordDetectionEvent, RecognitionResult } from './ExpoKeywordBasedRecognizer.types';
export declare class SpeechRecognitionFlow implements ISpeechRecognitionFlow {
    readonly flowId: string;
    private _isActive;
    private _options;
    private manager;
    private takenOverCallbacks;
    constructor(flowId: string, manager: any);
    get isActive(): boolean;
    activate(options: FlowActivationOptions): Promise<void>;
    deactivate(): Promise<void>;
    onStateChange(callback: (state: KeywordRecognizerState) => void): () => void;
    onKeywordDetected(callback: (event: KeywordDetectionEvent) => void): () => void;
    onRecognitionResult(callback: (result: RecognitionResult) => void): () => void;
    onError(callback: (error: Error) => void): () => void;
    onTakenOver(callback: (newFlowId: string) => void): () => void;
    getOptions(): FlowActivationOptions | null;
    _setActive(active: boolean): void;
    _setOptions(options: FlowActivationOptions | null): void;
    _notifyTakenOver(newFlowId: string): void;
}
//# sourceMappingURL=SpeechRecognitionFlow.d.ts.map