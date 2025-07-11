export type OnLoadEventPayload = {
    url: string;
};
export type ExpoKeywordBasedRecognizerModuleEvents = {
    onChange: (params: ChangeEventPayload) => void;
    onStateChange: (state: KeywordRecognizerState) => void;
    onKeywordDetected: (event: KeywordDetectionEvent) => void;
    onRecognitionStart: () => void;
    onRecognitionResult: (result: RecognitionResult) => void;
    onError: (error: Error) => void;
};
export type ChangeEventPayload = {
    value: string;
};
export declare enum KeywordRecognizerStateEnum {
    IDLE = "idle",
    LISTENING_FOR_KEYWORD = "listening_for_keyword",
    RECOGNIZING_SPEECH = "recognizing_speech",
    PROCESSING = "processing"
}
export interface KeywordRecognizerState {
    state: KeywordRecognizerStateEnum;
}
export interface KeywordRecognizerOptions {
    keyword: string | null;
    language?: string;
    maxSilenceDuration?: number;
    soundEnabled?: boolean;
    interimResults?: boolean;
    contextualHints?: string[];
}
export interface RecognitionResult {
    text: string;
    isFinal: boolean;
}
export interface SpeechSegment {
    segment: string;
    startTime: number;
    endTime: number;
    confidence: number;
}
export interface KeywordDetectionEvent {
    keyword: string;
}
export type PermissionStatus = "undetermined" | "denied" | "granted";
export interface PermissionResponse {
    status: PermissionStatus;
    canAskAgain: boolean;
    granted: boolean;
}
export interface Language {
    code: string;
    name: string;
}
//# sourceMappingURL=ExpoKeywordBasedRecognizer.types.d.ts.map