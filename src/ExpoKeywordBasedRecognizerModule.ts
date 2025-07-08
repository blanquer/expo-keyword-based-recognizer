import { NativeModule, requireNativeModule } from 'expo';

import { ExpoKeywordBasedRecognizerModuleEvents, KeywordRecognizerOptions } from './ExpoKeywordBasedRecognizer.types';

declare class ExpoKeywordBasedRecognizerModule extends NativeModule<ExpoKeywordBasedRecognizerModuleEvents> {
  // hello(): string;
  // setValueAsync(value: string): Promise<void>;

  // Main methods
  activate(options: KeywordRecognizerOptions): Promise<void>;
  deactivate(): Promise<void>;

  // Permission methods
  // requestPermissionsAsync(): Promise<PermissionResponse>;
  // getPermissionsAsync(): Promise<PermissionResponse>;

  // // Event listeners
  // addListener<T extends keyof KeywordBasedRecognizerNativeEventMap>(
  //   eventName: T,
  //   listener: (event: KeywordBasedRecognizerNativeEventMap[T]) => void
  // ): void;

  // removeListeners(count: number): void;
  // removeAllListeners(): void;
}



// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoKeywordBasedRecognizerModule>('ExpoKeywordBasedRecognizer');
