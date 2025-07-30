import { useEffect, useRef, useState, useCallback } from 'react';
import SpeechRecognitionManager from './index';
import { KeywordRecognizerStateEnum } from './ExpoKeywordBasedRecognizer.types';
export function useSpeechRecognizerFlow(options) {
    const { flowName, initialKeyword = '', initialLanguage = 'en-US', initialSilenceDelay = 2000, initialKeywordEnabled = true, onKeywordDetected: onKeywordDetectedCallback, onRecognitionResult: onRecognitionResultCallback, onError: onErrorCallback, onTakenOver: onTakenOverCallback, onStateChange: onStateChangeCallback, } = options;
    // Flow instance
    const flowRef = useRef(null);
    // State management
    const [state, setState] = useState({ state: KeywordRecognizerStateEnum.IDLE });
    const [isActive, setIsActive] = useState(false);
    const [detectedKeyword, setDetectedKeyword] = useState(null);
    const [recognizedText, setRecognizedText] = useState(null);
    const [error, setError] = useState(null);
    const [takenOverBy, setTakenOverBy] = useState(null);
    // Configuration state
    const [keyword, setKeyword] = useState(initialKeyword);
    const [keywordEnabled, setKeywordEnabled] = useState(initialKeywordEnabled);
    const [language, setLanguage] = useState(initialLanguage);
    const [silenceDelay, setSilenceDelay] = useState(initialSilenceDelay);
    // Computed properties
    const isListening = isActive && state.state !== KeywordRecognizerStateEnum.IDLE;
    // Initialize flow and set up event listeners
    useEffect(() => {
        const flow = SpeechRecognitionManager.registerFlow(flowName);
        flowRef.current = flow;
        // Set up event listeners
        const unsubscribeState = flow.onStateChange((newState) => {
            setState(newState);
            setIsActive(flow.isActive);
            onStateChangeCallback?.(newState);
        });
        const unsubscribeKeyword = flow.onKeywordDetected((event) => {
            setDetectedKeyword(event.keyword);
            onKeywordDetectedCallback?.(event.keyword);
        });
        const unsubscribeResult = flow.onRecognitionResult((result) => {
            setRecognizedText(result.text);
            onRecognitionResultCallback?.(result.text);
        });
        const unsubscribeError = flow.onError((err) => {
            setError(err);
            onErrorCallback?.(err);
        });
        const unsubscribeTakenOver = flow.onTakenOver((newFlowId) => {
            // Reset state when taken over
            setState({ state: KeywordRecognizerStateEnum.IDLE });
            setDetectedKeyword(null);
            setRecognizedText(null);
            setError(null);
            setTakenOverBy(newFlowId);
            onTakenOverCallback?.(newFlowId);
        });
        // Cleanup
        return () => {
            if (flowRef.current) {
                flowRef.current.deactivate();
                SpeechRecognitionManager.unregisterFlow(flowName);
            }
            unsubscribeState();
            unsubscribeKeyword();
            unsubscribeResult();
            unsubscribeError();
            unsubscribeTakenOver();
        };
    }, [flowName]); // Only re-run if flowName changes
    // Actions
    const startListening = useCallback(async (overrideOptions) => {
        if (!flowRef.current) {
            console.error('Flow not initialized');
            return;
        }
        try {
            // Clear previous results
            setDetectedKeyword(null);
            setRecognizedText(null);
            setError(null);
            setTakenOverBy(null);
            const activationOptions = {
                keyword: keywordEnabled ? keyword : null,
                language,
                maxSilenceDuration: silenceDelay,
                soundEnabled: true,
                interimResults: true,
                contextualHints: [],
                ...overrideOptions, // Allow override of any option
            };
            await flowRef.current.activate(activationOptions);
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onErrorCallback?.(error);
        }
    }, [keyword, keywordEnabled, language, silenceDelay, onErrorCallback]);
    const stopListening = useCallback(async () => {
        if (!flowRef.current) {
            console.error('Flow not initialized');
            return;
        }
        try {
            await flowRef.current.deactivate();
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onErrorCallback?.(error);
        }
    }, [onErrorCallback]);
    const clearResults = useCallback(() => {
        setDetectedKeyword(null);
        setRecognizedText(null);
        setError(null);
        setTakenOverBy(null);
    }, []);
    return {
        // State
        state,
        isActive,
        isListening,
        detectedKeyword,
        recognizedText,
        error,
        takenOverBy,
        // Configuration
        keyword,
        keywordEnabled,
        language,
        silenceDelay,
        // Configuration setters
        setKeyword,
        setKeywordEnabled,
        setLanguage,
        setSilenceDelay,
        // Actions
        startListening,
        stopListening,
        clearResults,
        // Flow instance
        flow: flowRef.current,
    };
}
//# sourceMappingURL=useSpeechRecognizerFlow.js.map