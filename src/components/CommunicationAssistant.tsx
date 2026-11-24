import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Mail, FileText, ClipboardPaste, Upload, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { Project } from '../types';

type CommunicationMode = 'mep-start' | 'mep-end' | 'coproj';
interface DraftContent { subject: string; body: string; }
type Recipient = { id: string; name: string; email: string; to?: boolean; cc?: boolean; information?: boolean; sondes?: boolean; start?: boolean; end?: boolean; teams?: boolean; coproj?: boolean; pss?: boolean };

const displayValue = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 'Non renseigné';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : 'Non renseigné';
  return String(v);
};
const cleanTeamsTranscript = (source: string) => source
  .replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n?/i, '').replace(/^\d+\s*$/gm, '')
  .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}[^\n]*\n?/g, '')
  .replace(/<v\s+([^>]+)>/gi, '$1 : ').replace(/<\/?v>/gi, '').replace(/<[^>]+>/g, '')
  .replace(/\n{3,}/g, '\n\n').trim();
const categoryForMode = (mode: CommunicationMode, recipient: Recipient) =>
  mode === 'mep-start' ? Boolean(recipient.start)
    : mode === 'mep-end' ? Boolean(recipient.end)
      : Boolean(recipient.coproj || recipient.teams);

export const CommunicationAssistant: React.FC<{ projects: Project[]; meps: any[] }> = ({ projects, meps }) => {
  const [mode, setMode] = useState<CommunicationMode>('coproj');
  const [selectedMepId, setSelectedMepId] = useState(meps[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = useState('');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<DraftContent>({ subject: '', body: '' });
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<'info' | 'success' | 'warning'>('info');
  const selectedMep = useMemo(() => meps.find((m) => m.id === selectedMepId), [meps, selectedMepId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === (mode === 'coproj' ? selectedProjectId : selectedMep?.projectId)), [projects, mode, selectedProjectId, selectedMep]);
  const activeRecipients: Recipient[] = mode === 'coproj'
    ? (selectedProject?.members || []).filter((member) => member.email).map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        to: true,
        cc: false,
        coproj: true
      }))
    : selectedMep?.runbook?.recipients || [];

  useEffect(() => {
    const eligible = mode === 'coproj'
      ? activeRecipients
      : activeRecipients.filter((recipient) => categoryForMode(mode, recipient));
    setSelectedRecipientIds(eligible.map((recipient) => recipient.id));
  }, [selectedMepId, selectedProjectId, mode, meps, projects]);

  const createDraft = () => {
    if (mode === 'coproj' && !selectedProject) { setMessage('Sélectionnez le projet concerné.'); setNotice('warning'); return; }
    if (mode !== 'coproj' && !selectedMep) { setMessage('Sélectionnez une MEP.'); setNotice('warning'); return; }
    if (mode === 'coproj' && transcript.trim().length < 20) { setMessage('Collez les notes ou la transcription Teams Copilot.'); setNotice('warning'); return; }
    const projectName = selectedProject?.name || selectedMep?.project || 'Projet à préciser';
    const m = selectedMep;
    let subject = '';
    let body = '';
    if (mode === 'mep-start' || mode === 'mep-end') {
      const start = mode === 'mep-start';
      const runbook = m.runbook || {};
      const prerequisites = (runbook.prerequisites || []).filter((x: any) => x.title).map((x: any) =>
        `• ${x.title} — ${x.status || 'À faire'}${x.owner ? ' — Responsable : ' + x.owner : ''}${x.reference ? ' — Réf. : ' + x.reference : ''}`);
      const steps = (runbook.executionSteps || []).filter((x: any) => x.title).map((x: any, i: number) =>
        `${i + 1}. ${x.title}${x.startTime || x.endTime ? ' (' + (x.startTime || '—') + ' à ' + (x.endTime || '—') + ')' : ''} — ${x.actor || 'Acteur à confirmer'}`);
      const people = (m.people || []).map((p: any) => `• ${p.name || 'À préciser'} — ${p.role || 'Rôle à préciser'}`);
      subject = `${start ? 'DÉMARRAGE' : 'CLÔTURE'} DE MISE EN PRODUCTION | ${m.title || m.ref || m.id}`;
      const lines = [
        'Bonjour,',
        '',
        start
          ? 'La mise en production ci-dessous va démarrer. Merci de prendre connaissance des informations et de signaler immédiatement toute réserve.'
          : 'La mise en production est terminée. Vous trouverez ci-dessous les éléments de clôture à confirmer.',
        '',
        'SYNTHÈSE DE LA MEP',
        `Projet : ${projectName}`,
        `Opération : ${displayValue(m.title)}`,
        `Référence MEP : ${displayValue(m.ref || m.id)}`,
        `Date et créneau : ${displayValue(m.date)}`,
        `Application / version : ${displayValue(m.version)}`,
        `Environnement : ${displayValue(m.environment)}`,
        `Change : ${displayValue(m.changeNumbers)}`,
        `RITM : ${displayValue(m.ritmNumbers)}`,
        `Pilote : ${displayValue(m.owner)}`,
        `Téléphone du pilotage : ${displayValue(runbook.pilotPhone)}`,
        `Trigramme / code application : ${displayValue([runbook.trigram, runbook.applicationCode].filter(Boolean).join(' / '))}`,
        '',
        start ? 'PRÉREQUIS ET VALIDATIONS' : 'RÉSULTAT ET CONTRÔLES',
        ...(start ? (prerequisites.length ? prerequisites : ['• Prérequis à confirmer avec le pilotage.']) : [
          `• Statut de la MEP : ${displayValue(m.status)}`,
          '• Résultat des tests : à compléter avant envoi.',
          '• Retour au nominal / supervision : à confirmer.',
          '• Réserves et actions restantes : à compléter.'
        ]),
        '',
        'DÉROULÉ OPÉRATIONNEL',
        ...(steps.length ? steps : (m.tasks || []).filter((x: any) => x.title).map((x: any, i: number) => `${i + 1}. ${x.title} — ${x.status || 'À faire'}`)),
        '',
        'INTERVENANTS',
        ...(people.length ? people : ['• Liste des intervenants à confirmer.']),
        '',
        'PLAN DE RETOUR ARRIÈRE',
        displayValue(m.rollback),
        '',
        'PÉRIMÈTRE / COMMENTAIRES',
        displayValue(m.description),
        '',
        start
          ? 'Merci de confirmer votre disponibilité et de remonter toute alerte avant le GO.'
          : 'Merci de confirmer la bonne fin de l’opération et de transmettre toute réserve ou action complémentaire.',
        '',
        'Cordialement,'
      ];
      body = lines.join('\n');
    } else {
      subject = `Compte rendu COPROJ | ${projectName} | ${new Date().toLocaleDateString('fr-FR')}`;
      body = [
        'Bonjour,',
        '',
        'COMPTE RENDU — COMITÉ DE PILOTAGE PROJET',
        `Projet : ${projectName}`,
        `Date : ${new Date().toLocaleDateString('fr-FR')}`,
        '',
        '1. SYNTHÈSE DE LA RÉUNION',
        transcript.trim(),
        '',
        '2. DÉCISIONS',
        'À valider et compléter à partir des notes de réunion.',
        '',
        '3. PLAN D’ACTIONS',
        'Action :',
        'Responsable :',
        'Échéance :',
        'Statut :',
        '',
        '4. RISQUES ET ALERTES',
        'À compléter.',
        '',
        '5. ARBITRAGES ATTENDUS',
        'À compléter.',
        '',
        '6. PROCHAINES ÉTAPES',
        'À compléter.',
        '',
        'Merci de me transmettre vos corrections ou compléments.',
        '',
        'Cordialement,'
      ].join('\n');
    }
    setDraft({ subject, body });
    setMessage('Brouillon structuré. Vérifiez les informations avant ouverture dans Outlook.');
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
    const selected = activeRecipients.filter((recipient) => selectedRecipientIds.includes(recipient.id));
    const to = selected.filter((recipient) => recipient.to !== false && recipient.email).map((recipient) => recipient.email);
    const cc = selected.filter((recipient) => recipient.cc && recipient.email).map((recipient) => recipient.email);
    const manual = manualRecipients.split(/[;,\n]/).map((x) => x.trim()).filter(Boolean);
    const uniqueTo = Array.from(new Set([...to, ...manual]));
    const uniqueCc = Array.from(new Set(cc.filter((email) => !uniqueTo.includes(email))));
    const encodeList = (items: string[]) => items.map((email) => encodeURIComponent(email)).join(',');
    // Do not use URLSearchParams here: it encodes spaces as '+', which some Outlook clients display literally.
    const query = [
      'subject=' + encodeURIComponent(draft.subject),
      uniqueCc.length ? 'cc=' + encodeList(uniqueCc) : '',
      'body=' + encodeURIComponent(draft.body).replace(/%0A/gi, '%0D%0A')
    ].filter(Boolean).join('&');
    window.location.href = 'mailto:' + encodeList(uniqueTo) + '?' + query;
    setMessage('Ouverture demandée à Outlook. Vérifiez les champs À/Cc puis enregistrez le message comme brouillon ; rien n’est envoyé automatiquement.');
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
        <h3 className="text-lg font-black text-slate-900 mt-1">Préparer un compte rendu projet ou un mail MEP</h3>
        <p className="text-xs text-slate-500 mt-1">Le compte rendu COPROJ est rattaché au projet ; les mails de début et de fin restent rattachés à une MEP.</p>
      </div>
      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-950 space-y-1">
        <b>Workflow Teams Copilot</b>
        <ol className="list-decimal pl-4 space-y-1">
          <li>Dans Teams, demandez à Copilot le récapitulatif, les décisions et les actions.</li>
          <li>Copiez les notes ou importez le fichier Teams .TXT / .VTT.</li>
          <li>Relisez le compte rendu puis ouvrez le message dans Outlook pour l’enregistrer comme brouillon.</li>
        </ol>
        <p className="font-semibold">Clarity ne lit pas automatiquement la réunion et ne crée pas de décision, responsable ou échéance non présent dans les notes.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-slate-700 space-y-1">Document
          <select value={mode} onChange={(e) => { setMode(e.target.value as CommunicationMode); setDraft({ subject: '', body: '' }); }} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
            <option value="coproj">Compte rendu COPROJ</option><option value="mep-start">Mail de début de MEP</option><option value="mep-end">Mail de fin de MEP</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-700 space-y-1">{mode === 'coproj' ? 'Projet concerné' : 'MEP concernée'}
          {mode === 'coproj'
            ? <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">{projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select>
            : <select value={selectedMepId} onChange={(e) => setSelectedMepId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">{meps.map((m) => <option key={m.id} value={m.id}>{m.project} · {m.ref || m.id} · {m.title}</option>)}</select>}
        </label>
        <div className="text-xs font-bold text-slate-700 space-y-1">
          <span>{mode === 'coproj' ? 'Destinataires du projet' : 'Destinataires issus de la MEP'}</span>
          {mode === 'coproj'
            ? <p className="font-normal text-slate-500">Les membres du projet sont proposés automatiquement.</p>
            : <select value={selectedMepId} onChange={(e) => setSelectedMepId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">{meps.map((m) => <option key={m.id} value={m.id}>{m.project} · {m.ref || m.id} · {m.title}</option>)}</select>}
        </div>
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
          <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Date MEP</div><b>{displayValue(selectedMep.date)}</b></div>
          <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Change</div><b>{displayValue(selectedMep.changeNumbers)}</b></div>
          <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">RITM</div><b>{displayValue(selectedMep.ritmNumbers)}</b></div>
        </div>
      ) : null}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Users className="w-4 h-4 text-indigo-600" /> {mode === 'coproj' ? 'Équipe et destinataires du projet' : 'Carnet de destinataires de la MEP'}</div>
        {activeRecipients.length ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{activeRecipients.map((recipient) => (
          <label key={recipient.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-xs">
            <input type="checkbox" checked={selectedRecipientIds.includes(recipient.id)} onChange={(e) => setSelectedRecipientIds((current) => e.target.checked ? [...current, recipient.id] : current.filter((id) => id !== recipient.id))} />
            <span className="min-w-0 flex-1"><b className="block truncate">{recipient.name || recipient.email}</b><span className="text-slate-500">{recipient.email} · {recipient.cc ? 'Cc' : 'À'}</span></span>
            <span className="text-[10px] text-slate-400">{[recipient.information && 'Info', recipient.sondes && 'Sondes', recipient.start && 'Début', recipient.end && 'Fin', recipient.coproj && 'COPROJ'].filter(Boolean).join(' / ')}</span>
          </label>
        ))}</div> : <p className="text-xs text-slate-500">{mode === 'coproj' ? 'Aucun membre avec adresse e-mail dans ce projet. Ajoutez les membres au projet ou saisissez des adresses ponctuelles.' : 'Aucun destinataire enregistré sur cette MEP. Ajoutez-les dans Pilotage → Paramètres & destinataires.'}</p>}
        <label className="block text-xs font-bold text-slate-700 space-y-1">Ajouter des adresses ponctuelles en À (facultatif)
          <input value={manualRecipients} onChange={(e) => setManualRecipients(e.target.value)} placeholder="equipe@entreprise.fr; production@entreprise.fr" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
      </div>
      <button onClick={createDraft} disabled={(mode === 'coproj' ? !selectedProject || transcript.trim().length < 20 : !selectedMep)} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Préparer le brouillon</button>
      {(draft.subject || draft.body) && <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText className="w-4 h-4" /> Brouillon à relire et modifier</div>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Objet
          <input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Contenu
          <textarea rows={mode === 'coproj' ? 18 : 18} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-normal leading-relaxed whitespace-pre-wrap" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyDraft} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copier</button>
          <button onClick={openOutlook} className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Créer le brouillon dans Outlook</button>
        </div>
        <p className="text-[11px] text-slate-500">Les espaces et retours à la ligne sont encodés sans caractère « + ». Outlook s’ouvre avec les champs À/Cc. Enregistrez le message comme brouillon ; rien n’est envoyé automatiquement.</p>
      </div>}
      {message && <p role="status" className={'text-xs rounded-lg p-3 flex items-start gap-2 ' + (notice === 'success' ? 'bg-emerald-50 text-emerald-800' : notice === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-600')}>{notice === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}{message}</p>}
    </section>
  );
};
