import { SpeechRecognitionManager } from './SpeechRecognitionManager';
declare const _default: SpeechRecognitionManager;
export default _default;
export * from './ExpoKeywordBasedRecognizer.types';
export * from './SpeechRecognitionTypes';
export { SpeechRecognitionManager } from './SpeechRecognitionManager';
export { SpeechRecognitionFlow } from './SpeechRecognitionFlow';
export { useSpeechRecognizerFlow } from './useSpeechRecognizerFlow';
export type { UseSpeechRecognizerFlowOptions, UseSpeechRecognizerFlowReturn } from './useSpeechRecognizerFlow';
export declare const ExpoKeywordBasedRecognizer: {
    [key: string]: any;
    activate(options: import("./ExpoKeywordBasedRecognizer.types").KeywordRecognizerOptions): Promise<void>;
    deactivate(): Promise<void>;
    requestPermissionsAsync(): Promise<import("./ExpoKeywordBasedRecognizer.types").PermissionResponse>;
    getAvailableLanguages(): Promise<import("./ExpoKeywordBasedRecognizer.types").Language[]>;
    ViewPrototypes?: {
        [viewName: string]: object;
    };
    _TEventsMap_DONT_USE_IT?: import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents | undefined;
    addListener<EventName extends keyof import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents>(eventName: EventName, listener: import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents[EventName]): import("expo-modules-core/build/ts-declarations/EventEmitter").EventSubscription;
    removeListener<EventName extends keyof import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents>(eventName: EventName, listener: import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents[EventName]): void;
    removeAllListeners(eventName: keyof import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents): void;
    emit<EventName extends keyof import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents>(eventName: EventName, ...args: Parameters<import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents[EventName]>): void;
    listenerCount<EventName extends keyof import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents>(eventName: EventName): number;
    startObserving?<EventName extends keyof import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents>(eventName: EventName): void;
    stopObserving?<EventName extends keyof import("./ExpoKeywordBasedRecognizer.types").ExpoKeywordBasedRecognizerModuleEvents>(eventName: EventName): void;
};
export declare const getAvailableLanguages: () => Promise<import("./ExpoKeywordBasedRecognizer.types").Language[]>;
export declare const requestPermissionsAsync: () => Promise<import("./ExpoKeywordBasedRecognizer.types").PermissionResponse>;
export declare const activate: (options: import("./ExpoKeywordBasedRecognizer.types").KeywordRecognizerOptions) => Promise<void>;
export declare const deactivate: () => Promise<void>;
//# sourceMappingURL=index.d.ts.map