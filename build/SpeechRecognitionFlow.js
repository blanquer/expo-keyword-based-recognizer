import ExpoKeywordBasedRecognizerModule from './ExpoKeywordBasedRecognizerModule';
export class SpeechRecognitionFlow {
    flowId;
    _isActive = false;
    _options = null;
    manager; // Will be typed as SpeechRecognitionManager later
    takenOverCallbacks = [];
    constructor(flowId, manager) {
        this.flowId = flowId;
        this.manager = manager;
    }
    get isActive() {
        return this._isActive;
    }
    async activate(options) {
        // Manager will handle deactivating current flow
        await this.manager._activateFlow(this, options);
    }
    async deactivate() {
        if (!this._isActive)
            return;
        // Deactivate native module
        await ExpoKeywordBasedRecognizerModule.deactivate();
        this._isActive = false;
        this._options = null;
    }
    onStateChange(callback) {
        return this.manager.registerCallback(this.flowId, 'onStateChange', callback);
    }
    onKeywordDetected(callback) {
        return this.manager.registerCallback(this.flowId, 'onKeywordDetected', callback);
    }
    onRecognitionResult(callback) {
        return this.manager.registerCallback(this.flowId, 'onRecognitionResult', callback);
    }
    onError(callback) {
        return this.manager.registerCallback(this.flowId, 'onError', callback);
    }
    onTakenOver(callback) {
        this.takenOverCallbacks.push(callback);
        return () => {
            this.takenOverCallbacks = this.takenOverCallbacks.filter(cb => cb !== callback);
        };
    }
    getOptions() {
        return this._options;
    }
    // Internal methods called by manager
    _setActive(active) {
        this._isActive = active;
    }
    _setOptions(options) {
        this._options = options;
    }
    // Internal method to notify this flow it was taken over
    _notifyTakenOver(newFlowId) {
        this.takenOverCallbacks.forEach(callback => callback(newFlowId));
    }
}
//# sourceMappingURL=SpeechRecognitionFlow.js.map