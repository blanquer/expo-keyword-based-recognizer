import { EventEmitter } from 'expo';
import { 
  ExpoKeywordBasedRecognizerModuleEvents, 
  KeywordRecognizerOptions, 
  Language, 
  PermissionResponse,
  RecognitionResult,
  KeywordRecognizerStateEnum
} from './ExpoKeywordBasedRecognizer.types';

// Web Speech API types
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

// Use the same enum as the native implementation

class ExpoKeywordBasedRecognizerModule extends EventEmitter<ExpoKeywordBasedRecognizerModuleEvents> {
  private recognition: SpeechRecognition | null = null;
  private isActive = false;
  private currentState = KeywordRecognizerStateEnum.IDLE;
  private options: KeywordRecognizerOptions | null = null;
  private silenceTimer: number | null = null;
  private keywordDetected = false;
  private transcriptBuffer = '';

  constructor() {
    super();
    this.checkBrowserSupport();
  }

  private checkBrowserSupport(): void {
    if (!this.getSpeechRecognition()) {
      console.warn('Speech recognition is not supported in this browser');
    }
  }

  private getSpeechRecognition(): SpeechRecognitionConstructor | null {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  private updateState(newState: KeywordRecognizerStateEnum): void {
    this.currentState = newState;
    this.emit('onStateChange', { state: newState });
  }

  private setupRecognition(): void {
    const SpeechRecognitionClass = this.getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = this.options?.interimResults ?? true;
    this.recognition.lang = this.options?.language ?? 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('🟢 Web Speech: Recognition started');
      this.emit('onRecognitionStart');
    };

    this.recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      const transcript = lastResult[0].transcript.toLowerCase().trim();
      
      console.log(`🟢 Web Speech: Received transcript: "${transcript}" (final: ${lastResult.isFinal})`);

      if (this.currentState === KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD) {
        this.handleKeywordDetection(transcript, lastResult.isFinal);
      } else if (this.currentState === KeywordRecognizerStateEnum.RECOGNIZING_SPEECH) {
        this.handleSpeechRecognition(transcript, lastResult.isFinal);
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('🔴 Web Speech: Recognition error:', event.error);
      this.emit('onError', new Error(`Speech recognition error: ${event.error}`));
    };

    this.recognition.onend = () => {
      console.log('🟡 Web Speech: Recognition ended');
      if (this.isActive && this.currentState !== KeywordRecognizerStateEnum.IDLE) {
        // Restart recognition if we're still supposed to be active
        setTimeout(() => {
          if (this.isActive) {
            this.startRecognition();
          }
        }, 100);
      }
    };
  }

  private handleKeywordDetection(transcript: string, isFinal: boolean): void {
    const keyword = this.options?.keyword?.toLowerCase();
    
    if (!keyword) {
      // No keyword specified, immediately switch to speech recognition
      this.keywordDetected = true;
      this.updateState(KeywordRecognizerStateEnum.RECOGNIZING_SPEECH);
      this.emit('onKeywordDetected', { keyword: '' });
      return;
    }

    if (transcript.includes(keyword)) {
      console.log(`🟢 Web Speech: Keyword "${keyword}" detected!`);
      this.keywordDetected = true;
      this.updateState(KeywordRecognizerStateEnum.RECOGNIZING_SPEECH);
      this.emit('onKeywordDetected', { keyword });
      
      // Extract text after keyword for speech recognition
      const keywordIndex = transcript.indexOf(keyword);
      const afterKeyword = transcript.substring(keywordIndex + keyword.length).trim();
      if (afterKeyword) {
        this.transcriptBuffer = afterKeyword;
      }
    }
  }

  private handleSpeechRecognition(transcript: string, isFinal: boolean): void {
    if (!this.keywordDetected) return;

    // Clear silence timer on new speech
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    // Process the transcript
    let processedText = transcript;
    
    // If we have a keyword, try to extract text after it
    if (this.options?.keyword) {
      const keyword = this.options.keyword.toLowerCase();
      const keywordIndex = transcript.indexOf(keyword);
      if (keywordIndex >= 0) {
        processedText = transcript.substring(keywordIndex + keyword.length).trim();
      }
    }

    // Add buffered text from keyword detection
    if (this.transcriptBuffer) {
      processedText = this.transcriptBuffer + ' ' + processedText;
      this.transcriptBuffer = '';
    }

    const result: RecognitionResult = {
      text: processedText.trim(),
      isFinal
    };

    this.emit('onRecognitionResult', result);

    if (isFinal) {
      this.cleanup();
    } else {
      // Set silence timer for interim results
      const silenceDelay = this.options?.maxSilenceDuration ?? 2000;
      this.silenceTimer = window.setTimeout(() => {
        console.log('🟡 Web Speech: Silence timeout reached');
        this.cleanup();
      }, silenceDelay);
    }
  }

  private startRecognition(): void {
    if (!this.recognition) return;
    
    try {
      this.recognition.start();
    } catch (error) {
      console.error('🔴 Web Speech: Error starting recognition:', error);
      // Recognition might already be running, ignore the error
    }
  }

  private cleanup(): void {
    this.keywordDetected = false;
    this.transcriptBuffer = '';
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.updateState(KeywordRecognizerStateEnum.IDLE);
    this.isActive = false;
    
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  // Public API methods
  async activate(options: KeywordRecognizerOptions): Promise<void> {
    console.log('🔴 Web Speech: Activating with options:', options);
    
    this.options = options;
    this.isActive = true;
    this.keywordDetected = false;
    this.transcriptBuffer = '';

    // Check for empty keyword
    if (options.keyword !== null && options.keyword !== undefined && options.keyword.trim() === '') {
      throw new Error('Keyword cannot be empty');
    }

    this.setupRecognition();
    
    // Set initial state based on keyword presence
    if (options.keyword) {
      this.updateState(KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD);
    } else {
      this.updateState(KeywordRecognizerStateEnum.RECOGNIZING_SPEECH);
    }
    
    this.startRecognition();
  }

  async deactivate(): Promise<void> {
    console.log('🟡 Web Speech: Deactivating');
    this.cleanup();
  }

  async requestPermissionsAsync(): Promise<PermissionResponse> {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      return {
        status: 'granted',
        granted: true,
        canAskAgain: true
      };
    } catch (error) {
      console.error('🔴 Web Speech: Permission denied:', error);
      return {
        status: 'denied',
        granted: false,
        canAskAgain: true
      };
    }
  }

  async getAvailableLanguages(): Promise<Language[]> {
    // Common languages supported by most browsers
    const commonLanguages: Language[] = [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'es-ES', name: 'Spanish (Spain)' },
      { code: 'es-MX', name: 'Spanish (Mexico)' },
      { code: 'fr-FR', name: 'French (France)' },
      { code: 'fr-CA', name: 'French (Canada)' },
      { code: 'de-DE', name: 'German (Germany)' },
      { code: 'it-IT', name: 'Italian (Italy)' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'ko-KR', name: 'Korean' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)' },
      { code: 'ru-RU', name: 'Russian' },
      { code: 'ar-SA', name: 'Arabic (Saudi Arabia)' },
      { code: 'hi-IN', name: 'Hindi (India)' },
      { code: 'th-TH', name: 'Thai' },
      { code: 'pl-PL', name: 'Polish' },
      { code: 'nl-NL', name: 'Dutch (Netherlands)' },
      { code: 'sv-SE', name: 'Swedish' },
      { code: 'da-DK', name: 'Danish' },
      { code: 'no-NO', name: 'Norwegian' },
      { code: 'fi-FI', name: 'Finnish' },
      { code: 'tr-TR', name: 'Turkish' },
      { code: 'he-IL', name: 'Hebrew' },
      { code: 'cs-CZ', name: 'Czech' },
      { code: 'hu-HU', name: 'Hungarian' },
      { code: 'ro-RO', name: 'Romanian' },
      { code: 'sk-SK', name: 'Slovak' },
      { code: 'bg-BG', name: 'Bulgarian' },
      { code: 'hr-HR', name: 'Croatian' },
      { code: 'uk-UA', name: 'Ukrainian' },
    ];

    return commonLanguages.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default new ExpoKeywordBasedRecognizerModule();