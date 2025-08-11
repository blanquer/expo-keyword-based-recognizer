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

  func getAudioFrom(_ timestamp: CFAbsoluteTime) -> [AVAudioPCMBuffer] {
    return queue.sync { [weak self] in
      guard let self = self else { return [] }

      var result: [AVAudioPCMBuffer] = []

      for buffer in self.buffers {
        let bufferStart = buffer.absoluteTimestamp
        let bufferEnd = bufferStart + buffer.bufferDuration

        if timestamp >= bufferStart && timestamp <= bufferEnd {
          // Found the buffer containing our timestamp
          let offsetTime = timestamp - bufferStart
          let sampleOffset = Int(offsetTime * buffer.audioData.format.sampleRate)

          if let trimmedBuffer = self.extractSamplesFrom(
            buffer.audioData, startingSample: sampleOffset)
          {
            result.append(trimmedBuffer)
          }
        } else if bufferStart > timestamp {
          // This buffer starts after our timestamp, include it fully
          result.append(buffer.audioData)
        }
      }

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
        destPtr.assign(from: sourcePtr, count: Int(remainingSamples))
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
  private var currentRecognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var currentRecognitionTask: SFSpeechRecognitionTask?
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
    currentRecognitionTask?.cancel()

    if hasActiveTap {
      audioEngine.inputNode.removeTap(onBus: 0)
      hasActiveTap = false
    }

    silenceTimer?.invalidate()
    silenceTimer = nil
    currentRecognitionRequest = nil
    currentRecognitionTask = nil
    speechResults.removeAll()
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
      self.currentRecognitionRequest?.append(buffer)
    }
    hasActiveTap = true

    audioEngine.prepare()
    try audioEngine.start()
  }

  private func startWakeWordDetection() {
    recognitionPhase = keyword != nil ? .listeningForWakeWord : .recognizingSpeech
    startContinuousRecognition()
  }

  private func startContinuousRecognition() {
    guard let speechRecognizer = speechRecognizer else { return }

    // Clean up any existing recognition
    currentRecognitionTask?.cancel()

    // Create new recognition request
    let recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
    recognitionRequest.shouldReportPartialResults = true
    recognitionRequest.requiresOnDeviceRecognition = false

    // Add contextual hints
    if let keyword = keyword {
      recognitionRequest.contextualStrings = [keyword] + contextualHints
    } else {
      recognitionRequest.contextualStrings = contextualHints
    }

    currentRecognitionRequest = recognitionRequest
    recognitionStartTime = CFAbsoluteTimeGetCurrent()

    // Start recognition task
    currentRecognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) {
      [weak self] result, error in
      guard let self = self else { return }

      DispatchQueue.main.async {
        self.handleRecognitionResult(result: result, error: error)
      }
    }

    print("🟢 KeywordRecognizer: Started continuous recognition in phase: \(recognitionPhase)")
  }

  private func handleRecognitionResult(result: SFSpeechRecognitionResult?, error: Error?) {
    if let error = error {
      delegate?.recognitionError(error)
      return
    }

    guard let result = result else { return }

    let transcript = result.bestTranscription.formattedString.lowercased()
    print("🟢 KeywordRecognizer: Received result (phase: \(recognitionPhase)): \(transcript)")

    switch recognitionPhase {
    case .listeningForWakeWord:
      checkForWakeWord(in: result)
    case .recognizingSpeech:
      processSpeechRecognition(result: result)
    case .idle:
      break
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
    // Calculate when the wake word ended in our audio buffer
    let wakeWordEndTime = calculateWakeWordEndTime(from: result)

    print("🟢 KeywordRecognizer: Restarting recognition from timestamp: \(wakeWordEndTime)")

    // Cancel current recognition
    currentRecognitionTask?.cancel()

    // Create new recognition request for command recognition
    guard let speechRecognizer = speechRecognizer else { return }

    let newRequest = SFSpeechAudioBufferRecognitionRequest()
    newRequest.shouldReportPartialResults = true
    newRequest.requiresOnDeviceRecognition = false
    newRequest.contextualStrings = contextualHints

    // Get replay audio from the wake word end point
    let replayBuffers = circularBuffer.getAudioFrom(wakeWordEndTime)
    for buffer in replayBuffers {
      newRequest.append(buffer)
    }

    // Atomic swap to new request - audio tap will continue feeding it
    currentRecognitionRequest = newRequest
    recognitionStartTime = CFAbsoluteTimeGetCurrent()

    // Start new recognition task for command recognition
    currentRecognitionTask = speechRecognizer.recognitionTask(with: newRequest) {
      [weak self] result, error in
      guard let self = self else { return }

      DispatchQueue.main.async {
        self.handleRecognitionResult(result: result, error: error)
      }
    }

    print("🟢 KeywordRecognizer: Recognition restarted for speech commands")
  }

  private func calculateWakeWordEndTime(from result: SFSpeechRecognitionResult) -> CFAbsoluteTime {
    guard let keyword = keyword else {
      // No keyword, start from beginning of recognition
      return recognitionStartTime
    }

    // Find the wake word in the transcription segments
    let segments = result.bestTranscription.segments
    var wakeWordEndSegmentTime: TimeInterval = 0

    for segment in segments {
      let segmentText = segment.substring.lowercased()
      if segmentText.contains(keyword) || keyword.contains(segmentText) {
        wakeWordEndSegmentTime = segment.timestamp + segment.duration
      }
    }

    // Convert to absolute time in our audio buffer
    return recognitionStartTime + wakeWordEndSegmentTime
  }

  private func processSpeechRecognition(result: SFSpeechRecognitionResult) {
    print("🟢 KeywordRecognizer: Processing speech result (isFinal: \(result.isFinal))")

    if result.isFinal {
      // Final result received
      handleFinalSpeechResult(result)
    } else {
      // Interim result - start/reset silence timer
      handleInterimSpeechResult(result)
    }
  }

  private func handleFinalSpeechResult(_ result: SFSpeechRecognitionResult) {
    let finalText = result.bestTranscription.formattedString

    // Play completion sound
    if soundEnabled {
      playSound(systemSound: 1114)  // End recording sound
    }

    // Notify delegate with final result
    let recognitionResult = RecognitionResult(text: finalText, isFinal: true)
    delegate?.recognitionResult(recognitionResult)

    // Clean up and return to wake word detection if keyword is specified
    speechResults.removeAll()

    if keyword != nil {
      recognitionPhase = .listeningForWakeWord
      // Continue with continuous recognition for next wake word
    } else {
      // No wake word - complete the session
      cleanupRecognition()
    }
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

    // Force recognition to finish
    currentRecognitionTask?.finish()
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
