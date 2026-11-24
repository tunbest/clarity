import React, { useMemo, useState } from 'react';
import { Copy, Mail, FileText, ClipboardPaste, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Project } from '../types';

type CommunicationMode = 'mep-start' | 'mep-end' | 'coproj';
interface DraftContent { subject: string; body: string; }
const value = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 'À compléter';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : 'À compléter';
  return String(v);
};
const cleanTeamsTranscript = (source: string) => source
  .replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n?/i, '').replace(/^\d+\s*$/gm, '')
  .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}[^\n]*\n?/g, '')
  .replace(/<v\s+([^>]+)>/gi, '$1 : ').replace(/<\/?v>/gi, '').replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n').trim();

export const CommunicationAssistant: React.FC<{ projects: Project[]; meps: any[] }> = ({ projects, meps }) => {
  const [mode, setMode] = useState<CommunicationMode>('coproj');
  const [selectedMepId, setSelectedMepId] = useState(meps[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [recipientText, setRecipientText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<DraftContent>({ subject: '', body: '' });
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<'info' | 'success' | 'warning'>('info');
  const selectedMep = useMemo(() => meps.find((m) => m.id === selectedMepId), [meps, selectedMepId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === (mode === 'coproj' ? selectedProjectId : selectedMep?.projectId)), [projects, mode, selectedProjectId, selectedMep]);

  const createDraft = () => {
    if (mode !== 'coproj' && !selectedMep) { setMessage('Sélectionnez une MEP.'); setNotice('warning'); return; }
    if (mode === 'coproj' && transcript.trim().length < 20) { setMessage('Collez les notes ou la transcription Teams Copilot.'); setNotice('warning'); return; }
    const projectName = selectedProject?.name || selectedMep?.project || 'Projet à préciser';
    let subject = '';
    let body = '';
    if (mode === 'mep-start' || mode === 'mep-end') {
      const m = selectedMep;
      const start = mode === 'mep-start';
      subject = (start ? 'DÉBUT MEP – ' : 'FIN MEP – ') + (m.title || m.ref || m.id);
      body = [
        'Bonjour,', '',
        start ? 'La mise en production est prévue selon les éléments suivants :' : 'Voici le point de clôture de la mise en production :', '',
        'Projet : ' + projectName, 'MEP : ' + value(m.title), 'Référence : ' + value(m.ref || m.id),
        'Date / créneau : ' + value(m.date), 'Version : ' + value(m.version), 'Environnement : ' + value(m.environment),
        'Change : ' + value(m.changeNumbers), 'RITM : ' + value(m.ritmNumbers), 'Responsable : ' + value(m.owner),
        'Intervenants : ' + ((m.people || []).map((p: any) => (p.name || 'À préciser') + ' (' + (p.role || 'rôle à préciser') + ')').join(', ') || 'À compléter'),
        'Statut actuel : ' + value(m.status), '',
        start ? 'Pré-requis / validations :' : 'Résultat et contrôles réalisés :',
        start ? '- GO / NO-GO : ' + value(m.goNoGo) : '- Résultat réel : À renseigner avant envoi',
        start ? '- Déroulé : ' + ((m.tasks || []).map((t: any) => t.title).filter(Boolean).join('; ') || 'À compléter') : '- Tests / contrôles : À renseigner',
        '', 'Plan de retour arrière :', value(m.rollback), '', 'Périmètre : ' + value(m.description), '',
        start ? 'Merci de signaler toute réserve avant le démarrage.' : 'Merci de confirmer le retour au nominal et de signaler les réserves ou actions restantes.',
        '', 'Cordialement,'
      ].join('\n');
    } else {
      subject = 'Compte rendu COPROJ – ' + projectName + ' – ' + new Date().toLocaleDateString('fr-FR');
      body = [
        'Bonjour,', '', 'COMPTE RENDU – COMITÉ PROJET', 'Projet : ' + projectName,
        'Date : ' + new Date().toLocaleString('fr-FR'), '', '1. SYNTHÈSE / NOTES ISSUES DE TEAMS COPILOT',
        transcript.trim(), '', '2. DÉCISIONS VALIDÉES', 'À confirmer / compléter à partir des notes de réunion.',
        '', '3. PLAN D’ACTIONS', 'Action | Responsable | Échéance | Statut',
        'À compléter — ne pas attribuer de responsable ou de date non explicitement validés.',
        '', '4. RISQUES / ALERTES', 'À compléter.', '', '5. POINTS À ARBITRER ET PROCHAINES ÉTAPES',
        'À compléter.', '', 'Merci de me faire part de vos corrections ou compléments.', '', 'Cordialement,'
      ].join('\n');
    }
    setDraft({ subject, body });
    setMessage('Brouillon préparé localement. Aucun appel Gemini ni clé API.');
    setNotice('success');
  };

  const importTranscript = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(txt|vtt)$/i.test(file.name)) {
      setMessage('Import limité aux fichiers .txt et .vtt exportés depuis Teams.');
      setNotice('warning'); event.target.value = ''; return;
    }
    try {
      setTranscript(cleanTeamsTranscript(await file.text()));
      setMessage('Notes Teams importées : ' + file.name); setNotice('success');
    } catch {
      setMessage('Lecture impossible. Collez directement les notes Teams Copilot.'); setNotice('warning');
    }
    event.target.value = '';
  };

  const openOutlook = () => {
    if (!draft.subject.trim() || !draft.body.trim()) { setMessage('Le sujet et le contenu sont obligatoires.'); setNotice('warning'); return; }
    const recipients = recipientText.split(/[;,\n]/).map((x) => x.trim()).filter(Boolean).join(';');
    const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
    window.location.href = 'mailto:' + encodeURIComponent(recipients) + '?' + params.toString();
    setMessage('Ouverture demandée à Outlook. Vérifiez puis enregistrez le message comme brouillon ; rien n’est envoyé automatiquement.');
    setNotice('info');
  };
  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft.subject + '\n\n' + draft.body);
      setMessage('Objet et contenu copiés.'); setNotice('success');
    } catch { setMessage('Copie automatique indisponible dans ce navigateur.'); setNotice('warning'); }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div>
        <div className="flex items-center gap-2 text-indigo-700"><Mail className="w-4 h-4" /><span className="text-[11px] font-black uppercase tracking-wider">Communication production · Outlook</span></div>
        <h3 className="text-lg font-black text-slate-900 mt-1">Préparer un compte rendu ou un mail MEP</h3>
        <p className="text-xs text-slate-500 mt-1">Modèles locaux : aucun Gemini, aucune clé API et aucun service supplémentaire sur le VPS. Teams Copilot reste la source des notes.</p>
      </div>
      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-950 space-y-1">
        <b>Workflow Teams Copilot</b>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Dans Teams, demandez à Copilot le récapitulatif, les décisions et les actions.</li>
          <li>Copiez les notes ou importez le fichier Teams .TXT / .VTT.</li>
          <li>Préparez le compte rendu, relisez-le et ouvrez le message dans Outlook pour l’enregistrer comme brouillon.</li>
        </ol>
        <p className="font-semibold">Clarity ne lit pas automatiquement la réunion et ne fabrique pas les décisions, responsables ou échéances manquants.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-slate-700 space-y-1">Document
          <select value={mode} onChange={(e) => { setMode(e.target.value as CommunicationMode); setDraft({ subject: '', body: '' }); }} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
            <option value="coproj">Compte rendu COPROJ</option><option value="mep-start">Mail de début de MEP</option><option value="mep-end">Mail de fin de MEP</option>
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
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ClipboardPaste className="w-4 h-4 text-indigo-600" /> Notes / transcription Teams Copilot</div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-2"><Upload className="w-4 h-4" /> Importer .TXT / .VTT<input type="file" accept=".txt,.vtt,text/plain,text/vtt" onChange={importTranscript} className="sr-only" /></label>
            <span className="text-[11px] text-slate-500">Ou collez les notes Copilot ci-dessous.</span>
          </div>
          <textarea rows={10} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Collez ici les notes Copilot : synthèse, sujets, décisions, actions, responsables et échéances…" className="w-full border border-slate-300 rounded-xl p-3 text-sm leading-relaxed" />
        </div>
      ) : selectedMep ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Référence</div><b>{selectedMep.ref || selectedMep.id}</b></div>
          <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Date MEP</div><b>{value(selectedMep.date)}</b></div>
          <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Change</div><b>{value(selectedMep.changeNumbers)}</b></div>
          <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">RITM</div><b>{value(selectedMep.ritmNumbers)}</b></div>
        </div>
      ) : <p className="text-xs text-amber-700">Aucune MEP disponible. Créez une MEP pour préparer ses mails.</p>}
      <button onClick={createDraft} disabled={mode !== 'coproj' && !selectedMep} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Préparer le brouillon</button>
      {(draft.subject || draft.body) && <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText className="w-4 h-4" /> Brouillon à relire et modifier</div>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Destinataires (facultatif)
          <input value={recipientText} onChange={(e) => setRecipientText(e.target.value)} placeholder="equipe@entreprise.fr; production@entreprise.fr" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Objet
          <input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Contenu
          <textarea rows={mode === 'coproj' ? 16 : 12} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-normal leading-relaxed" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyDraft} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copier</button>
          <button onClick={openOutlook} className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Créer le brouillon dans Outlook</button>
        </div>
        <p className="text-[11px] text-slate-500">Outlook s’ouvre via le client de messagerie par défaut. Le message n’est pas envoyé automatiquement : enregistrez-le dans Outlook.</p>
      </div>}
      {message && <p role="status" className={'text-xs rounded-lg p-3 flex items-start gap-2 ' + (notice === 'success' ? 'bg-emerald-50 text-emerald-800' : notice === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600')}>{notice === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}{message}</p>}
    </section>
  );
};
