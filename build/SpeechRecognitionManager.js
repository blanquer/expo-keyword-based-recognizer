import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
import { SpeechRecognitionFlow } from './SpeechRecognitionFlow';
import { KeywordRecognizerStateEnum } from './ExpoKeywordBasedRecognizer.types';
export class SpeechRecognitionManager {
    static instance;
    flows = new Map();
    activeFlow = null;
    currentState = { state: KeywordRecognizerStateEnum.IDLE };
    flowCallbacks = new Map();
    constructor() {
        this.setupEventRouting();
    }
    setupEventRouting() {
        // Set up centralized event routing based on flowId
        ExpoKeywordBasedRecognizerModule.addListener('onStateChange', (event) => {
            const { flowId, state } = event;
            console.log('🟣 SpeechRecognitionManager: Received state change event:', event);
            this.currentState = { state }; // Extract just the state
            if (flowId) {
                const callbacks = this.flowCallbacks.get(flowId)?.onStateChange || [];
                console.log(`🟣 SpeechRecognitionManager: Routing to ${callbacks.length} callbacks for flowId: ${flowId}`);
                callbacks.forEach(callback => callback({ state }));
            }
        });
        ExpoKeywordBasedRecognizerModule.addListener('onKeywordDetected', (event) => {
            const { flowId, ...data } = event;
            if (flowId) {
                const callbacks = this.flowCallbacks.get(flowId)?.onKeywordDetected || [];
                callbacks.forEach(callback => callback(data));
            }
        });
        ExpoKeywordBasedRecognizerModule.addListener('onRecognitionResult', (event) => {
            const { flowId, ...data } = event;
            if (flowId) {
                const callbacks = this.flowCallbacks.get(flowId)?.onRecognitionResult || [];
                callbacks.forEach(callback => callback(data));
            }
        });
        ExpoKeywordBasedRecognizerModule.addListener('onError', (event) => {
            const { flowId, ...data } = event;
            const error = new Error(data.message);
            if (flowId) {
                const callbacks = this.flowCallbacks.get(flowId)?.onError || [];
                callbacks.forEach(callback => callback(error));
            }
        });
    }
    static getInstance() {
        if (!SpeechRecognitionManager.instance) {
            SpeechRecognitionManager.instance = new SpeechRecognitionManager();
        }
        return SpeechRecognitionManager.instance;
    }
    registerFlow(flowId) {
        if (this.flows.has(flowId)) {
            throw new Error(`Flow with id "${flowId}" already exists`);
        }
        // Initialize callback arrays for this flow
        this.flowCallbacks.set(flowId, {
            onStateChange: [],
            onKeywordDetected: [],
            onRecognitionResult: [],
            onError: [],
        });
        const flow = new SpeechRecognitionFlow(flowId, this);
        this.flows.set(flowId, flow);
        return flow;
    }
    unregisterFlow(flowId) {
        const flow = this.flows.get(flowId);
        if (!flow)
            return;
        // If this is the active flow, deactivate it
        if (this.activeFlow === flow) {
            flow.deactivate();
            this.activeFlow = null;
        }
        // Callbacks will be cleaned up when we delete from flowCallbacks
        // Remove callback registrations
        this.flowCallbacks.delete(flowId);
        this.flows.delete(flowId);
    }
    getActiveFlow() {
        return this.activeFlow;
    }
    getState() {
        return this.currentState;
    }
    isActive() {
        return this.activeFlow !== null && this.currentState.state !== KeywordRecognizerStateEnum.IDLE;
    }
    async requestPermissions() {
        return ExpoKeywordBasedRecognizerModule.requestPermissionsAsync();
    }
    async getAvailableLanguages() {
        return ExpoKeywordBasedRecognizerModule.getAvailableLanguages();
    }
    // Methods for flows to register callbacks
    registerCallback(flowId, eventType, callback) {
        const flowCallbacks = this.flowCallbacks.get(flowId);
        if (!flowCallbacks) {
            throw new Error(`Flow "${flowId}" not found`);
        }
        flowCallbacks[eventType].push(callback);
        // Return unsubscribe function
        return () => {
            const callbacks = this.flowCallbacks.get(flowId)?.[eventType];
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }
    // Internal method called by flows
    async _activateFlow(flow, options) {
        // If there's an active flow, deactivate it first
        if (this.activeFlow && this.activeFlow !== flow) {
            const previousFlow = this.activeFlow;
            const previousOptions = previousFlow.getOptions();
            // Notify the previous flow it's being taken over
            previousFlow._notifyTakenOver(flow.flowId);
            // Deactivate the current flow
            await previousFlow.deactivate();
            // Call onInterrupted callback if it exists
            if (previousOptions?.onInterrupted) {
                previousOptions.onInterrupted();
            }
        }
        // Update flow state BEFORE activation so it's ready when events arrive
        flow._setActive(true);
        flow._setOptions(options);
        this.activeFlow = flow;
        // Activate the new flow
        const { onInterrupted, ...nativeOptions } = options;
        const activationOptions = {
            ...nativeOptions,
            flowId: flow.flowId
        };
        try {
            await ExpoKeywordBasedRecognizerModule.activate(activationOptions);
        }
        catch (error) {
            // If activation fails, reset the flow state
            flow._setActive(false);
            flow._setOptions(null);
            this.activeFlow = null;
            throw error;
        }
    }
}
//# sourceMappingURL=SpeechRecognitionManager.js.map