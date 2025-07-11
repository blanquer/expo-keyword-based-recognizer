import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
export default ExpoKeywordBasedRecognizerModule;
export * from './ExpoKeywordBasedRecognizer.types';
export declare const getAvailableLanguages: () => Promise<import("./ExpoKeywordBasedRecognizer.types").Language[]>;
export declare const requestPermissionsAsync: () => Promise<import("./ExpoKeywordBasedRecognizer.types").PermissionResponse>;
export declare const activate: (options: import("./ExpoKeywordBasedRecognizer.types").KeywordRecognizerOptions) => Promise<void>;
export declare const deactivate: () => Promise<void>;
//# sourceMappingURL=index.d.ts.map