import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRecording, saveRecording } from '@shared/storage/metadata'
import type { RecordingMeta, RecordingStatus, SpeakerEvent } from '@shared/types'
import type { DesktopSourceMetadata } from '../electron'
import { detectDesktopMeetingContext } from '../desktop-detector'

export type DesktopRecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped'

function buildRecordingTitle(startedAt: number, sourceName?: string) {
  const sourceLabel = sourceName?.trim() || 'Desktop'
  return `${sourceLabel} Recording ${new Date(startedAt).toLocaleString()}`
}

function buildPlatformLabel(sourceName?: string) {
  return sourceName?.trim() ? `Desktop (${sourceName.trim()})` : 'Desktop App'
}

function buildSourceContext(sourceName?: string, metadata?: DesktopSourceMetadata | null) {
  return {
    sourceName: metadata?.sourceName || sourceName || '',
    windowTitle: metadata?.windowTitle,
    windowClass: metadata?.windowClass,
  }
}

function getAnalyserLevel(analyser: AnalyserNode) {
  const buffer = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(buffer)

  let sum = 0
  for (let i = 0; i < buffer.length; i += 1) {
    const normalized = (buffer[i] - 128) / 128
    sum += normalized * normalized
  }

  return Math.sqrt(sum / buffer.length)
}

export function useDesktopRecorder() {
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<DesktopRecorderStatus>('idle')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  const timerRef = useRef<number | null>(null)
  const speakerMonitorRef = useRef<number | null>(null)
  const sourceDetectionMonitorRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mixedStreamRef = useRef<MediaStream | null>(null)
  const systemStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const pausedDurationRef = useRef(0)
  const lastPausedAtRef = useRef<number | null>(null)
  const sourceRef = useRef<{ id: string; name?: string } | null>(null)
  const externalSpeakerLabelRef = useRef('Speaker 2')
  const mimeTypeRef = useRef('audio/webm')

  const invalidateRecordingQueries = useCallback((id?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['recordings'] })
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['recording', id] })
      queryClient.invalidateQueries({ queryKey: ['transcription', id] })
      queryClient.invalidateQueries({ queryKey: ['summary', id] })
      queryClient.invalidateQueries({ queryKey: ['notes', id] })
    }
  }, [queryClient])

  const getElapsedMs = useCallback(() => {
    const startedAt = startedAtRef.current
    if (!startedAt) return 0

    const now = Date.now()
    const pausedFor = pausedDurationRef.current + (lastPausedAtRef.current ? now - lastPausedAtRef.current : 0)
    return Math.max(0, now - startedAt - pausedFor)
  }, [])

  const syncElapsedTime = useCallback(() => {
    setElapsedTime(getElapsedMs())
  }, [getElapsedMs])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = window.setInterval(() => {
      syncElapsedTime()
    }, 1000)
  }, [stopTimer, syncElapsedTime])

  const stopSpeakerMonitor = useCallback(() => {
    if (speakerMonitorRef.current !== null) {
      window.clearInterval(speakerMonitorRef.current)
      speakerMonitorRef.current = null
    }
  }, [])

  const stopSourceDetectionMonitor = useCallback(() => {
    if (sourceDetectionMonitorRef.current !== null) {
      window.clearInterval(sourceDetectionMonitorRef.current)
      sourceDetectionMonitorRef.current = null
    }
  }, [])

  const cleanupMedia = useCallback(async () => {
    stopTimer()
    stopSpeakerMonitor()
    stopSourceDetectionMonitor()
    mediaRecorderRef.current = null

    mixedStreamRef.current?.getTracks().forEach((track) => track.stop())
    systemStreamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current?.getTracks().forEach((track) => track.stop())

    mixedStreamRef.current = null
    systemStreamRef.current = null
    micStreamRef.current = null

    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext) {
      await audioContext.close().catch(() => undefined)
    }
  }, [stopSourceDetectionMonitor, stopSpeakerMonitor, stopTimer])

  const updateStoredStatus = useCallback(async (nextStatus: RecordingStatus) => {
    const id = recordingIdRef.current
    if (!id) return

    const meta = await getRecording(id)
    if (!meta) return

    meta.status = nextStatus
    meta.duration = getElapsedMs()
    if (nextStatus === 'stopped') {
      meta.stoppedAt = Date.now()
    }

    await saveRecording(meta)
    invalidateRecordingQueries(id)
  }, [getElapsedMs, invalidateRecordingQueries])

  const appendSpeakerEvent = useCallback(async (name: string) => {
    const id = recordingIdRef.current
    if (!id) return

    const meta = await getRecording(id)
    if (!meta) return

    if (!meta.speakerEvents) {
      meta.speakerEvents = []
    }

    const timestamp = getElapsedMs()
    const lastEvent = meta.speakerEvents[meta.speakerEvents.length - 1]
    if (!lastEvent || lastEvent.name !== name || timestamp - lastEvent.timestamp > 10000) {
      const event: SpeakerEvent = { name, timestamp }
      meta.speakerEvents.push(event)
      await saveRecording(meta)
    }
  }, [getElapsedMs])

  const normalizeDesktopSpeakerNames = useCallback((meta: RecordingMeta, externalName?: string) => {
    if (!externalName) return meta

    const normalizedSpeakerEvents = meta.speakerEvents?.map((event) => {
      if (event.name === 'You') return event
      return {
        ...event,
        name: externalName,
      }
    })

    const normalizedTranscription = meta.transcription
      ? {
          ...meta.transcription,
          segments: meta.transcription.segments.map((segment) => {
            if (!segment.speaker || segment.speaker === 'You') {
              return segment
            }

            return {
              ...segment,
              speaker: externalName,
            }
          }),
        }
      : meta.transcription

    return {
      ...meta,
      speakerEvents: normalizedSpeakerEvents,
      transcription: normalizedTranscription,
    }
  }, [])

  const updateDetectionMetadata = useCallback(async (sourceContext: ReturnType<typeof buildSourceContext>) => {
    const id = recordingIdRef.current
    if (!id) return

    const meta = await getRecording(id)
    if (!meta) return

    const detection = detectDesktopMeetingContext(sourceContext)
    const detectedParticipantNames = detection.detectedParticipantNames
    const externalName = detectedParticipantNames.length === 1 ? detectedParticipantNames[0] : undefined
    externalSpeakerLabelRef.current = externalName || 'Speaker 2'

    let nextMeta: RecordingMeta = {
      ...meta,
      sourceName: sourceContext.sourceName || meta.sourceName,
      sourceWindowTitle: sourceContext.windowTitle,
      sourceWindowClass: sourceContext.windowClass,
      platform: detection.platform ?? meta.platform ?? buildPlatformLabel(sourceContext.sourceName || meta.sourceName),
      detectedParticipantNames,
      participantDetectionMethod: detection.detectionMethod,
    }

    if (externalName) {
      nextMeta = normalizeDesktopSpeakerNames(nextMeta, externalName)
    }

    const changed =
      nextMeta.sourceName !== meta.sourceName ||
      nextMeta.sourceWindowTitle !== meta.sourceWindowTitle ||
      nextMeta.sourceWindowClass !== meta.sourceWindowClass ||
      nextMeta.platform !== meta.platform ||
      JSON.stringify(nextMeta.detectedParticipantNames ?? []) !== JSON.stringify(meta.detectedParticipantNames ?? []) ||
      JSON.stringify(nextMeta.speakerEvents ?? []) !== JSON.stringify(meta.speakerEvents ?? []) ||
      JSON.stringify(nextMeta.transcription ?? null) !== JSON.stringify(meta.transcription ?? null)

    if (!changed) return

    await saveRecording(nextMeta)
    invalidateRecordingQueries(id)
  }, [invalidateRecordingQueries, normalizeDesktopSpeakerNames])

  const startRecording = useCallback(async (sourceId: string, captureMic: boolean, sourceName?: string) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      throw new Error('A desktop recording is already in progress')
    }

    chunksRef.current = []
    pausedDurationRef.current = 0
    lastPausedAtRef.current = null
    externalSpeakerLabelRef.current = 'Speaker 2'

    const id = crypto.randomUUID()
    const startedAt = Date.now()
    const initialSourceMetadata = await window.electron.desktop.getSourceMetadataById(sourceId)
    const initialSourceContext = buildSourceContext(sourceName, initialSourceMetadata)
    const resolvedSourceName = initialSourceContext.sourceName || sourceName
    recordingIdRef.current = id
    startedAtRef.current = startedAt
    sourceRef.current = { id: sourceId, name: resolvedSourceName }

    try {
      const systemStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        },
      } as MediaStreamConstraints)

      const systemAudioTrack = systemStream.getAudioTracks()[0]
      if (!systemAudioTrack) {
        systemStream.getTracks().forEach((track) => track.stop())
        throw new Error('The selected source does not expose a system audio track')
      }

      systemStreamRef.current = systemStream

      let finalStream = new MediaStream([systemAudioTrack])

      if (captureMic) {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })

        const audioContext = new AudioContext()
        const destination = audioContext.createMediaStreamDestination()
        destination.channelCount = 2

        const systemSource = audioContext.createMediaStreamSource(new MediaStream([systemAudioTrack]))
        const systemAnalyser = audioContext.createAnalyser()
        systemAnalyser.fftSize = 2048
        systemSource.connect(systemAnalyser)
        const systemPanner = audioContext.createStereoPanner()
        systemPanner.pan.value = 1
        systemAnalyser.connect(systemPanner)
        systemPanner.connect(destination)

        const micSource = audioContext.createMediaStreamSource(micStream)
        const micAnalyser = audioContext.createAnalyser()
        micAnalyser.fftSize = 2048
        micSource.connect(micAnalyser)
        const micPanner = audioContext.createStereoPanner()
        micPanner.pan.value = -1
        micAnalyser.connect(micPanner)
        micPanner.connect(destination)

        micStreamRef.current = micStream
        audioContextRef.current = audioContext
        finalStream = destination.stream

        let smoothedMicLevel = 0
        let smoothedSystemLevel = 0
        let confirmedSpeaker: string | null = null
        let candidateSpeaker: string | null = null
        let candidateCount = 0
        let lastConfirmedAt = 0

        speakerMonitorRef.current = window.setInterval(() => {
          if (mediaRecorderRef.current?.state !== 'recording') return

          const micLevel = getAnalyserLevel(micAnalyser)
          const systemLevel = getAnalyserLevel(systemAnalyser)
          smoothedMicLevel = smoothedMicLevel === 0 ? micLevel : (smoothedMicLevel * 0.65) + (micLevel * 0.35)
          smoothedSystemLevel = smoothedSystemLevel === 0 ? systemLevel : (smoothedSystemLevel * 0.65) + (systemLevel * 0.35)

          const silenceFloor = 0.02
          const dominanceGap = 0.01
          const dominanceRatio = 1.35
          const confirmationSamples = 2
          const switchCooldownMs = 4000

          if (smoothedMicLevel < silenceFloor && smoothedSystemLevel < silenceFloor) {
            candidateSpeaker = null
            candidateCount = 0
            return
          }

          let dominantSpeaker: string | null = null
          if (
            smoothedMicLevel > smoothedSystemLevel + dominanceGap &&
            smoothedMicLevel > smoothedSystemLevel * dominanceRatio
          ) {
            dominantSpeaker = 'You'
          } else if (
            smoothedSystemLevel > smoothedMicLevel + dominanceGap &&
            smoothedSystemLevel > smoothedMicLevel * dominanceRatio
          ) {
            dominantSpeaker = externalSpeakerLabelRef.current
          }

          if (!dominantSpeaker) {
            candidateSpeaker = null
            candidateCount = 0
            return
          }

          if (dominantSpeaker === confirmedSpeaker) {
            candidateSpeaker = null
            candidateCount = 0
            return
          }

          if (dominantSpeaker !== candidateSpeaker) {
            candidateSpeaker = dominantSpeaker
            candidateCount = 1
            return
          }

          candidateCount += 1
          if (candidateCount < confirmationSamples) {
            return
          }

          const now = getElapsedMs()
          if (lastConfirmedAt > 0 && now - lastConfirmedAt < switchCooldownMs) {
            return
          }

          confirmedSpeaker = dominantSpeaker
          candidateSpeaker = null
          candidateCount = 0
          lastConfirmedAt = now
          void appendSpeakerEvent(dominantSpeaker)
        }, 750)
      }

      mixedStreamRef.current = finalStream

      sourceDetectionMonitorRef.current = window.setInterval(async () => {
        const currentSource = sourceRef.current
        if (!currentSource) return

        const liveSourceMetadata = await window.electron.desktop.getSourceMetadataById(currentSource.id)
        if (!liveSourceMetadata?.sourceName) return

        sourceRef.current = {
          id: currentSource.id,
          name: liveSourceMetadata.sourceName,
        }

        await updateDetectionMetadata(buildSourceContext(liveSourceMetadata.sourceName, liveSourceMetadata))
      }, 4000)

      mimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(finalStream, { mimeType: mimeTypeRef.current })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const currentRecordingId = recordingIdRef.current
        const recordingDuration = getElapsedMs()
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })

        try {
          if (currentRecordingId) {
            const safeTimestamp = new Date(startedAt).toISOString().replace(/[:.]/g, '-')
            const filename = `notetaker-desktop-${safeTimestamp}-${currentRecordingId}.webm`
            const arrayBuffer = await blob.arrayBuffer()
            const savedFile = await window.electron.desktop.saveRecording(filename, arrayBuffer)

            const meta = (await getRecording(currentRecordingId)) ?? {
              id: currentRecordingId,
              title: buildRecordingTitle(startedAt, resolvedSourceName),
              startedAt,
              duration: recordingDuration,
              status: 'stopped',
              environment: 'desktop',
              platform: buildPlatformLabel(resolvedSourceName),
              notes: [],
              speakerEvents: [],
            }

            const detection = detectDesktopMeetingContext({
              sourceName: meta.sourceName ?? resolvedSourceName ?? '',
              windowTitle: meta.sourceWindowTitle,
              windowClass: meta.sourceWindowClass,
            })
            const detectedParticipantNames = detection.detectedParticipantNames
            const externalName = detectedParticipantNames.length === 1 ? detectedParticipantNames[0] : undefined

            meta.status = 'stopped'
            meta.environment = 'desktop'
            meta.platform = detection.platform ?? meta.platform ?? buildPlatformLabel(resolvedSourceName)
            meta.stoppedAt = Date.now()
            meta.duration = recordingDuration
            meta.filename = savedFile.filename
            meta.filePath = savedFile.filePath
            meta.fileSize = savedFile.fileSize
            meta.mimeType = mimeTypeRef.current
            meta.sourceId = sourceId
            meta.sourceName = meta.sourceName ?? resolvedSourceName
            meta.sourceWindowTitle = meta.sourceWindowTitle ?? initialSourceContext.windowTitle
            meta.sourceWindowClass = meta.sourceWindowClass ?? initialSourceContext.windowClass
            meta.userName = captureMic ? 'You' : undefined
            meta.detectedParticipantNames = detectedParticipantNames
            meta.participantDetectionMethod = detection.detectionMethod

            const finalMeta = externalName
              ? normalizeDesktopSpeakerNames(meta, externalName)
              : meta

            await saveRecording(finalMeta)
            invalidateRecordingQueries(currentRecordingId)
          }
        } finally {
          await cleanupMedia()
          setStatus('stopped')
          syncElapsedTime()
        }
      }

      recorder.start(1000)

      const meta: RecordingMeta = {
        id,
        title: buildRecordingTitle(startedAt, resolvedSourceName),
        startedAt,
        duration: 0,
        status: 'recording',
        environment: 'desktop',
        platform: buildPlatformLabel(resolvedSourceName),
        notes: [],
        speakerEvents: [],
        sourceId,
        sourceName: resolvedSourceName,
        sourceWindowTitle: initialSourceContext.windowTitle,
        sourceWindowClass: initialSourceContext.windowClass,
        mimeType: mimeTypeRef.current,
        userName: captureMic ? 'You' : undefined,
      }

      const detection = detectDesktopMeetingContext(initialSourceContext)
      meta.platform = detection.platform ?? meta.platform
      meta.detectedParticipantNames = detection.detectedParticipantNames
      meta.participantDetectionMethod = detection.detectionMethod
      externalSpeakerLabelRef.current = detection.detectedParticipantNames.length === 1
        ? detection.detectedParticipantNames[0]
        : 'Speaker 2'

      await saveRecording(meta)
      invalidateRecordingQueries(id)

      setRecordingId(id)
      setElapsedTime(0)
      setStatus('recording')
      startTimer()

      return id
    } catch (error) {
      await cleanupMedia()
      recordingIdRef.current = null
      startedAtRef.current = null
      sourceRef.current = null
      setRecordingId(null)
      setElapsedTime(0)
      setStatus('idle')
      throw error
    }
  }, [cleanupMedia, getElapsedMs, invalidateRecordingQueries, startTimer, syncElapsedTime])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    if (lastPausedAtRef.current) {
      pausedDurationRef.current += Date.now() - lastPausedAtRef.current
      lastPausedAtRef.current = null
    }

    stopTimer()
    syncElapsedTime()
    recorder.stop()
  }, [stopTimer, syncElapsedTime])

  const pauseRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'recording') return

    recorder.pause()
    lastPausedAtRef.current = Date.now()
    stopTimer()
    syncElapsedTime()
    setStatus('paused')
    await updateStoredStatus('paused')
  }, [stopTimer, syncElapsedTime, updateStoredStatus])

  const resumeRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state !== 'paused') return

    if (lastPausedAtRef.current) {
      pausedDurationRef.current += Date.now() - lastPausedAtRef.current
      lastPausedAtRef.current = null
    }

    recorder.resume()
    setStatus('recording')
    startTimer()
    await updateStoredStatus('recording')
  }, [startTimer, updateStoredStatus])

  const reset = useCallback(() => {
    stopTimer()
    recordingIdRef.current = null
    startedAtRef.current = null
    pausedDurationRef.current = 0
    lastPausedAtRef.current = null
    sourceRef.current = null
    chunksRef.current = []
    setRecordingId(null)
    setElapsedTime(0)
    setStatus('idle')
  }, [stopTimer])

  useEffect(() => {
    return () => {
      cleanupMedia().catch(() => undefined)
    }
  }, [cleanupMedia])

  return {
    status,
    recordingId,
    elapsedTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    reset,
  }
}
