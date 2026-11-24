import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Mail, FileText, Sparkles, Loader2, Upload, CheckCircle2, AlertTriangle, ClipboardPaste } from 'lucide-react';
import { Project } from '../types';

type CommunicationMode = 'mep-start' | 'mep-end' | 'coproj';
interface DraftContent { subject: string; body: string; }
const asText = (value: unknown) => value == null || value === '' ? 'Non renseigné' : String(value);

const cleanTeamsTranscript = (value: string) => value
  .replace(/^\uFEFF/, '')
  .replace(/^WEBVTT[^\n]*\n?/i, '')
  .replace(/^\d+\s*$/gm, '')
  .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}[^\n]*\n?/g, '')
  .replace(/<v\s+([^>]+)>/gi, '$1 : ')
  .replace(/<\/?v>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

export const CommunicationAssistant: React.FC<{ projects: Project[]; meps: any[] }> = ({ projects, meps }) => {
  const [mode, setMode] = useState<CommunicationMode>('mep-start');
  const [selectedMepId, setSelectedMepId] = useState(meps[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [recipientText, setRecipientText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<DraftContent>({ subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<'info' | 'success' | 'warning'>('info');

  const selectedMep = useMemo(() => meps.find((m) => m.id === selectedMepId), [meps, selectedMepId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === (mode === 'coproj' ? selectedProjectId : selectedMep?.projectId)), [projects, mode, selectedProjectId, selectedMep]);

  useEffect(() => {
    if (meps.length && !meps.some((m) => m.id === selectedMepId)) setSelectedMepId(meps[0].id);
  }, [meps, selectedMepId]);

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
    if (selectedMode === 'coproj' && meetingTranscript.trim().length < 20) throw new Error('Collez ou importez d’abord la transcription Teams/Copilot.');
    if (selectedMode !== 'coproj' && !selectedMep) throw new Error('Sélectionnez une MEP.');
    const response = await fetch('/api/communications/draft', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: selectedMode, context: buildContext(), transcript: meetingTranscript }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'La génération du brouillon a échoué.');
    setDraft({ subject: String(result.subject || ''), body: String(result.body || '') });
  };

  const runGeneration = async (selectedMode: CommunicationMode, source = '') => {
    setBusy(true); setMessage('Préparation du document par Clarity…'); setNotice('info');
    try {
      await generateDraft(selectedMode, source);
      setMessage(selectedMode === 'coproj' ? 'Compte rendu COPROJ généré. Vérifiez les décisions, responsables et échéances.' : 'Brouillon généré. Relisez-le avant utilisation.');
      setNotice('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Génération impossible.');
      setNotice('warning');
    } finally { setBusy(false); }
  };

  const importTranscript = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|vtt)$/i.test(file.name)) {
      setMessage('Format non pris en charge. Importez un fichier .txt ou .vtt exporté depuis Teams.');
      setNotice('warning'); event.target.value = ''; return;
    }
    try {
      const text = cleanTeamsTranscript(await file.text());
      setTranscript(text);
      setMessage(`Transcription importée : ${file.name}`);
      setNotice('success');
    } catch {
      setMessage('Impossible de lire ce fichier. Copiez la transcription Teams dans la zone de texte.');
      setNotice('warning');
    }
    event.target.value = '';
  };

  const openOutlook = () => {
    if (!draft.subject.trim() || !draft.body.trim()) { setMessage('Le sujet et le contenu sont obligatoires.'); setNotice('warning'); return; }
    const recipients = recipientText.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean).map(encodeURIComponent).join(',');
    const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
    window.location.href = `mailto:${recipients}?${params.toString()}`;
    setMessage('Ouverture demandée à Outlook. Vérifiez le message dans la fenêtre de composition avant tout envoi.');
    setNotice('info');
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setMessage('Sujet et contenu copiés.'); setNotice('success');
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div>
        <div className="flex items-center gap-2 text-indigo-700"><Sparkles className="w-4 h-4" /><span className="text-[11px] font-black uppercase tracking-wider">Clarity · Communication production</span></div>
        <h3 className="text-lg font-black text-slate-900 mt-1">Mails MEP & compte rendu Teams</h3>
        <p className="text-xs text-slate-500 mt-1">La transcription est réalisée par Microsoft Teams / Copilot. Clarity ne capture aucun audio et n’ajoute aucun service sur le VPS.</p>
      </div>

      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-950 space-y-1">
        <b>Workflow Teams Copilot</b>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Pendant la réunion, ouvrez Copilot dans Teams et demandez le récapitulatif, les décisions et les actions.</li>
          <li>Copiez la réponse ou exportez la transcription Teams au format .vtt / .txt si elle est disponible.</li>
          <li>Collez le contenu ci-dessous ou importez le fichier, puis générez le CR dans Clarity.</li>
        </ol>
        <p className="font-semibold">Important : Copilot peut répondre pendant une réunion sans transcription activée, selon la licence et la politique Teams. Sans transcription/enregistrement, il ne garantit pas un verbatim complet après la réunion. Clarity ne se connecte pas automatiquement à la session Copilot.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-slate-700 space-y-1">Document à préparer
          <select value={mode} onChange={(e) => { setMode(e.target.value as CommunicationMode); setDraft({ subject: '', body: '' }); }} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
            <option value="mep-start">Mail de début de MEP</option>
            <option value="mep-end">Mail de fin de MEP</option>
            <option value="coproj">Compte rendu COPROJ (Teams/Copilot)</option>
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
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ClipboardPaste className="w-4 h-4 text-indigo-600" /> Transcription Teams / Copilot</div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-2"><Upload className="w-4 h-4" /> Importer .TXT / .VTT
              <input type="file" accept=".txt,.vtt,text/plain,text/vtt" onChange={importTranscript} className="sr-only" />
            </label>
            <span className="text-[11px] text-slate-500">Ou collez directement le texte copié depuis Copilot.</span>
          </div>
          <textarea rows={11} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Collez ici la transcription ou les notes Copilot : sujets abordés, décisions, actions, responsables, échéances…" className="w-full border border-slate-300 rounded-xl p-3 text-sm leading-relaxed" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => runGeneration('coproj', transcript)} disabled={busy || transcript.trim().length < 20} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> {busy ? 'Génération…' : 'Générer le CR COPROJ'}</button>
            <span className="text-[11px] text-slate-500 self-center">{transcript.trim().length.toLocaleString('fr-FR')} caractères</span>
          </div>
        </div>
      ) : (
        <>
          {selectedMep && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Référence</div><b>{selectedMep.ref || selectedMep.id}</b></div>
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Date MEP</div><b>{asText(selectedMep.date)}</b></div>
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Change</div><b>{asText(selectedMep.changeNumbers)}</b></div>
            <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">RITM</div><b>{asText(selectedMep.ritmNumbers)}</b></div>
          </div>}
          <button onClick={() => runGeneration(mode)} disabled={busy} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" /> {busy ? 'Traitement…' : 'Générer le mail MEP'}</button>
        </>
      )}

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
          <button onClick={openOutlook} disabled={busy} className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Ouvrir dans Outlook</button>
        </div>
      </div>}

      {message && <p role="status" className={`text-xs rounded-lg p-3 flex items-start gap-2 ${notice === 'success' ? 'bg-emerald-50 text-emerald-800' : notice === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600'}`}>{notice === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : notice === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Loader2 className={`w-4 h-4 shrink-0 ${busy ? 'animate-spin' : ''}`} />}{message}</p>}
    </section>
  );
};
