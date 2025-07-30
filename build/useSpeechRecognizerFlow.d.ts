import { SpeechRecognitionFlow, FlowActivationOptions } from './SpeechRecognitionTypes';
import { KeywordRecognizerState } from './ExpoKeywordBasedRecognizer.types';
export interface UseSpeechRecognizerFlowOptions {
    flowName: string;
    initialKeyword?: string;
    initialLanguage?: string;
    initialSilenceDelay?: number;
    initialKeywordEnabled?: boolean;
    onKeywordDetected?: (keyword: string) => void;
    onRecognitionResult?: (text: string) => void;
    onError?: (error: Error) => void;
    onTakenOver?: (newFlowId: string) => void;
    onStateChange?: (state: KeywordRecognizerState) => void;
}
export interface UseSpeechRecognizerFlowReturn {
    state: KeywordRecognizerState;
    isActive: boolean;
    isListening: boolean;
    detectedKeyword: string | null;
    recognizedText: string | null;
    error: Error | null;
    takenOverBy: string | null;
    keyword: string;
    keywordEnabled: boolean;
    language: string;
    silenceDelay: number;
    setKeyword: (keyword: string) => void;
    setKeywordEnabled: (enabled: boolean) => void;
    setLanguage: (language: string) => void;
    setSilenceDelay: (delay: number) => void;
    startListening: (options?: Partial<FlowActivationOptions>) => Promise<void>;
    stopListening: () => Promise<void>;
    clearResults: () => void;
    flow: SpeechRecognitionFlow | null;
}
export declare function useSpeechRecognizerFlow(options: UseSpeechRecognizerFlowOptions): UseSpeechRecognizerFlowReturn;
//# sourceMappingURL=useSpeechRecognizerFlow.d.ts.map