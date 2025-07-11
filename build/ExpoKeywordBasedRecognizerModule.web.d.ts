import { EventEmitter } from 'expo';
import { ExpoKeywordBasedRecognizerModuleEvents, KeywordRecognizerOptions, Language, PermissionResponse } from './ExpoKeywordBasedRecognizer.types';
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    serviceURI: string;
    grammars: any;
    start(): void;
    stop(): void;
    abort(): void;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: any) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: any) => any) | null;
    onresult: ((this: SpeechRecognition, ev: any) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
}
interface SpeechRecognitionConstructor {
    new (): SpeechRecognition;
}
declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionConstructor;
        webkitSpeechRecognition: SpeechRecognitionConstructor;
    }
}
declare class ExpoKeywordBasedRecognizerModule extends EventEmitter<ExpoKeywordBasedRecognizerModuleEvents> {
    private recognition;
    private isActive;
    private currentState;
    private options;
    private silenceTimer;
    private keywordDetected;
    private transcriptBuffer;
    private speechResults;
    constructor();
    private checkBrowserSupport;
    private getSpeechRecognition;
    private updateState;
    private setupRecognition;
    private handleKeywordDetection;
    private switchToSpeechRecognition;
    private playNotificationSound;
    private processFinalResults;
    private playCompletionSound;
    private startRecognition;
    private cleanup;
    activate(options: KeywordRecognizerOptions): Promise<void>;
    deactivate(): Promise<void>;
    requestPermissionsAsync(): Promise<PermissionResponse>;
    getAvailableLanguages(): Promise<Language[]>;
}
declare const _default: ExpoKeywordBasedRecognizerModule;
export default _default;
//# sourceMappingURL=ExpoKeywordBasedRecognizerModule.web.d.ts.map