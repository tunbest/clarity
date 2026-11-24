import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Mail, FileText, Sparkles, Loader2, Mic, Square, MonitorUp, AudioLines, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Project } from '../types';

type CommunicationMode = 'mep-start' | 'mep-end' | 'coproj';
interface DraftContent { subject: string; body: string; }
const asText = (value: unknown) => value == null || value === '' ? 'Non renseigné' : String(value);

export const CommunicationAssistant: React.FC<{ projects: Project[]; meps: any[] }> = ({ projects, meps }) => {
  const [mode, setMode] = useState<CommunicationMode>('mep-start');
  const [selectedMepId, setSelectedMepId] = useState(meps[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [recipientText, setRecipientText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<DraftContent>({ subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<'info' | 'success' | 'warning'>('info');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0);

  const selectedMep = useMemo(() => meps.find((m) => m.id === selectedMepId), [meps, selectedMepId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === (mode === 'coproj' ? selectedProjectId : selectedMep?.projectId)), [projects, mode, selectedProjectId, selectedMep]);

  useEffect(() => {
    if (meps.length && !meps.some((m) => m.id === selectedMepId)) setSelectedMepId(meps[0].id);
  }, [meps, selectedMepId]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
  }, []);

  const buildContext = () => {
    if (mode === 'coproj') {
      const project = selectedProject;
      return {
        project: project ? { code: project.code, name: project.name, description: project.description, status: project.status, startDate: project.startDate, endDate: project.endDate } : null,
        tasks: (project?.tasks || []).map((t) => ({ title: t.title, status: t.status, assignee: project?.members?.find((member) => member.id === t.assigneeId)?.name || t.assigneeId || 'Non affecté', startDate: t.startDate, dueDate: t.dueDate, completion: t.completionPercent })),
        milestones: (project?.milestones || []).map((m) => ({ title: m.title, targetDate: m.targetDate, completed: m.completed })),
        risks: (project?.risks || []).map((r) => ({ title: r.title, status: r.status, probability: r.probability, impact: r.impact, mitigation: r.mitigationPlan })),
      };
    }
    if (!selectedMep) return null;
    const project = projects.find((p) => p.id === selectedMep.projectId);
    return {
      mep: {
        reference: selectedMep.ref || selectedMep.id, title: selectedMep.title, project: selectedMep.project,
        version: selectedMep.version, date: selectedMep.date, owner: selectedMep.owner, environment: selectedMep.environment,
        status: selectedMep.status, priority: selectedMep.priority, goNoGo: selectedMep.goNoGo,
        changeNumbers: selectedMep.changeNumbers, ritmNumbers: selectedMep.ritmNumbers, rollback: selectedMep.rollback,
        description: selectedMep.description, people: selectedMep.people, tasks: selectedMep.tasks,
      },
      project: project ? { code: project.code, name: project.name, status: project.status } : null,
    };
  };

  const generateDraft = async (selectedMode: CommunicationMode, meetingTranscript = '') => {
    if (selectedMode === 'coproj' && meetingTranscript.trim().length < 20) throw new Error('La transcription est trop courte pour préparer un compte rendu.');
    if (selectedMode !== 'coproj' && !selectedMep) throw new Error('Sélectionnez une MEP.');
    const response = await fetch('/api/communications/draft', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: selectedMode, context: buildContext(), transcript: meetingTranscript }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'La génération du brouillon a échoué.');
    setDraft({ subject: String(result.subject || ''), body: String(result.body || '') });
  };

  const uploadRecording = async (blob: Blob) => {
    if (!blob.size) { setMessage('Aucun son n’a été enregistré. Vérifiez le partage audio Teams.'); setNotice('warning'); return; }
    setBusy(true); setMessage('Envoi sécurisé au serveur Whisper et transcription en français…'); setNotice('info');
    try {
      const mime = blob.type || 'audio/webm';
      const response = await fetch('/api/meetings/transcribe', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': mime }, body: blob,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'La transcription a échoué.');
      const text = String(result.transcript || '').trim();
      if (!text) throw new Error('Whisper n’a détecté aucune parole exploitable.');
      setTranscript(text);
      setMessage('Transcription terminée. Préparation du compte rendu et du brouillon d’e-mail…');
      await generateDraft('coproj', text);
      setMessage('Transcription et brouillon COPROJ générés. Relisez et corrigez le contenu avant de l’utiliser.');
      setNotice('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur pendant la transcription.');
      setNotice('warning');
    } finally { setBusy(false); }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage('La capture audio nécessite un navigateur récent (Edge ou Chrome) et une connexion HTTPS.');
      setNotice('warning'); return;
    }
    try {
      setMessage('Sélectionnez l’écran Teams et cochez « Partager l’audio du système ».');
      setNotice('info');
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      displayStreamRef.current = display;
      const systemTracks = display.getAudioTracks();
      if (!systemTracks.length) {
        display.getTracks().forEach((track) => track.stop());
        displayStreamRef.current = null;
        throw new Error('Aucun audio système reçu. Relancez le partage et cochez « Partager l’audio du système ».');
      }

      let recordingStream = new MediaStream(systemTracks);
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = mic;
        const context = new AudioContext();
        audioContextRef.current = context;
        const destination = context.createMediaStreamDestination();
        context.createMediaStreamSource(new MediaStream(systemTracks)).connect(destination);
        context.createMediaStreamSource(mic).connect(destination);
        recordingStream = destination.stream;
      } catch {
        setMessage('Microphone non autorisé : seuls les sons reçus de Teams seront capturés.');
      }

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => { setMessage('Erreur de capture audio. Arrêtez puis relancez la capture.'); setNotice('warning'); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        displayStreamRef.current?.getTracks().forEach((track) => track.stop());
        micStreamRef.current?.getTracks().forEach((track) => track.stop());
        displayStreamRef.current = null; micStreamRef.current = null;
        void audioContextRef.current?.close(); audioContextRef.current = null;
        void uploadRecording(blob);
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      startedAtRef.current = Date.now();
      setElapsed(0); setRecording(true);
      setMessage('Clarity écoute la réunion. Les données audio restent sur le VPS pour la transcription Whisper.');
      setNotice('success');
      display.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state !== 'inactive') recorder.stop();
        setRecording(false);
      });
    } catch (error) {
      displayStreamRef.current?.getTracks().forEach((track) => track.stop());
      displayStreamRef.current = null;
      setMessage(error instanceof Error ? error.message : 'Impossible de démarrer la capture audio.');
      setNotice('warning');
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    setRecording(false);
  };

  const generateMepEmail = async () => {
    setBusy(true); setMessage('Préparation du mail par le serveur Clarity…'); setNotice('info');
    try {
      await generateDraft(mode);
      setMessage('Brouillon généré. Relisez et corrigez le contenu avant ouverture dans Outlook.');
      setNotice('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Génération impossible.');
      setNotice('warning');
    } finally { setBusy(false); }
  };

  const openOutlook = () => {
    if (!draft.subject.trim() || !draft.body.trim()) { setMessage('Le sujet et le contenu du mail sont obligatoires.'); setNotice('warning'); return; }
    const recipients = recipientText.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean).map(encodeURIComponent).join(',');
    const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
    window.location.href = `mailto:${recipients}?${params.toString()}`;
    setMessage('Outlook a été sollicité. Vérifiez le message dans les Brouillons ou la fenêtre de composition avant tout envoi.');
    setNotice('info');
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setMessage('Sujet et compte rendu copiés.'); setNotice('success');
  };
  const copyTranscript = async () => {
    await navigator.clipboard.writeText(transcript);
    setMessage('Transcription copiée.'); setNotice('success');
  };
  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div>
        <div className="flex items-center gap-2 text-indigo-700"><Sparkles className="w-4 h-4" /><span className="text-[11px] font-black uppercase tracking-wider">Clarity · Communication production</span></div>
        <h3 className="text-lg font-black text-slate-900 mt-1">Mails MEP & transcription des réunions</h3>
        <p className="text-xs text-slate-500 mt-1">Transcription locale au VPS avec Whisper. Aucun Copilot Studio, Microsoft Graph ou accès à votre boîte Outlook.</p>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-950 space-y-1">
        <b>Avant de démarrer une réunion Teams Desktop</b>
        <p>Utilisez Clarity dans Edge ou Chrome (HTTPS). Dans le sélecteur de partage, choisissez l’écran qui affiche Teams et activez « Partager l’audio du système ». Autorisez aussi le microphone si vous souhaitez inclure votre propre voix. Informez les participants et respectez les règles internes d’enregistrement.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-slate-700 space-y-1">Document à préparer
          <select value={mode} onChange={(e) => { setMode(e.target.value as CommunicationMode); setDraft({ subject: '', body: '' }); }} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
            <option value="mep-start">Mail de début de MEP</option>
            <option value="mep-end">Mail de fin de MEP</option>
            <option value="coproj">Transcription + CR COPROJ</option>
          </select>
        </label>
        {mode === 'coproj' ? (
          <label className="text-xs font-bold text-slate-700 space-y-1 lg:col-span-2">Projet concerné
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </label>
        ) : (
          <label className="text-xs font-bold text-slate-700 space-y-1 lg:col-span-2">MEP concernée
            <select value={selectedMepId} onChange={(e) => setSelectedMepId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
              {meps.map((m) => <option key={m.id} value={m.id}>{m.project} · {m.ref || m.id} · {m.title}</option>)}
            </select>
          </label>
        )}
      </div>

      {mode === 'coproj' ? (
        <div className="border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Mic className="w-4 h-4 text-indigo-600" /> Enregistrement Teams Desktop</div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={startRecording} disabled={recording || busy} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><MonitorUp className="w-4 h-4" /> Démarrer l’écoute</button>
            <button onClick={stopRecording} disabled={!recording} className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2"><Square className="w-3.5 h-3.5" /> Arrêter et transcrire</button>
            {recording && <span className="inline-flex items-center gap-2 text-sm font-bold text-rose-700"><span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" /> {formatTime(elapsed)}</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500"><AudioLines className="w-4 h-4" /> Capture en cours dans le navigateur ; transcription effectuée sur le serveur après l’arrêt.</div>
          {busy && <div className="flex items-center gap-2 text-xs text-indigo-700"><Loader2 className="w-4 h-4 animate-spin" /> {message}</div>}
        </div>
      ) : (
        <>
          {selectedMep && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Référence</div><b>{selectedMep.ref || selectedMep.id}</b></div>
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Date MEP</div><b>{asText(selectedMep.date)}</b></div>
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Change</div><b>{asText(selectedMep.changeNumbers)}</b></div>
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">RITM</div><b>{asText(selectedMep.ritmNumbers)}</b></div>
          </div>}
          <button onClick={generateMepEmail} disabled={busy} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> {busy ? 'Traitement…' : 'Générer le mail MEP'}</button>
        </>
      )}

      {mode === 'coproj' && transcript && <div className="space-y-2">
        <div className="flex items-center justify-between"><label className="text-xs font-bold text-slate-700">Transcription complète (modifiable)</label><button onClick={copyTranscript} className="text-xs font-bold text-indigo-700 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copier</button></div>
        <textarea rows={9} value={transcript} onChange={(e) => setTranscript(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 text-sm font-normal leading-relaxed" />
        <button onClick={async () => { setBusy(true); try { await generateDraft('coproj', transcript); setMessage('Compte rendu régénéré à partir de la transcription modifiée.'); setNotice('success'); } catch (e) { setMessage(e instanceof Error ? e.message : 'Génération impossible.'); setNotice('warning'); } finally { setBusy(false); } }} disabled={busy} className="px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold">Régénérer le CR depuis la transcription</button>
      </div>}

      {(draft.subject || draft.body) && <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText className="w-4 h-4" /> Brouillon à relire et modifier</div>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Destinataires (facultatif, séparés par ; ou ,)
          <input value={recipientText} onChange={(e) => setRecipientText(e.target.value)} placeholder="equipe@entreprise.fr; production@entreprise.fr" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Objet
          <input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Compte rendu / contenu du mail
          <textarea rows={mode === 'coproj' ? 16 : 12} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-normal leading-relaxed" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyDraft} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copier</button>
          <button onClick={openOutlook} disabled={busy} className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Ouvrir le brouillon dans Outlook</button>
        </div>
      </div>}

      {message && <p role="status" className={`text-xs rounded-lg p-3 flex items-start gap-2 ${notice === 'success' ? 'bg-emerald-50 text-emerald-800' : notice === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'}`}>{notice === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : notice === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Loader2 className={`w-4 h-4 shrink-0 ${busy ? 'animate-spin' : ''}`} />}{message}</p>}
    </section>
  );
};
