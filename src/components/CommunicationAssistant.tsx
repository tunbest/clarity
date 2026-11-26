import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Mail, FileText, ClipboardPaste, Upload, Download, CheckCircle2, AlertTriangle, Users } from 'lucide-react';
import { Project, PortfolioScope } from '../types';
import { updateCoproJTemplate } from '../utils/coproJPowerPoint';

type CommunicationMode = 'mep-start' | 'mep-end' | 'coproj';
interface DraftContent { subject: string; body: string; }
type Recipient = { id: string; name: string; email: string; to?: boolean; cc?: boolean; information?: boolean; sondes?: boolean; start?: boolean; end?: boolean; teams?: boolean; coproj?: boolean; pss?: boolean };

const displayValue = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 'Non renseigné';
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : 'Non renseigné';
  return String(v);
};
const categoryForMode = (mode: CommunicationMode, recipient: Recipient) =>
  mode === 'mep-start' ? Boolean(recipient.start)
    : mode === 'mep-end' ? Boolean(recipient.end)
      : Boolean(recipient.coproj || recipient.teams);

export const CommunicationAssistant: React.FC<{ projects: Project[]; meps: any[]; scopes?: PortfolioScope[]; allowedModes?: CommunicationMode[]; initialMode?: CommunicationMode }> = ({ projects, meps, scopes = [], allowedModes = ['coproj', 'mep-start', 'mep-end'], initialMode }) => {
  const [mode, setMode] = useState<CommunicationMode>(initialMode || allowedModes[0] || 'coproj');
  const [selectedMepId, setSelectedMepId] = useState(meps[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [selectedScopeId, setSelectedScopeId] = useState(scopes.find((scope) => projects.some((project) => project.scopeId === scope.id))?.id || scopes[0]?.id || '');
  const [raidNotes, setRaidNotes] = useState('');
  const [environmentNotes, setEnvironmentNotes] = useState('DEV : à renseigner\\nINT : à renseigner\\nRECETTE : à renseigner\\nPRÉPROD : à renseigner\\nPROD : à renseigner');
  const [actionNotes, setActionNotes] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = useState('');
  const [manualCcRecipients, setManualCcRecipients] = useState('');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<DraftContent>({ subject: '', body: '' });
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState<'info' | 'success' | 'warning'>('info');
  const [templateHandle, setTemplateHandle] = useState<any>(null);
  const [templateFileName, setTemplateFileName] = useState('');
  const selectedMep = useMemo(() => meps.find((m) => m.id === selectedMepId), [meps, selectedMepId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === (mode === 'coproj' ? selectedProjectId : selectedMep?.projectId)), [projects, mode, selectedProjectId, selectedMep]);
  const availableScopes = useMemo(() => scopes.filter((scope) => projects.some((project) => project.scopeId === scope.id)), [scopes, projects]);
  const selectedScope = useMemo(() => availableScopes.find((scope) => scope.id === selectedScopeId) || availableScopes[0], [availableScopes, selectedScopeId]);
  const scopeProjects = useMemo(() => selectedScope ? projects.filter((project) => project.scopeId === selectedScope.id) : [], [projects, selectedScope]);
  const scopeProjectIds = useMemo(() => new Set(scopeProjects.map((project) => project.id)), [scopeProjects]);
  const scopeMeps = useMemo(() => selectedScope ? meps.filter((m) => scopeProjectIds.has(String(m.projectId || '')) || (Array.isArray(m.scopeIds) && m.scopeIds.includes(selectedScope.id))) : [], [meps, selectedScope, scopeProjectIds]);
  const scopeRisks = useMemo(() => scopeProjects.flatMap((project) => (project.risks || []).map((risk) => ({ ...risk, projectName: project.name }))), [scopeProjects]);
  const scopeTasks = useMemo(() => scopeProjects.flatMap((project) => (project.tasks || []).map((task) => ({ ...task, projectName: project.name }))), [scopeProjects]);
  const scopeMilestones = useMemo(() => scopeProjects.flatMap((project) => (project.milestones || []).map((milestone) => ({ ...milestone, projectName: project.name }))), [scopeProjects]);
  const activeRecipients: Recipient[] = mode === 'coproj'
    ? Array.from(new Map(scopeProjects.flatMap((project) => project.members || []).filter((member) => member.email).map((member) => [member.id, member])).values()).map((member) => ({
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
  }, [selectedMepId, selectedProjectId, selectedScopeId, mode, meps, projects, scopes]);

  const createDraft = () => {
    if (mode === 'coproj' && !selectedScope) { setMessage('Sélectionnez un périmètre contenant vos projets.'); setNotice('warning'); return; }
    if (mode !== 'coproj' && !selectedMep) { setMessage('Sélectionnez une MEP.'); setNotice('warning'); return; }
    if (mode === 'coproj' && transcript.trim().length < 20) { setMessage('Collez les notes ou la transcription Teams Facilitator.'); setNotice('warning'); return; }
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
        `Trigrammes / code application : ${displayValue([...(m.trigrams || []), runbook.trigram, runbook.applicationCode].filter(Boolean).join(' / '))}`,
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
      const scopeName = selectedScope?.name || 'Périmètre à préciser';
      const projectLines = scopeProjects.map((p) => `• ${p.code} — ${p.name} — ${p.status} — ${p.managerName}`);
      const raidLines = scopeRisks.map((r) => `• RISQUE | ${r.projectName} | ${r.title} | ${r.status} | criticité ${Number(r.probability || 0) * Number(r.impact || 0)}/25 | mitigation : ${r.mitigationPlan || 'à définir'}`);
      const macroLines = [...scopeMilestones].sort((a,b) => String(a.targetDate).localeCompare(String(b.targetDate))).map((m) => `• ${m.projectName} | ${m.title} | ${m.targetDate || 'date à définir'} | ${m.completed ? 'Terminé' : 'À venir'}`);
      const detailedLines = [...scopeTasks].sort((a,b) => String(a.dueDate).localeCompare(String(b.dueDate))).map((t) => `• ${t.projectName} | ${t.title} | ${t.startDate || '—'} → ${t.dueDate || '—'} | ${t.completionPercent ?? 0}% | ${t.status} | ${t.assigneeId || 'à affecter'}`);
      const actionLines = scopeTasks.filter((t) => t.status === 'BLOCKED' || (t.dueDate && t.dueDate < new Date().toISOString().slice(0,10) && t.status !== 'DONE')).map((t) => `• ${t.projectName} | ${t.title} | pilote ${t.assigneeId || 'à affecter'} | échéance ${t.dueDate || 'à définir'} | ${t.status}`);
      subject = `COPROJ | ${scopeName} | ${new Date().toLocaleDateString('fr-FR')}`;
      body = [
        'Bonjour,',
        '',
        'COMPTE RENDU — COMITÉ DE PILOTAGE DE PÉRIMÈTRE',
        `Périmètre : ${scopeName}`,
        `Chef de projet : ${scopeProjects[0]?.managerName || 'À renseigner'}`,
        `Projets consolidés : ${scopeProjects.length}`,
        `Date : ${new Date().toLocaleDateString('fr-FR')}`,
        '',
        '1. PORTEFEUILLE DU PÉRIMÈTRE',
        ...(projectLines.length ? projectLines : ['• Aucun projet rattaché à ce périmètre.']),
        '',
        '2. SYNTHÈSE DE LA RÉUNION',
        transcript.trim(),
        '',
        '3. RAID — RISQUES, HYPOTHÈSES, PROBLÈMES, DÉPENDANCES',
        raidNotes.trim() || (raidLines.length ? raidLines.join('\\n') : 'Aucun risque enregistré. Hypothèses, problèmes et dépendances à compléter.'),
        '',
        '4. MACRO-PLANNING — JALONS',
        ...(macroLines.length ? macroLines : ['• Aucun jalon renseigné.']),
        '',
        '5. PLANNING DÉTAILLÉ — ACTIVITÉS',
        ...(detailedLines.length ? detailedLines : ['• Aucune tâche renseignée.']),
        '',
        '6. ÉTAT DES ENVIRONNEMENTS',
        environmentNotes.trim(),
        '',
        '7. PLAN D’ACTIONS',
        actionNotes.trim() || (actionLines.length ? actionLines.join('\\n') : 'Actions à compléter pendant le comité.'),
        '',
        '8. DÉCISIONS',
        'À valider et compléter à partir des notes de réunion.',
        '',
        '9. RISQUES ET ALERTES',
        raidNotes.trim() || (raidLines.length ? raidLines.join('\\n') : 'À compléter.'),
        '',
        '10. ARBITRAGES ATTENDUS',
        'À compléter.',
        '',
        '11. PROCHAINES ÉTAPES',
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


  const selectCoprojTemplate = async () => {
    try {
      const picker = (window as any).showOpenFilePicker;
      if (!picker) { setMessage('Cette fonction nécessite Microsoft Edge ou Google Chrome à jour, en HTTPS.'); setNotice('warning'); return; }
      const [handle] = await picker({ multiple: false, types: [{ description: 'Modèle PowerPoint COPROJ', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } }] });
      const file = await handle.getFile();
      if (!file.name.toLowerCase().endsWith('.pptx')) throw new Error('Sélectionnez un fichier .pptx.');
      setTemplateHandle(handle);
      setTemplateFileName(file.name);
      setMessage('Modèle sélectionné : ' + file.name + '. Il sera remplacé uniquement après création de la sauvegarde.');
      setNotice('success');
    } catch (error: any) {
      if (error?.name !== 'AbortError') { setMessage(error?.message || 'Impossible de sélectionner le modèle PowerPoint.'); setNotice('warning'); }
    }
  };

  const replaceCoprojTemplate = async () => {
    if (!selectedScope || !templateHandle) { setMessage('Sélectionnez d’abord le modèle PowerPoint de votre bureau.'); setNotice('warning'); return; }
    try {
      const savePicker = (window as any).showSaveFilePicker;
      if (!savePicker) throw new Error('La sauvegarde sécurisée nécessite Edge ou Chrome à jour.');
      const backupName = templateFileName.replace(/\.pptx$/i, '') + '_backup_' + new Date().toISOString().replace(/[:.]/g, '-') + '.pptx';
      if (!window.confirm('Clarity va préparer la mise à jour du modèle. Une sauvegarde complète sera créée avant remplacement. Confirmer ?')) return;
      const backupHandle = await savePicker({ suggestedName: backupName, types: [{ description: 'Sauvegarde PowerPoint', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } }] });
      const originalFile = await templateHandle.getFile();
      const data = {
        scopeName: selectedScope.name, scopeCode: selectedScope.code || '',
        date: new Date().toLocaleDateString('fr-FR'),
        projects: scopeProjects, meps: scopeMeps, risks: scopeRisks, tasks: scopeTasks,
        milestones: scopeMilestones, transcript, raidNotes, environmentNotes, actionNotes
      };
      const updated = await updateCoproJTemplate(await originalFile.arrayBuffer(), data);
      const backupStream = await backupHandle.createWritable();
      await backupStream.write(await originalFile.arrayBuffer());
      await backupStream.close();
      const targetStream = await templateHandle.createWritable();
      await targetStream.write(updated.bytes);
      await targetStream.close();
      setMessage('Modèle PowerPoint remplacé avec succès : ' + templateFileName + '. Sauvegarde créée : ' + backupName + '. Le modèle et ses 14 diapositives ont été conservés.');
      setNotice('success');
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || 'La mise à jour a échoué. Le fichier source n’a pas été remplacé si la sauvegarde ou la génération a échoué.');
      setNotice('warning');
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div>
        <h3 className="text-lg font-black text-slate-900">{mode === 'coproj' ? 'Compte rendu COPROJ' : 'Communications de MEP'}</h3>
        <p className="text-xs text-slate-500 mt-1">{mode === 'coproj' ? 'Collez les notes générées par Teams Facilitator pour préparer le compte rendu du périmètre.' : 'Les mails de début et de fin restent rattachés à une MEP.'}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {allowedModes.length > 1 && <label className="text-xs font-bold text-slate-700 space-y-1">Document
          <select value={mode} onChange={(e) => { setMode(e.target.value as CommunicationMode); setDraft({ subject: '', body: '' }); }} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
            {allowedModes.includes('coproj') && <option value="coproj">Compte rendu COPROJ</option>}{allowedModes.includes('mep-start') && <option value="mep-start">Mail de début de MEP</option>}{allowedModes.includes('mep-end') && <option value="mep-end">Mail de fin de MEP</option>}
          </select>
        </label>}
        <label className="text-xs font-bold text-slate-700 space-y-1">{mode === 'coproj' ? 'Périmètre du COPROJ' : 'MEP concernée'}
          {mode === 'coproj'
            ? <select value={selectedScope?.id || ''} onChange={(e) => setSelectedScopeId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">{availableScopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.code} · {scope.name}</option>)}</select>
            : <select value={selectedMepId} onChange={(e) => setSelectedMepId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">{meps.map((m) => <option key={m.id} value={m.id}>{m.project} · {m.ref || m.id} · {m.title}</option>)}</select>}
        </label>
        <div className="text-xs font-bold text-slate-700 space-y-1">
          <span>{mode === 'coproj' ? 'Destinataires du projet' : 'Destinataires issus de la MEP'}</span>
          {mode === 'coproj'
            ? <p className="font-normal text-slate-500">Les membres de tous les projets du périmètre sont regroupés sans doublon.</p>
            : <select value={selectedMepId} onChange={(e) => setSelectedMepId(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">{meps.map((m) => <option key={m.id} value={m.id}>{m.project} · {m.ref || m.id} · {m.title}</option>)}</select>}
        </div>
      </div>
      {mode === 'coproj' ? (
        <div className="space-y-4">
        <div className="border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ClipboardPaste className="w-4 h-4 text-indigo-600" /> Notes / transcription Teams Facilitator</div>
          <p className="text-[11px] text-slate-500">Copiez les notes depuis le récapitulatif Teams Facilitator et collez-les directement ci-dessous.</p>
          <textarea rows={8} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Collez ici les notes Facilitator : synthèse, décisions, actions, responsables et échéances…" className="w-full border border-slate-300 rounded-xl p-3 text-sm leading-relaxed" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-700 space-y-1">RAID consolidé (modifiable)
            <textarea rows={7} value={raidNotes} onChange={(e) => setRaidNotes(e.target.value)} placeholder={scopeRisks.map((r) => `RISQUE | ${r.projectName} | ${r.title} | ${r.status} | ${r.mitigationPlan || 'Mitigation à définir'}`).join('\\n') || 'Risque / Hypothèse / Problème / Dépendance — description — criticité — responsable — échéance — statut'} className="w-full border border-slate-300 rounded-xl p-3 font-normal leading-relaxed" />
          </label>
          <label className="text-xs font-bold text-slate-700 space-y-1">État des environnements (modifiable)
            <textarea rows={7} value={environmentNotes} onChange={(e) => setEnvironmentNotes(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 font-normal leading-relaxed" />
          </label>
          <label className="text-xs font-bold text-slate-700 space-y-1 lg:col-span-2">Plan d’actions consolidé (modifiable)
            <textarea rows={6} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder={scopeTasks.filter((t) => t.status === 'BLOCKED').map((t) => `${t.projectName} | ${t.title} | ${t.assigneeId || 'Pilote à affecter'} | ${t.dueDate || 'Échéance à définir'} | ${t.status}`).join('\\n') || 'Action | Responsable | Échéance | Priorité | Statut'} className="w-full border border-slate-300 rounded-xl p-3 font-normal leading-relaxed" />
          </label>
        </div>
        <div className="rounded-xl border border-slate-200 p-3 text-xs space-y-2"><b>Plannings consolidés</b><p className="text-slate-500">Macro-planning : {scopeMilestones.length} jalon(s). Planning détaillé : {scopeTasks.length} tâche(s), triées par échéance dans le support.</p><p className="text-slate-500">MEP consolidées : {scopeMeps.length} opération(s) du périmètre.</p></div>
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
        <label className="block text-xs font-bold text-slate-700 space-y-1">Adresses en À (séparées par virgule, point-virgule ou retour à la ligne)
          <textarea rows={2} value={manualRecipients} onChange={(e) => setManualRecipients(e.target.value)} placeholder="equipe@entreprise.fr, production@entreprise.fr" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
        {mode === 'coproj' && <label className="block text-xs font-bold text-slate-700 space-y-1">Adresses en Cc (facultatif)
          <textarea rows={2} value={manualCcRecipients} onChange={(e) => setManualCcRecipients(e.target.value)} placeholder="responsable@entreprise.fr; direction@entreprise.fr" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>}
      </div>
      <div className="flex flex-wrap gap-2"><button onClick={createDraft} disabled={(mode === 'coproj' ? !selectedScope || transcript.trim().length < 20 : !selectedMep)} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Préparer le brouillon</button>{mode === 'coproj' && <><button onClick={selectCoprojTemplate} className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-2"><Upload className="w-4 h-4" /> {templateFileName ? 'Changer le modèle' : 'Sélectionner le modèle du bureau'}</button><button onClick={replaceCoprojTemplate} disabled={!templateHandle || !selectedScope} className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Download className="w-4 h-4" /> Remplacer le PowerPoint existant</button></>}</div>
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
