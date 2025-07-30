// STRATEGY:
// while keyword, we can do non-continuous recognition
// when we see it, save the "rest" (after keyword) in the buffer
// and restart recognition in continuous mode, under the now "recognizing speech"
// at this point, we keep going until the timeout ... and the result will have a LIST of results
// which we need to concatenate, and add to the potential text in the buffer. That's the final result (and we can do that 
// in the onend handler).
import { EventEmitter } from 'expo';
import { 
  ExpoKeywordBasedRecognizerModuleEvents, 
  KeywordRecognizerOptions, 
  Language, 
  PermissionResponse,
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
  private speechResults: string[] = []; // Store all speech recognition results
  private currentFlowId: string | null = null; // Track current flow ID

  constructor() {
    super();
    // Defer browser support check to avoid accessing window during module initialization
  }

  private checkBrowserSupport(): void {
    if (!this.getSpeechRecognition()) {
      console.warn('Speech recognition is not supported in this browser');
    }
  }

  private getSpeechRecognition(): SpeechRecognitionConstructor | null {
    // Check if we're in a browser environment before accessing window
    if (typeof window === 'undefined') {
      return null;
    }
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  private updateState(newState: KeywordRecognizerStateEnum): void {
    this.currentState = newState;
    console.log(`🟡 Web Speech: Updating state to ${newState}, flowId: ${this.currentFlowId}`);
    
    const eventData: any = { state: newState };
    if (this.currentFlowId) {
      eventData.flowId = this.currentFlowId;
    }
    this.emit('onStateChange', eventData);
  }

  private setupRecognition(): void {
    const SpeechRecognitionClass = this.getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      throw new Error('Speech recognition is not supported in this browser');
    }

    this.recognition = new SpeechRecognitionClass();
    // Set continuous mode based on current state
    this.recognition.continuous = this.currentState === KeywordRecognizerStateEnum.RECOGNIZING_SPEECH;
    this.recognition.interimResults = false; // No interim results needed
    this.recognition.lang = this.options?.language ?? 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('🟢 Web Speech: Recognition started');
      const eventData: any = {};
      if (this.currentFlowId) {
        eventData.flowId = this.currentFlowId;
      }
      this.emit('onRecognitionStart', eventData);
    };

    this.recognition.onresult = (event: any) => {
      const results = event.results;
      
      console.log(`🟢 Web Speech: Received ${results.length} results`);
      for (let i = 0; i < results.length; i++) {
        console.log(` - ${i}: "${results[i][0].transcript}" (final: ${results[i].isFinal})`);
      }

      if (this.currentState === KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD) {
        // For keyword detection, we only need the last result
        const lastResult = results[results.length - 1];
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        this.handleKeywordDetection(transcript);
      } else if (this.currentState === KeywordRecognizerStateEnum.RECOGNIZING_SPEECH) {
        // Restart silence timer 
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        const delay = this.options?.maxSilenceDuration;
        console.log(`[${new Date().toISOString()}] 🟢 Web Speech: RESTARTING TIMER on speech received for `, delay);
        this.silenceTimer = window.setTimeout(() => {
          console.log(`[${new Date().toISOString()}] 🟡 Web Speech: Silence timeout reached`, delay);
          if (this.recognition) {
            this.recognition.stop();
          }
        }, delay);

        // JOSEP: Should we not save anything? if it's continuous...I think we'll get the all at the end?
        // For speech recognition, collect all final results
        this.speechResults = []; // Reset results for new recognition session
        for (let i = 0; i < results.length; i++) {
          if (results[i].isFinal) {
            const transcript = results[i][0].transcript.trim();
            this.speechResults.push(transcript);
            console.log(`🟢 Web Speech: Added to speech results: "${transcript}"`);
          }
        }
      }
    };

    this.recognition.onerror = (event: any) => {
      if( event.error === 'no-speech' && this.speechResults.length === 0) {
        // No speech detected and no results.
        // unless we were already after recognizing the keyword, we want to continue listening in...
        if ( this.options?.keyword && this.keywordDetected) {
          // If we were recognizing speech, we can consider it a no-speech event?
          this.processFinalResults();
          return
        }else{
          // We need to continue listening for the keyword
          console.log('🟢 Web Speech: Restarting recognition since we do not even have the keyword!!!!!!!!!!!!!!!!!!');
          this.recognition?.abort()
          return
        }

      }
      console.error(`🔴 Web Speech: Recognition error: ${event.error} (results: ${this.speechResults})`);
      if( event.error === 'no-speech' && this.speechResults.length > 0) {
        // Empty last result, but we have some speech results
        console.log('🔴 Web Speech: No speech detected, but we have results ')
        this.processFinalResults();
      }else{
        const eventData: any = {
          message: `Speech recognition error: ${event.error}`,
          code: 0
        };
        if (this.currentFlowId) {
          eventData.flowId = this.currentFlowId;
        }
        this.emit('onError', eventData);
      }
    };

    this.recognition.onend = () => {
      console.log(`🟡 Web Speech: Recognition ended for ${this.currentState}`, this.currentState, this.keywordDetected);
      if( this.currentState === KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD && this.keywordDetected) {
        // pickup the fact that we just finished detecting the keyword, therefor transition to recognizing speech
        this.updateState(KeywordRecognizerStateEnum.RECOGNIZING_SPEECH);
        this.startRecognition();
        return
      }

      if (this.currentState === KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD) {
        // For keyword detection, restart recognition if still active
        if (this.isActive && !this.keywordDetected) {
          setTimeout(() => {
            if (this.isActive) {
              // console.log('🟢 Web Speech: Restarting recognition for keyword detection !!!!!!!!!!!!!!!!!!!!!!!');
              this.startRecognition();
            }
          }, 100);
        }
      } else if (this.currentState === KeywordRecognizerStateEnum.RECOGNIZING_SPEECH) {
        // For speech recognition, process final results
        this.processFinalResults();
      }
    };
  }

  private handleKeywordDetection(transcript: string): void {
    const keyword = this.options?.keyword?.toLowerCase();
    
    if (!keyword) {
      // No keyword specified, immediately switch to speech recognition
      this.keywordDetected = true;
      this.switchToSpeechRecognition('');
      return;
    }

    if (transcript.includes(keyword)) {
      console.log(`🟢 Web Speech: Keyword "${keyword}" detected!`);
      this.keywordDetected = true;
      
      // Extract text after keyword and save to buffer
      const keywordIndex = transcript.indexOf(keyword);
      const afterKeyword = transcript.substring(keywordIndex + keyword.length).trim();
      
      this.switchToSpeechRecognition(afterKeyword);
    }
  }

  private switchToSpeechRecognition(initialText: string): void {
    this.transcriptBuffer = initialText;
    this.speechResults = [];
    // this.updateState(KeywordRecognizerStateEnum.RECOGNIZING_SPEECH);
    
    const eventData: any = { 
      keyword: this.options?.keyword || '',
      timestamp: Date.now()
    };
    if (this.currentFlowId) {
      eventData.flowId = this.currentFlowId;
    }
    this.emit('onKeywordDetected', eventData);
    
    // Play sound notification if enabled
    if (this.options?.soundEnabled !== false) {
      this.playNotificationSound();
    }
    
    // Stop current recognition and restart in continuous mode
    if (this.recognition) {
      // Reset any existing silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      this.recognition.stop();
      // Recognition will restart in continuous mode via onend handler
    }
  }

  private playNotificationSound(): void {
    // Create and play a notification sound using Web Audio API (similar to iOS 1113)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for the main tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure the sound - higher pitch like iOS begin recording
    oscillator.frequency.value = 1047; // C6 note
    oscillator.type = 'sine';
    
    // Create envelope for the sound - quick attack, short duration
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4, now + 0.005); // Quick attack
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.03); // Slight decay
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1); // Quick release
    
    // Play the sound
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  private processFinalResults(): void {
    // Concatenate all speech results
    const speechText = this.speechResults.join(' ').trim();
    
    // Combine with buffer text from keyword detection
    const finalText = this.transcriptBuffer ? 
      `${this.transcriptBuffer} ${speechText}`.trim() : 
      speechText;
    
    console.log(`🟢 Web Speech: Final result - buffer: "${this.transcriptBuffer}", speech: "${speechText}", combined: "${finalText}"`);
    
    // Play completion sound if enabled
    if (this.options?.soundEnabled !== false) {
      this.playCompletionSound();
    }
    
    const eventData: any = {
      text: finalText,
      isFinal: true
    };
    if (this.currentFlowId) {
      eventData.flowId = this.currentFlowId;
    }

    this.emit('onRecognitionResult', eventData);
    this.cleanup();
  }

  private playCompletionSound(): void {
    // Create and play a completion sound using Web Audio API (similar to iOS 1114)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for the main tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure the sound - lower frequency for completion like iOS end recording
    oscillator.frequency.value = 523; // C5 note (octave lower than start)
    oscillator.type = 'sine';
    
    // Create envelope for the sound - softer attack, slightly longer
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // Softer attack
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05); // Gentle sustain
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12); // Smooth release
    
    // Play the sound
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  }


  private startRecognition(): void {
    if (!this.recognition) return;
    
    // Update continuous mode based on current state
    this.recognition.continuous = this.currentState === KeywordRecognizerStateEnum.RECOGNIZING_SPEECH;
    
    try {
      this.recognition.start();
      
      // Set silence timer for speech recognition mode
      if (this.currentState === KeywordRecognizerStateEnum.RECOGNIZING_SPEECH) {
        // if we have somethin in the buffer already, we do normal silence delay, if we have nothing, we wait longer
        const conditionalDelay = this.transcriptBuffer.length > 0 ? this.options?.maxSilenceDuration : 10000;
        console.log(`[${new Date().toISOString()}] 🟢 Web Speech: Starting TIMER on StartRecognition for `, conditionalDelay);
        this.silenceTimer = window.setTimeout(() => {
            console.log(`[${new Date().toISOString()}] 🟡 Web Speech: Silence timeout reached`, conditionalDelay);
          if (this.recognition) {
            this.recognition.stop();
          }
        }, conditionalDelay);
      }
    } catch (error) {
      console.error('🔴 Web Speech: Error starting recognition:', error);
      // Recognition might already be running, ignore the error
    }
  }

  private cleanup(): void {
    this.keywordDetected = false;
    this.transcriptBuffer = '';
    this.speechResults = [];
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.updateState(KeywordRecognizerStateEnum.IDLE);
    this.isActive = false;
    this.currentFlowId = null;
    
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  // Public API methods
  async activate(options: KeywordRecognizerOptions & { flowId?: string }): Promise<void> {
    console.log('🔴 Web Speech: Activating with options:', options);
    
    // Check browser support when actually using the module, and not building
    this.checkBrowserSupport();    
    this.options = options;
    this.currentFlowId = options.flowId || 'unknown';
    this.isActive = true;
    this.keywordDetected = false;
    this.transcriptBuffer = '';
    this.speechResults = [];

    // Check for empty keyword
    if (options.keyword !== null && options.keyword !== undefined && options.keyword.trim() === '') {
      throw new Error('Keyword cannot be empty');
    }

    // Set initial state based on keyword presence
    if (options.keyword) {
      this.updateState(KeywordRecognizerStateEnum.LISTENING_FOR_KEYWORD);
    } else {
      this.updateState(KeywordRecognizerStateEnum.RECOGNIZING_SPEECH);
    }
    
    this.setupRecognition();
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