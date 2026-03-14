import { useState, useEffect } from 'react'
import { 
  Mic, 
  Settings, 
  History, 
  Square, 
  Pause, 
  Play, 
  Monitor,
  CheckCircle2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Info,
  Download,
  FileText,
  Activity
} from 'lucide-react'
import { useDesktopRecorder } from './hooks/useDesktopRecorder'
import { RecordingCard } from '../../src/sidepanel/components/RecordingCard'
import { NotesEditor } from '../../src/sidepanel/components/NotesEditor'
import { TranscriptionView } from '../../src/sidepanel/components/TranscriptionView'
import { SummaryView } from '../../src/sidepanel/components/SummaryView'
import { SettingsPage } from '../../src/sidepanel/routes/settings'
import { getSettings } from '@shared/storage/settings'
import { getAllRecordings, deleteRecording, getRecording, saveRecording } from '@shared/storage/metadata'
import { useTranscription } from '@shared/hooks/useTranscription'
import { useSummary } from '@shared/hooks/useSummary'
import type { RecordingMeta } from '@shared/types'
import type { DesktopSource } from './electron'

function formatSpeakerEventTime(timestamp: number) {
  const totalSeconds = Math.max(0, Math.floor(timestamp / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':')
}

export function App() {
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'settings'>('record')
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null)
  const [sources, setSources] = useState<DesktopSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [captureMic, setCaptureMic] = useState(true)
  const [recordings, setRecordings] = useState<RecordingMeta[]>([])
  const [selectedRecording, setSelectedRecording] = useState<RecordingMeta | null>(null)
  const [participantHint, setParticipantHint] = useState('')
  
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const { 
    status, 
    startRecording, 
    stopRecording, 
    pauseRecording, 
    resumeRecording,
    reset,
    elapsedTime,
    recordingId 
  } = useDesktopRecorder()

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setErrorInfo(e.message + ' at ' + e.filename);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (errorInfo) {
    return (
      <div className="p-10 bg-black text-red-500 font-mono text-xs overflow-auto h-screen">
        <h1 className="text-xl font-bold mb-4">ENGINE ERROR</h1>
        <p className="bg-red-950/20 p-4 border border-red-900 rounded-lg">{errorInfo}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-white text-black font-bold rounded">Restart UI</button>
      </div>
    );
  }

  // Hooks for AI
  const {
    transcribeSavedRecording,
    isTranscribing,
    transcription,
    transcriptionError,
  } = useTranscription(selectedRecordingId || undefined)
  const {
    summarize,
    isSummarizing,
    summary,
    summaryError,
  } = useSummary(selectedRecordingId || undefined)

  useEffect(() => {
    loadRecordings()
    loadSettings()
    if (activeTab === 'record') {
      refreshSources()
    }
  }, [activeTab])

  useEffect(() => {
    if (selectedRecordingId) {
       loadSelectedRecording(selectedRecordingId)
    } else {
      setSelectedRecording(null)
      setParticipantHint('')
    }
  }, [selectedRecordingId, transcription, summary])

  useEffect(() => {
    loadRecordings()
    if (recordingId) {
      loadSelectedRecording(recordingId)
    }
  }, [recordingId, status])

  const loadRecordings = async () => {
    const all = await getAllRecordings()
    setRecordings(all)
  }

  const loadSelectedRecording = async (id: string) => {
    const rec = await getRecording(id)
    if (rec) {
      setSelectedRecording(rec)
      setParticipantHint(rec.participantNames?.[0] ?? '')
    }
  }

  const loadSettings = async () => {
    const s = await getSettings()
    setCaptureMic(s.captureMic)
  }

  const refreshSources = async () => {
    const s = await window.electron.desktop.listSources()
    setSources(s)
    if (s.length > 0 && !selectedSource) {
      setSelectedSource(s[0].id)
    }
  }

  const handleStart = async () => {
    if (!selectedSource) return
    try {
      const source = sources.find((item) => item.id === selectedSource)
      await startRecording(selectedSource, captureMic, source?.name)
    } catch (error) {
      setErrorInfo(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const recording = await getRecording(id)
      if (recording?.filePath && recording.environment === 'desktop') {
        await window.electron.desktop.deleteRecording(recording.filePath)
      }
      await deleteRecording(id)
      if (selectedRecordingId === id) {
        setSelectedRecordingId(null)
      }
      loadRecordings()
    } catch (error) {
      setErrorInfo(error instanceof Error ? error.message : String(error))
    }
  }

  const handleTranscribe = async () => {
    try {
      await transcribeSavedRecording()
    } catch (error) {
      setErrorInfo(error instanceof Error ? error.message : String(error))
    }
  }

  const handleSaveParticipantHint = async () => {
    if (!selectedRecording) return

    try {
      const trimmed = participantHint.trim()
      const nextParticipantNames = trimmed ? [trimmed] : []
      const shouldNormalizeGenericSpeaker = !(selectedRecording.detectedParticipantNames?.length)
      const nextSpeakerEvents = shouldNormalizeGenericSpeaker
        ? selectedRecording.speakerEvents?.map((event) => {
            if (event.name === 'You') return event
            return {
              ...event,
              name: trimmed || 'Speaker 2',
            }
          })
        : selectedRecording.speakerEvents

      const nextTranscription = shouldNormalizeGenericSpeaker && selectedRecording.transcription
        ? {
            ...selectedRecording.transcription,
            segments: selectedRecording.transcription.segments.map((segment) => {
              if (!segment.speaker || segment.speaker === 'You') {
                return segment
              }

              return {
                ...segment,
                speaker: trimmed || 'Speaker 2',
              }
            }),
          }
        : selectedRecording.transcription

      const updated: RecordingMeta = {
        ...selectedRecording,
        participantNames: nextParticipantNames,
        speakerEvents: nextSpeakerEvents,
        transcription: nextTranscription,
      }
      await saveRecording(updated)
      setSelectedRecording(updated)
      loadRecordings()
    } catch (error) {
      setErrorInfo(error instanceof Error ? error.message : String(error))
    }
  }

  const detectedNames = selectedRecording?.detectedParticipantNames ?? []
  const manualNames = selectedRecording?.participantNames ?? []
  const speakerEventCount = selectedRecording?.speakerEvents?.length ?? 0
  const speakerEvents = selectedRecording?.speakerEvents ?? []

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <div className="w-16 flex flex-col items-center py-6 bg-gray-950 border-r border-gray-900 gap-6">
        <button 
          onClick={() => { setActiveTab('record'); setSelectedRecordingId(null); }}
          className={`p-2 rounded-xl transition-all ${activeTab === 'record' ? 'bg-purple-600 text-white shadow-[0_0_15px_-3px_rgba(147,51,234,0.5)]' : 'text-gray-500 hover:text-white'}`}
        >
          <Mic size={22} />
        </button>
        <button 
          onClick={() => { setActiveTab('history'); setSelectedRecordingId(null); }}
          className={`p-2 rounded-xl transition-all ${activeTab === 'history' && !selectedRecordingId ? 'bg-purple-600 text-white shadow-[0_0_15px_-3px_rgba(147,51,234,0.5)]' : 'text-gray-500 hover:text-white'}`}
        >
          <History size={22} />
        </button>
        <div className="mt-auto">
          <button 
            onClick={() => { setActiveTab('settings'); setSelectedRecordingId(null); }}
            className={`p-2 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-purple-600 text-white shadow-[0_0_15px_-3px_rgba(147,51,234,0.5)]' : 'text-gray-500 hover:text-white'}`}
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-gray-950 to-black">
        {/* Header */}
        <header className="h-14 flex items-center px-6 border-b border-gray-900 bg-black/40 backdrop-blur-xl justify-between window-drag">
          <div className="flex items-center gap-3">
            {selectedRecordingId && (
              <button onClick={() => setSelectedRecordingId(null)} className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
            )}
            <h1 className="text-sm font-semibold tracking-tight text-white uppercase tracking-widest">
              {selectedRecordingId ? 'Recording Detail' : activeTab === 'record' ? 'Studio' : activeTab === 'history' ? 'Library' : 'Settings'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${(status === 'recording' || status === 'paused') ? 'bg-red-500 animate-pulse' : 'bg-gray-700'}`}></span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Notetaker Desktop</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {selectedRecordingId ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="p-6 bg-gray-900/40 rounded-3xl border border-gray-800/60">
                 <h2 className="text-xl font-bold mb-1">{selectedRecording?.title}</h2>
                 <p className="text-sm text-gray-500">{selectedRecording?.startedAt && new Date(selectedRecording.startedAt).toLocaleString()}</p>
                 <p className="text-xs text-gray-600 mt-2 mb-6">
                   {selectedRecording?.sourceName || 'Desktop Audio'}
                   {selectedRecording?.filename ? ` · ${selectedRecording.filename}` : ''}
                 </p>

                 <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                     App Detection
                   </label>
                   {selectedRecording?.detectedParticipantNames?.length ? (
                     <div className="space-y-2">
                       <p className="text-xs text-gray-400">
                         Real participant names were detected from native app window metadata without AI.
                       </p>
                       <div className="flex flex-wrap gap-2">
                         {selectedRecording.detectedParticipantNames.map((name) => (
                           <span
                             key={name}
                             className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300"
                           >
                             {name}
                           </span>
                         ))}
                       </div>
                     </div>
                   ) : (
                     <p className="text-xs text-gray-500">
                       No participant names were found in native app metadata for this capture.
                     </p>
                   )}
                 </div>

                 <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                     Detection Diagnostics
                   </label>
                   <div className="space-y-3 text-xs">
                     <div className="flex items-start justify-between gap-4 border-b border-gray-900 pb-2">
                       <span className="text-gray-500">Source Title</span>
                       <span className="max-w-[65%] text-right text-gray-300 break-words">
                         {selectedRecording?.sourceName || 'Unavailable'}
                       </span>
                     </div>
                     <div className="flex items-start justify-between gap-4 border-b border-gray-900 pb-2">
                       <span className="text-gray-500">Window Title</span>
                       <span className="max-w-[65%] text-right text-gray-300 break-words">
                         {selectedRecording?.sourceWindowTitle || 'Unavailable'}
                       </span>
                     </div>
                     <div className="flex items-start justify-between gap-4 border-b border-gray-900 pb-2">
                       <span className="text-gray-500">Window Class</span>
                       <span className="max-w-[65%] text-right text-gray-300 break-words">
                         {selectedRecording?.sourceWindowClass || 'Unavailable'}
                       </span>
                     </div>
                     <div className="flex items-start justify-between gap-4 border-b border-gray-900 pb-2">
                       <span className="text-gray-500">Detected Platform</span>
                       <span className="max-w-[65%] text-right text-gray-300">
                         {selectedRecording?.platform || 'Unknown'}
                       </span>
                     </div>
                     <div className="flex items-start justify-between gap-4 border-b border-gray-900 pb-2">
                       <span className="text-gray-500">Detection Method</span>
                       <span className="max-w-[65%] text-right text-gray-300 uppercase">
                         {selectedRecording?.participantDetectionMethod || 'None'}
                       </span>
                     </div>
                     <div className="flex items-start justify-between gap-4 border-b border-gray-900 pb-2">
                       <span className="text-gray-500">Detected Names</span>
                       <span className="max-w-[65%] text-right text-gray-300 break-words">
                         {detectedNames.length ? detectedNames.join(', ') : 'None'}
                       </span>
                     </div>
                     <div className="flex items-start justify-between gap-4 border-b border-gray-900 pb-2">
                       <span className="text-gray-500">Manual Fallback Names</span>
                       <span className="max-w-[65%] text-right text-gray-300 break-words">
                         {manualNames.length ? manualNames.join(', ') : 'None'}
                       </span>
                     </div>
                     <div className="flex items-start justify-between gap-4">
                       <span className="text-gray-500">Speaker Events Logged</span>
                       <span className="max-w-[65%] text-right text-gray-300">
                         {speakerEventCount}
                       </span>
                     </div>
                   </div>
                 </div>

                 <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                     Manual Fallback Hint
                   </label>
                   <p className="text-xs text-gray-500 mb-3">
                     Use this only when the native app does not expose participant names. It does not replace detected app names.
                   </p>
                   <div className="flex gap-2">
                     <input
                       value={participantHint}
                       onChange={(e) => setParticipantHint(e.target.value)}
                       placeholder="e.g. John Doe"
                       className="flex-1 rounded-xl border border-gray-800 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-gray-700"
                     />
                     <button
                       onClick={handleSaveParticipantHint}
                       className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-700 transition-colors"
                     >
                       Save
                     </button>
                   </div>
                 </div>

                 <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                     Speaker Timeline
                   </label>
                   {speakerEvents.length ? (
                     <div className="space-y-2">
                       {speakerEvents.slice(-12).map((event, index) => (
                         <div
                           key={`${event.name}-${event.timestamp}-${index}`}
                           className="flex items-center justify-between gap-4 rounded-xl border border-gray-900 bg-black/30 px-3 py-2 text-xs"
                         >
                           <span className="font-medium text-gray-200">{event.name}</span>
                           <span className="font-mono text-gray-500">{formatSpeakerEventTime(event.timestamp)}</span>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <p className="text-xs text-gray-500">
                       No speaker events have been logged for this recording yet.
                     </p>
                   )}
                 </div>
                 
                 <div className="flex gap-3">
                   <button 
                    onClick={handleTranscribe}
                    disabled={isTranscribing || !selectedRecording?.filePath}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                   >
                     <FileText size={16} /> {isTranscribing ? 'Transcribing...' : transcription ? 'Transcribed' : 'Transcribe AI'}
                   </button>
                   <button 
                    onClick={() => summarize()}
                    disabled={isSummarizing || !transcription}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                   >
                     <Activity size={16} /> {isSummarizing ? 'Summarizing...' : summary ? 'Summarized' : 'Summarize'}
                   </button>
                 </div>
               </div>

               {transcription && <TranscriptionView transcription={transcription} />}
               {summary && <SummaryView summary={summary} />}
               {transcriptionError && <p className="text-sm text-red-400">{transcriptionError.message}</p>}
               {summaryError && <p className="text-sm text-red-400">{summaryError.message}</p>}
               {selectedRecording && <NotesEditor notes={selectedRecording.notes} />}
            </div>
          ) : activeTab === 'record' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-xl mx-auto">
              {status === 'idle' ? (
                <>
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Select Audio Source</label>
                      <button onClick={refreshSources} className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors uppercase font-bold">Refresh Sources</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {sources.map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedSource(s.id)}
                          className={`group p-4 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all text-center relative overflow-hidden ${selectedSource === s.id ? 'bg-purple-950/20 border-purple-600' : 'bg-gray-950/50 border-gray-900 hover:border-gray-800'}`}
                        >
                          <img src={s.thumbnail} className={`w-full h-24 object-cover rounded-xl transition-all ${selectedSource === s.id ? 'opacity-100 scale-105' : 'opacity-40 group-hover:opacity-60'}`} />
                          <span className={`text-xs font-semibold truncate w-full ${selectedSource === s.id ? 'text-white' : 'text-gray-500'}`}>{s.name}</span>
                          {selectedSource === s.id && (
                            <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1">
                              <CheckCircle2 size={12} fill="currentColor" className="text-purple-600 bg-white rounded-full shadow-lg" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="bg-gray-900/40 p-5 rounded-3xl border border-gray-800/60 group hover:border-gray-700/80 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                          <Mic size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Native Microphone</p>
                          <p className="text-[10px] text-gray-500">Enable to record your voice locally</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setCaptureMic(!captureMic)}
                        className={`w-12 h-6 rounded-full transition-all relative outline outline-1 outline-gray-800 ${captureMic ? 'bg-purple-600' : 'bg-gray-950'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${captureMic ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </button>
                    </div>
                  </section>

                  <button 
                    onClick={handleStart}
                    disabled={!selectedSource}
                    className="w-full py-5 bg-white text-black font-black text-sm uppercase tracking-tighter rounded-3xl hover:bg-gray-200 active:scale-[0.97] transition-all disabled:opacity-30 shadow-[0_10px_30px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 mt-10"
                  >
                    <div className="w-4 h-4 rounded-full bg-red-600 animate-ping absolute opacity-30"></div>
                    <div className="w-4 h-4 rounded-full bg-red-600 relative"></div>
                    Capture Meeting
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center pt-16 space-y-12">
                  <div className="relative">
                    <div className="w-48 h-48 rounded-full border border-purple-500/20 flex items-center justify-center ring-8 ring-purple-600/5">
                      <div className="w-36 h-36 rounded-full border-2 border-purple-500 flex items-center justify-center animate-pulse">
                         <div className="w-16 h-16 bg-red-600 rounded-2xl shadow-[0_0_40px_-5px_rgba(220,38,38,0.8)]"></div>
                      </div>
                    </div>
                    {/* Floating Audio Waves */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1 h-8 items-end">
                      {[1,2,3,4,5,6,7,8].map(i => (
                        <div key={i} className="w-1.5 bg-purple-500 rounded-full animate-wave" style={{height: `${Math.random()*100}%`, animationDelay: `${i*100}ms`}}></div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <h2 className="text-3xl font-black italic tracking-tight uppercase">
                      {status === 'stopped' ? 'Capture Complete' : 'LIVE CAPTURE'}
                    </h2>
                    <p className="text-gray-500 text-xs mt-2 font-mono tabular-nums tracking-widest bg-gray-900/50 py-1 px-4 rounded-full border border-gray-800">
                      {new Date(elapsedTime).toISOString().substr(11, 8)}
                    </p>
                  </div>

                  <div className="flex items-center gap-8">
                    {status !== 'stopped' ? (
                      <>
                        <button 
                          onClick={status === 'recording' ? pauseRecording : resumeRecording}
                          className="p-5 bg-gray-900 rounded-3xl text-white hover:bg-gray-800 transition-all border border-gray-800 shadow-xl"
                        >
                          {status === 'recording' ? <Pause size={28} /> : <Play size={28} />}
                        </button>
                        <button 
                          onClick={stopRecording}
                          className="p-10 bg-red-600/10 text-red-500 rounded-[40px] hover:bg-red-600/20 active:scale-95 transition-all outline outline-2 outline-red-600/30 shadow-[0_0_50px_-10px_rgba(220,38,38,0.2)]"
                        >
                          <Square size={40} fill="currentColor" />
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => { reset(); setActiveTab('history'); }}
                        className="px-12 py-5 bg-purple-600 text-white font-bold rounded-3xl hover:bg-purple-500 transition-all shadow-lg"
                      >
                        Return to Library
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'history' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-300 max-w-xl mx-auto">
              {recordings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-700">
                  <div className="p-10 rounded-full bg-gray-900/30 mb-6">
                    <History size={64} className="opacity-10" />
                  </div>
                  <p className="text-sm font-medium">Your library is empty</p>
                  <p className="text-xs text-gray-500 mt-1 text-center max-w-[200px]">Record meeting audio and it will appear here for AI analysis.</p>
                </div>
              ) : (
                recordings.map(r => (
                  <div key={r.id} onClick={() => setSelectedRecordingId(r.id)} className="cursor-pointer active:scale-[0.99] transition-transform">
                    <RecordingCard 
                      recording={r} 
                      onDelete={() => handleDelete(r.id)} 
                    />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300 max-w-xl mx-auto">
              <SettingsPage />
            </div>
          )}
        </main>
      </div>
      
      <style>{`
        .window-drag { -webkit-app-region: drag; }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        .animate-wave {
          transform-origin: bottom;
          animation: wave infinite ease-in-out;
        }
      `}</style>
    </div>
  )
}
