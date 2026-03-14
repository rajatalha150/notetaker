import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRecording, saveRecording } from '@shared/storage/metadata'
import type { RecordingMeta, RecordingStatus } from '@shared/types'

export type DesktopRecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped'

function buildRecordingTitle(startedAt: number, sourceName?: string) {
  const sourceLabel = sourceName?.trim() || 'Desktop'
  return `${sourceLabel} Recording ${new Date(startedAt).toLocaleString()}`
}

function buildPlatformLabel(sourceName?: string) {
  return sourceName?.trim() ? `Desktop (${sourceName.trim()})` : 'Desktop App'
}

export function useDesktopRecorder() {
  const queryClient = useQueryClient()

  const [status, setStatus] = useState<DesktopRecorderStatus>('idle')
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  const timerRef = useRef<number | null>(null)
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

  const cleanupMedia = useCallback(async () => {
    stopTimer()
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
  }, [stopTimer])

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

  const startRecording = useCallback(async (sourceId: string, captureMic: boolean, sourceName?: string) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      throw new Error('A desktop recording is already in progress')
    }

    chunksRef.current = []
    pausedDurationRef.current = 0
    lastPausedAtRef.current = null

    const id = crypto.randomUUID()
    const startedAt = Date.now()
    recordingIdRef.current = id
    startedAtRef.current = startedAt
    sourceRef.current = { id: sourceId, name: sourceName }

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
        const systemPanner = audioContext.createStereoPanner()
        systemPanner.pan.value = 1
        systemSource.connect(systemPanner)
        systemPanner.connect(destination)

        const micSource = audioContext.createMediaStreamSource(micStream)
        const micPanner = audioContext.createStereoPanner()
        micPanner.pan.value = -1
        micSource.connect(micPanner)
        micPanner.connect(destination)

        micStreamRef.current = micStream
        audioContextRef.current = audioContext
        finalStream = destination.stream
      }

      mixedStreamRef.current = finalStream

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
              title: buildRecordingTitle(startedAt, sourceName),
              startedAt,
              duration: recordingDuration,
              status: 'stopped',
              environment: 'desktop',
              platform: buildPlatformLabel(sourceName),
              notes: [],
            }

            meta.status = 'stopped'
            meta.environment = 'desktop'
            meta.platform = buildPlatformLabel(sourceName)
            meta.stoppedAt = Date.now()
            meta.duration = recordingDuration
            meta.filename = savedFile.filename
            meta.filePath = savedFile.filePath
            meta.fileSize = savedFile.fileSize
            meta.mimeType = mimeTypeRef.current
            meta.sourceId = sourceId
            meta.sourceName = sourceName
            meta.userName = captureMic ? 'You' : undefined

            await saveRecording(meta)
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
        title: buildRecordingTitle(startedAt, sourceName),
        startedAt,
        duration: 0,
        status: 'recording',
        environment: 'desktop',
        platform: buildPlatformLabel(sourceName),
        notes: [],
        sourceId,
        sourceName,
        mimeType: mimeTypeRef.current,
        userName: captureMic ? 'You' : undefined,
      }

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
