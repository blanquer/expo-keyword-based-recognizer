import AVFoundation
import Foundation
import Speech

// MARK: - Timestamped Audio Buffer
struct TimestampedAudioBuffer {
  let audioData: AVAudioPCMBuffer
  let absoluteTimestamp: CFAbsoluteTime
  let bufferDuration: TimeInterval

  init(audioData: AVAudioPCMBuffer, absoluteTimestamp: CFAbsoluteTime) {
    self.audioData = audioData
    self.absoluteTimestamp = absoluteTimestamp
    self.bufferDuration = Double(audioData.frameLength) / audioData.format.sampleRate
  }
}

// MARK: - Circular Audio Buffer
class CircularAudioBuffer {
  private var buffers: [TimestampedAudioBuffer] = []
  private let maxDuration: TimeInterval = 5.0  // 5 seconds
  private let queue = DispatchQueue(label: "circular.audio.buffer", qos: .userInitiated)

  func append(_ buffer: TimestampedAudioBuffer) {
    queue.async { [weak self] in
      guard let self = self else { return }

      self.buffers.append(buffer)

      // Remove old buffers beyond maxDuration
      let currentTime = CFAbsoluteTimeGetCurrent()
      self.buffers.removeAll { currentTime - $0.absoluteTimestamp > self.maxDuration }
    }
  }

  func getAudioFrom(_ timestamp: CFAbsoluteTime, maxDuration: TimeInterval = 0.5)
    -> [AVAudioPCMBuffer]
  {
    return queue.sync { [weak self] in
      guard let self = self else { return [] }

      var result: [AVAudioPCMBuffer] = []
      let currentTime = CFAbsoluteTimeGetCurrent()
      let maxEndTime = timestamp + maxDuration  // Only get audio for maxDuration after timestamp

      print("🟡 Searching for audio from \(timestamp) to \(maxEndTime) (\(maxDuration)s window)")
      print("🟡 Available buffers: \(self.buffers.count)")

      for (index, buffer) in self.buffers.enumerated() {
        let bufferStart = buffer.absoluteTimestamp
        let bufferEnd = bufferStart + buffer.bufferDuration

        // Skip buffers that end before our timestamp
        if bufferEnd < timestamp {
          continue
        }

        // Skip buffers that start after our max end time
        if bufferStart > maxEndTime {
          break
        }

        print("🟡 Processing buffer \(index): \(bufferStart) - \(bufferEnd)")

        if timestamp >= bufferStart && timestamp <= bufferEnd {
          // Found the buffer containing our timestamp
          let offsetTime = timestamp - bufferStart
          let sampleOffset = Int(offsetTime * buffer.audioData.format.sampleRate)

          print("🟡 Found matching buffer at index \(index), offset: \(sampleOffset)")

          if let trimmedBuffer = self.extractSamplesFrom(
            buffer.audioData, startingSample: sampleOffset)
          {
            result.append(trimmedBuffer)
          }
        } else if bufferStart >= timestamp && bufferStart < maxEndTime {
          // This buffer starts after our timestamp but within our window
          result.append(buffer.audioData)
        }
      }

      print("🟡 Returning \(result.count) audio buffers for replay (\(maxDuration)s window)")
      return result
    }
  }

  private func extractSamplesFrom(_ buffer: AVAudioPCMBuffer, startingSample: Int)
    -> AVAudioPCMBuffer?
  {
    guard startingSample >= 0 && startingSample < buffer.frameLength else { return buffer }

    let remainingSamples = buffer.frameLength - AVAudioFrameCount(startingSample)
    guard
      let newBuffer = AVAudioPCMBuffer(pcmFormat: buffer.format, frameCapacity: remainingSamples)
    else { return nil }

    newBuffer.frameLength = remainingSamples

    // Copy audio data from the offset position
    if let sourceData = buffer.floatChannelData,
      let destData = newBuffer.floatChannelData
    {
      for channel in 0..<Int(buffer.format.channelCount) {
        let sourcePtr = sourceData[channel].advanced(by: startingSample)
        let destPtr = destData[channel]
        destPtr.update(from: sourcePtr, count: Int(remainingSamples))
      }
    }

    return newBuffer
  }
}

// MARK: - Recognition State
private enum RecognitionPhase {
  case listeningForWakeWord
  case recognizingSpeech
  case idle
}

class ExpoKeywordBasedRecognizer: NSObject {
  weak var delegate: ExpoKeywordBasedRecognizerDelegate?

  private let keyword: String?
  private let language: String
  var maxSilenceDuration: TimeInterval

  private let soundEnabled: Bool
  private let soundUri: String?
  private let contextualHints: [String]
  private let initializeAudioSession: Bool

  private var speechRecognizer: SFSpeechRecognizer?
  private var wakeWordRecognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var wakeWordRecognitionTask: SFSpeechRecognitionTask?
  private var sentenceRecognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var sentenceRecognitionTask: SFSpeechRecognitionTask?
  private let audioEngine = AVAudioEngine()
  private var audioPlayer: AVAudioPlayer?

  // Enhanced wake word detection components
  private let circularBuffer = CircularAudioBuffer()
  private var recognitionStartTime: CFAbsoluteTime = 0
  private var recognitionPhase: RecognitionPhase = .idle
  private var silenceTimer: Timer?
  private var hasActiveTap = false

  // Accumulated results for final processing
  private var speechResults: [SFSpeechRecognitionResult] = []
  private var lastMeaningfulResult: SFSpeechRecognitionResult?
  private var lastFilteredMeaningfulText: String?

  // Final-partial results accumulation for continuous transcription (iOS 18 fix)
  private var finalPartialResults: [SFSpeechRecognitionResult] = []
  private var accumulatedTranscription = ""

  init(
    keyword: String?,
    language: String,
    maxSilenceDuration: TimeInterval,
    soundEnabled: Bool,
    soundUri: String?,
    contextualHints: [String],
    initializeAudioSession: Bool = false
  ) {

    self.keyword = keyword?.lowercased()
    self.language = language
    self.maxSilenceDuration = maxSilenceDuration
    self.soundEnabled = soundEnabled
    self.soundUri = soundUri
    self.contextualHints = contextualHints
    self.initializeAudioSession = initializeAudioSession

    super.init()

    setupSpeechRecognizer()
    setupAudioPlayer()
  }

  private func setupSpeechRecognizer() {
    speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: language))

    if speechRecognizer?.isAvailable == false {
      print("!!!!!!!!!!!!!!!!!!!!!!RecognizerError.Recognizer not available for: \(language)")
    }

    speechRecognizer?.defaultTaskHint = .dictation
  }

  private func setupAudioPlayer() {
    guard soundEnabled else { return }

    if let soundUri = soundUri, let url = URL(string: soundUri) {
      do {
        audioPlayer = try AVAudioPlayer(contentsOf: url)
        audioPlayer?.prepareToPlay()
      } catch {
        print("Failed to load custom sound: \(error)")
      }
    }
  }

  func start() async throws {
    print("🟢 KeywordRecognizer: start() called")

    guard let speechRecognizer = speechRecognizer, speechRecognizer.isAvailable else {
      print("🔴 KeywordRecognizer: Speech recognizer unavailable!")
      throw RecognizerError.speechRecognitionUnavailable
    }

    print("🟢 KeywordRecognizer: Speech recognizer available, starting audio engine...")
    try startAudioEngine()

    print("🟢 KeywordRecognizer: Audio engine started, starting wake word detection...")
    startWakeWordDetection()

    print("🟢 KeywordRecognizer: start() completed successfully")
  }

  func stop() async {
    print("🟡 KeywordRecognizer: stop() called")

    audioEngine.stop()
    cleanupRecognition()
    recognitionPhase = .idle
  }

  private func cleanupRecognition() {
    wakeWordRecognitionTask?.cancel()

    if hasActiveTap {
      audioEngine.inputNode.removeTap(onBus: 0)
      hasActiveTap = false
    }

    silenceTimer?.invalidate()
    silenceTimer = nil
    wakeWordRecognitionRequest = nil
    wakeWordRecognitionTask = nil
    sentenceRecognitionRequest = nil
    sentenceRecognitionTask = nil
    speechResults.removeAll()
    lastMeaningfulResult = nil
    lastFilteredMeaningfulText = nil

    // Clean up final-partial results
    finalPartialResults.removeAll()
    accumulatedTranscription = ""

    recognitionPhase = .idle
  }

  private func startAudioEngine() throws {
    // Only initialize the audio session if explicitly requested
    if initializeAudioSession {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(
        .playAndRecord, mode: .default,
        options: [
          .allowBluetoothA2DP, .allowBluetooth, AVAudioSession.CategoryOptions.allowAirPlay,
          .defaultToSpeaker, .duckOthers, .overrideMutedMicrophoneInterruption,
        ])
      try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
    }

    let inputNode = audioEngine.inputNode
    let recordingFormat = inputNode.outputFormat(forBus: 0)

    // Install continuous audio tap
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) {
      [weak self] buffer, time in
      guard let self = self else { return }

      // Always add to circular buffer
      let timestampedBuffer = TimestampedAudioBuffer(
        audioData: buffer,
        absoluteTimestamp: CFAbsoluteTimeGetCurrent()
      )
      self.circularBuffer.append(timestampedBuffer)

      // Feed to current recognition request if active
      // Feed to active recognition request based on current phase
      if self.recognitionPhase == .listeningForWakeWord {
        self.wakeWordRecognitionRequest?.append(buffer)
      } else if self.recognitionPhase == .recognizingSpeech {
        self.sentenceRecognitionRequest?.append(buffer)
      }
    }
    hasActiveTap = true

    audioEngine.prepare()
    try audioEngine.start()
  }

  private func startWakeWordDetection() {
    recognitionPhase = keyword != nil ? .listeningForWakeWord : .recognizingSpeech

    if recognitionPhase == .listeningForWakeWord {
      startWakeWordRecognition()
    } else {
      startSentenceRecognition()
    }
  }

  private func startWakeWordRecognition() {
    guard let speechRecognizer = speechRecognizer else { return }

    print("🟢 KeywordRecognizer: Starting wake word recognition")

    // Clean up any existing wake word recognition
    wakeWordRecognitionTask?.cancel()

    // Create wake word recognition request
    let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    recognitionRequest.shouldReportPartialResults = true
    recognitionRequest.requiresOnDeviceRecognition = false

    // Add wake word and contextual hints for wake word detection
    if let keyword = keyword {
      recognitionRequest.contextualStrings = [keyword] + contextualHints
    } else {
      recognitionRequest.contextualStrings = contextualHints
    }

    wakeWordRecognitionRequest = recognitionRequest
    recognitionStartTime = CFAbsoluteTimeGetCurrent()

    // Start wake word recognition task
    wakeWordRecognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) {
      [weak self] result, error in
      guard let self = self else { return }

      DispatchQueue.main.async {
        self.handleWakeWordRecognitionResult(result: result, error: error)
      }
    }

    print("🟢 KeywordRecognizer: Wake word recognition started")
  }

  private func startSentenceRecognition() {
    guard let speechRecognizer = speechRecognizer else { return }

    print("🟢 KeywordRecognizer: Starting sentence recognition")

    // Clean up any existing sentence recognition
    sentenceRecognitionTask?.cancel()

    // Create sentence recognition request
    let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    recognitionRequest.shouldReportPartialResults = true
    recognitionRequest.requiresOnDeviceRecognition = false
    recognitionRequest.contextualStrings = contextualHints

    sentenceRecognitionRequest = recognitionRequest
    recognitionStartTime = CFAbsoluteTimeGetCurrent()

    // Start sentence recognition task
    sentenceRecognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) {
      [weak self] result, error in
      guard let self = self else { return }

      DispatchQueue.main.async {
        self.handleSentenceRecognitionResult(result: result, error: error)
      }
    }

    print("🟢 KeywordRecognizer: Sentence recognition started")
  }

  private func handleWakeWordRecognitionResult(result: SFSpeechRecognitionResult?, error: Error?) {
    if let error = error {
      // Only handle errors if we're not idle (avoid handling errors from canceled tasks)
      if recognitionPhase != .idle {
        delegate?.recognitionError(error)
      }
      return
    }

    guard let result = result else { return }

    let transcript = result.bestTranscription.formattedString.lowercased()
    print("🟢 KeywordRecognizer: Wake word result: \(transcript)")

    // Only process wake word detection if we're still in the right phase
    if recognitionPhase == .listeningForWakeWord {
      checkForWakeWord(in: result)
    }
  }

  private func handleSentenceRecognitionResult(result: SFSpeechRecognitionResult?, error: Error?) {
    if let error = error {
      // Only handle errors if we're not idle (avoid handling errors from canceled tasks)
      if recognitionPhase != .idle {
        delegate?.recognitionError(error)
      }
      return
    }

    guard let result = result else { return }

    let transcript = result.bestTranscription.formattedString
    print("🟢 KeywordRecognizer: Sentence result: \(transcript)")

    // Only process sentence recognition if we're still in the right phase
    if recognitionPhase == .recognizingSpeech {
      processContinuousTranscription(result: result)
    }
  }

  private func checkForWakeWord(in result: SFSpeechRecognitionResult) {
    let transcript = result.bestTranscription.formattedString.lowercased()

    guard let keyword = keyword else {
      // No keyword specified, immediately transition to speech recognition
      transitionToSpeechRecognition(from: result)
      return
    }

    if transcript.contains(keyword) {
      print("🟢 KeywordRecognizer: WAKE WORD DETECTED!")
      transitionToSpeechRecognition(from: result)
    }
  }

  private func transitionToSpeechRecognition(from result: SFSpeechRecognitionResult) {
    recognitionPhase = .recognizingSpeech

    // Play wake word detection sound
    if soundEnabled {
      playSound(systemSound: 1113)  // Begin recording sound
    }

    // Notify delegate
    delegate?.keywordDetected(keyword: keyword ?? "")
    delegate?.recognitionStarted()

    // Calculate wake word end time and restart recognition
    restartRecognitionAfterWakeWord(from: result)
  }

  private func restartRecognitionAfterWakeWord(from result: SFSpeechRecognitionResult) {
    print("🟢 KeywordRecognizer: Restarting recognition for command detection")

    // Cancel current recognition and clean up properly
    wakeWordRecognitionTask?.cancel()
    wakeWordRecognitionRequest?.endAudio()
    wakeWordRecognitionRequest = nil
    wakeWordRecognitionTask = nil
    sentenceRecognitionRequest = nil
    sentenceRecognitionTask = nil

    // Reset stored results to avoid interference
    lastMeaningfulResult = nil
    lastFilteredMeaningfulText = nil

    // Start immediately without delay to capture any speech right after wake word
    startCommandRecognition(from: CFAbsoluteTimeGetCurrent() - 1.0)  // Get recent audio
  }

  private func startCommandRecognition(from replayStartTime: CFAbsoluteTime) {
    guard let speechRecognizer = speechRecognizer else { return }

    print("🟢 KeywordRecognizer: Starting fresh command recognition with recent audio replay")

    // Create new recognition request for command recognition
    let newRequest = SFSpeechAudioBufferRecognitionRequest()
    newRequest.shouldReportPartialResults = true
    newRequest.requiresOnDeviceRecognition = false
    newRequest.contextualStrings = contextualHints

    // Get recent audio (last 1 second) to capture any speech right after wake word
    let replayBuffers = circularBuffer.getAudioFrom(replayStartTime, maxDuration: 1.0)
    print("🟢 KeywordRecognizer: Retrieved \(replayBuffers.count) replay buffers (1.0s window)")

    for buffer in replayBuffers {
      newRequest.append(buffer)
    }

    // Set as current request - audio tap will continue feeding it
    sentenceRecognitionRequest = newRequest
    recognitionStartTime = CFAbsoluteTimeGetCurrent()

    // Start new recognition task for command recognition
    sentenceRecognitionTask = speechRecognizer.recognitionTask(with: newRequest) {
      [weak self] result, error in
      guard let self = self else { return }

      DispatchQueue.main.async {
        if let error = error {
          print("🔴 KeywordRecognizer: Command recognition error: \(error)")
          // Only handle error if we're still in speech recognition phase
          if self.recognitionPhase == .recognizingSpeech {
            self.delegate?.recognitionError(error)
          }
          return
        }

        // Only process results if we're still in speech recognition phase
        if self.recognitionPhase == .recognizingSpeech {
          // Filter out wake word from results
          // if let filteredResult = self.filterWakeWordFromResult(result!) {
          self.handleFilteredRecognitionResult(result: result, error: error)
          // }
        }
      }
    }

    print("🟢 KeywordRecognizer: Command recognition started successfully with replay")
  }

  private func filterWakeWordFromResult(_ result: SFSpeechRecognitionResult)
    -> SFSpeechRecognitionResult?
  {
    guard let keyword = keyword else { return result }

    let transcript = result.bestTranscription.formattedString
    let lowercaseTranscript = transcript.lowercased()

    // If transcript contains the wake word, try to remove it
    if lowercaseTranscript.contains(keyword) {
      // Simple approach: remove the wake word and any leading/trailing whitespace
      let filteredText =
        transcript
        .replacingOccurrences(of: keyword, with: "", options: .caseInsensitive)
        .trimmingCharacters(in: .whitespacesAndNewlines)

      print("🟡 Filtered wake word: '\(transcript)' → '\(filteredText)'")

      // If we have meaningful text after filtering, return it as is
      // Note: We can't modify SFSpeechRecognitionResult, so we'll handle this at processing level
      return result
    }

    return result
  }

  private func handleFilteredRecognitionResult(result: SFSpeechRecognitionResult?, error: Error?) {
    guard let result = result else { return }

    let transcript = result.bestTranscription.formattedString
    let filteredTranscript = transcript  // NO FILTERING TIL THE END filterTranscriptText(transcript)

    print("🟢 KeywordRecognizer: >>>>>>>>>>>>>>> Received result (filtered): \(filteredTranscript)")

    // Store meaningful filtered results (non-empty transcriptions)
    let trimmedFiltered = filteredTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedFiltered.isEmpty {
      // Detect final-partial results (iOS 18 fix for lost text after pauses)
      let isFinalPartial = detectFinalPartialResult(result)
      if isFinalPartial {
        print("🔵 KeywordRecognizer: Detected final-partial result - saving for accumulation")
        finalPartialResults.append(result)
        updateAccumulatedTranscription()
      } else {
        print("🟡 KeywordRecognizer: Ongoing partial result - combining with saved results")
        updateAccumulatedTranscription(withCurrentPartial: result)
      }
    }

    // Process the result normally but use filtered transcript
    if result.isFinal {
      print("🟢 KeywordRecognizer: Final result received, processing...")
      handleFinalSpeechResultWithText(accumulatedTranscription)
    } else {
      handleInterimSpeechResultWithText(filteredTranscript, originalResult: result)
    }
  }

  private func filterTranscriptText(_ transcript: String) -> String {
    guard let keyword = keyword else { return transcript }

    var filtered = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
    let keywordWords = keyword.lowercased().components(separatedBy: .whitespaces)

    // print("🟡 Filtering transcript: '\(transcript)'")
    // print("🟡 Wake word components: \(keywordWords)")

    // First, try to remove the complete wake word phrase
    filtered = filtered.replacingOccurrences(of: keyword, with: "", options: .caseInsensitive)
      .trimmingCharacters(in: .whitespacesAndNewlines)

    // If we still have text, check for partial wake word at the beginning
    if !filtered.isEmpty {
      let filteredWords = filtered.components(separatedBy: .whitespaces)
      var wordsToKeep = filteredWords

      // Check if the beginning of our filtered text starts with any trailing parts of the wake word
      for keywordWord in keywordWords.reversed() {  // Check from end of wake word backwards
        if let firstWord = wordsToKeep.first,
          firstWord.lowercased() == keywordWord.lowercased()
        {
          print("🟡 Removing trailing wake word component: '\(firstWord)'")
          wordsToKeep.removeFirst()
        } else {
          break  // Stop if we don't find a match (preserve word order)
        }
      }

      filtered = wordsToKeep.joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    return filtered.isEmpty ? transcript : filtered
  }

  private func processContinuousTranscription(result: SFSpeechRecognitionResult) {
    print("🟢 KeywordRecognizer: Processing continuous transcription (isFinal: \(result.isFinal))")

    // Detect final-partial results (iOS 18 fix for lost text after pauses)
    let isFinalPartial = detectFinalPartialResult(result)

    if isFinalPartial {
      print("🔵 KeywordRecognizer: Detected final-partial result - saving for accumulation")
      finalPartialResults.append(result)
      updateAccumulatedTranscription()
    } else {
      print("🟡 KeywordRecognizer: Ongoing partial result - combining with saved results")
      updateAccumulatedTranscription(withCurrentPartial: result)
    }

    // Handle final results or continue with silence detection
    if result.isFinal {
      handleFinalContinuousResult(result)
    } else {
      handleInterimContinuousResult(result)
    }
  }

  private func detectFinalPartialResult(_ result: SFSpeechRecognitionResult) -> Bool {
    // A result is "final-partial" if:
    // 1. It has segments with confidence > 0 (meaning it's confident about the transcription)
    // 2. But it's not marked as final (isFinal = false)
    // 3. This indicates a pause where the framework is confident but still listening

    guard !result.isFinal else { return false }

    let hasConfidentSegments = result.bestTranscription.segments.contains { segment in
      segment.confidence > 0.5  // Use higher confidence threshold
    }

    if hasConfidentSegments {
      print("🔵 Final-partial detection: hasConfident=\(hasConfidentSegments)")
    }

    return hasConfidentSegments
  }

  private func updateAccumulatedTranscription(
    withCurrentPartial current: SFSpeechRecognitionResult? = nil
  ) {
    // Sort final-partial results by speech start timestamp to maintain order
    let sortedFinalResults = finalPartialResults.sorted { result1, result2 in
      let timestamp1 = result1.speechRecognitionMetadata?.speechStartTimestamp ?? 0
      let timestamp2 = result2.speechRecognitionMetadata?.speechStartTimestamp ?? 0
      return timestamp1 < timestamp2
    }

    // Build accumulated text from final-partial results
    var accumulatedText =
      sortedFinalResults
      .map { $0.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .joined(separator: " ")

    // Add current partial if provided
    if let current = current {
      let currentText = current.bestTranscription.formattedString.trimmingCharacters(
        in: .whitespacesAndNewlines)
      if !currentText.isEmpty {
        if !accumulatedText.isEmpty {
          accumulatedText += " " + currentText
        } else {
          accumulatedText = currentText
        }
      }
    }

    accumulatedTranscription = accumulatedText
    print("🔵 KeywordRecognizer: Updated accumulated transcription: '\(accumulatedTranscription)'")
  }

  private func handleFinalContinuousResult(_ result: SFSpeechRecognitionResult) {
    print("🟢 KeywordRecognizer: Final continuous result received")

    // Use accumulated transcription as the final result
    var finalText = accumulatedTranscription.trimmingCharacters(in: .whitespacesAndNewlines)

    // If accumulated text is empty, fall back to the final result
    if finalText.isEmpty {
      finalText = result.bestTranscription.formattedString.trimmingCharacters(
        in: .whitespacesAndNewlines)
      print("🟡 KeywordRecognizer: Using final result as fallback: '\(finalText)'")
    } else {
      print("🟢 KeywordRecognizer: Using accumulated transcription: '\(finalText)'")
    }

    // Apply wake word filtering if needed
    let filteredText = filterTranscriptText(finalText)

    // Play completion sound
    if soundEnabled {
      playSound(systemSound: 1114)  // End recording sound
    }

    print("🟢 KeywordRecognizer: Final continuous speech result (filtered): \(filteredText)")

    // Notify delegate with final result
    let recognitionResult = RecognitionResult(text: filteredText, isFinal: true)
    delegate?.recognitionResult(recognitionResult)

    // Clean up and stop - don't return to wake word detection
    cleanupRecognition()
    recognitionPhase = .idle

    print("🟢 KeywordRecognizer: Continuous speech recognition completed, stopping")
  }

  private func handleInterimContinuousResult(_ result: SFSpeechRecognitionResult) {
    // Check if this result has speech content (not just silence)
    let hasContent = result.speechRecognitionMetadata?.speechStartTimestamp != nil

    if hasContent && !accumulatedTranscription.isEmpty {
      // Reset silence timer for meaningful speech
      silenceTimer?.invalidate()
      silenceTimer = Timer.scheduledTimer(withTimeInterval: maxSilenceDuration, repeats: false) {
        [weak self] _ in
        self?.handleSilenceTimeout()
      }
    }
  }

  private func processSpeechRecognition(result: SFSpeechRecognitionResult) {
    print("🟢 KeywordRecognizer: Processing speech result (isFinal: \(result.isFinal))")

    // Store meaningful results (non-empty transcriptions)
    let transcript = result.bestTranscription.formattedString.trimmingCharacters(
      in: .whitespacesAndNewlines)
    if !transcript.isEmpty {
      lastMeaningfulResult = result
      print("🟢 KeywordRecognizer: Stored meaningful result: \(transcript)")
    }

    if result.isFinal {
      // Final result received
      handleFinalSpeechResult(result)
    } else {
      // Interim result - start/reset silence timer
      handleInterimSpeechResult(result)
    }
  }

  private func handleFinalSpeechResultWithText(_ accumulatedText: String) {
    // TODO: do not attempt to filter if there's no keyword recognition?
    var keywordFiltered = filterTranscriptText(accumulatedText)
    var finalText = keywordFiltered.trimmingCharacters(in: .whitespacesAndNewlines)

    // Play completion sound
    if soundEnabled {
      playSound(systemSound: 1114)  // End recording sound
    }
    print("🟢 KeywordRecognizer: Final speech result (filtered): \(finalText)")

    // Notify delegate with final result
    let recognitionResult = RecognitionResult(text: finalText, isFinal: true)
    delegate?.recognitionResult(recognitionResult)

    // Clean up and stop - don't return to wake word detection
    speechResults.removeAll()
    lastMeaningfulResult = nil
    lastFilteredMeaningfulText = nil
    cleanupRecognition()
    recognitionPhase = .idle

    print("🟢 KeywordRecognizer: Speech recognition completed, stopping")
  }

  private func handleInterimSpeechResultWithText(
    _ filteredText: String, originalResult: SFSpeechRecognitionResult
  ) {
    // Check if this result has speech content (not just silence)
    let hasContent = originalResult.speechRecognitionMetadata?.speechStartTimestamp != nil

    if hasContent && !filteredText.isEmpty {
      // Reset silence timer for meaningful speech
      silenceTimer?.invalidate()
      silenceTimer = Timer.scheduledTimer(withTimeInterval: maxSilenceDuration, repeats: false) {
        [weak self] _ in
        self?.handleSilenceTimeout()
      }
    }
  }

  private func handleFinalSpeechResult(_ result: SFSpeechRecognitionResult) {
    var finalText = result.bestTranscription.formattedString.trimmingCharacters(
      in: .whitespacesAndNewlines)

    // If final result is empty but we have a meaningful partial result, use that
    if finalText.isEmpty, let lastResult = lastMeaningfulResult {
      finalText = lastResult.bestTranscription.formattedString.trimmingCharacters(
        in: .whitespacesAndNewlines)
      print(
        "🟡 KeywordRecognizer: Using last meaningful result instead of empty final: \(finalText)")
    }

    // Play completion sound
    if soundEnabled {
      playSound(systemSound: 1114)  // End recording sound
    }
    print("🟢 KeywordRecognizer: Final speech result: \(finalText)")

    // Notify delegate with final result
    let recognitionResult = RecognitionResult(text: finalText, isFinal: true)
    delegate?.recognitionResult(recognitionResult)

    // Clean up and stop - don't return to wake word detection
    speechResults.removeAll()
    lastMeaningfulResult = nil
    cleanupRecognition()
    recognitionPhase = .idle

    print("🟢 KeywordRecognizer: Speech recognition completed, stopping")
  }

  private func handleInterimSpeechResult(_ result: SFSpeechRecognitionResult) {
    // Check if this result has speech content (not just silence)
    let hasContent = result.speechRecognitionMetadata?.speechStartTimestamp != nil

    if hasContent {
      // Reset silence timer for meaningful speech
      silenceTimer?.invalidate()
      silenceTimer = Timer.scheduledTimer(withTimeInterval: maxSilenceDuration, repeats: false) {
        [weak self] _ in
        self?.handleSilenceTimeout()
      }
    }
  }

  private func handleSilenceTimeout() {
    print("🟡 KeywordRecognizer: Silence timeout reached")

    // Force current recognition to finish based on phase
    if recognitionPhase == .recognizingSpeech {
      sentenceRecognitionTask?.finish()
    } else {
      wakeWordRecognitionTask?.finish()
    }
  }

  private func playSound(systemSound: SystemSoundID) {
    if let audioPlayer = audioPlayer {
      audioPlayer.play()
    } else {
      AudioServicesPlaySystemSound(systemSound)
    }
  }
}

// MARK: - Current Time Helper
extension ExpoKeywordBasedRecognizer {
  fileprivate var currentTime: String {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss.SSS"
    return formatter.string(from: Date())
  }
}
