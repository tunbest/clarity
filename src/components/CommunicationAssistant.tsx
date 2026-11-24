import React, { useEffect, useMemo, useState } from 'react';
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';
import { CopilotStudioClient, ConnectionSettings } from '@microsoft/agents-copilotstudio-client';
import { Copy, Mail, FileText, Sparkles, Save, Settings2, Loader2, ExternalLink } from 'lucide-react';
import { Project } from '../types';

type CommunicationMode = 'mep-start' | 'mep-end' | 'coproj';
interface CopilotSettings {
  tenantId: string;
  appClientId: string;
  environmentId: string;
  schemaName: string;
}
interface DraftContent { subject: string; body: string; }

const SETTINGS_KEY = 'clarity.copilotStudio.settings.v1';
const DEFAULT_SETTINGS: CopilotSettings = {
  tenantId: '',
  appClientId: '',
  environmentId: '',
  schemaName: 'cr299_clarity_tB6p_X',
};
const readSettings = (): CopilotSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch { return DEFAULT_SETTINGS; }
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char] || char));
const asText = (value: unknown) => value == null || value === '' ? 'Non renseigné' : String(value);

export const CommunicationAssistant: React.FC<{ projects: Project[]; meps: any[] }> = ({ projects, meps }) => {
  const [settings, setSettings] = useState<CopilotSettings>(readSettings);
  const [mode, setMode] = useState<CommunicationMode>('mep-start');
  const [selectedMepId, setSelectedMepId] = useState(meps[0]?.id || '');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [recipientText, setRecipientText] = useState('');
  const [draft, setDraft] = useState<DraftContent>({ subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState('');
  const [msal, setMsal] = useState<PublicClientApplication | null>(null);

  const selectedMep = useMemo(() => meps.find((m) => m.id === selectedMepId), [meps, selectedMepId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === (mode === 'coproj' ? selectedProjectId : selectedMep?.projectId)), [projects, mode, selectedProjectId, selectedMep]);

  useEffect(() => {
    if (meps.length && !meps.some((m) => m.id === selectedMepId)) setSelectedMepId(meps[0].id);
  }, [meps, selectedMepId]);

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setMessage('Configuration enregistrée dans ce navigateur. Aucun secret client n’est stocké.');
  };

  const getMsal = async () => {
    if (msal) return msal;
    if (!settings.tenantId.trim() || !settings.appClientId.trim()) {
      throw new Error('Renseignez le Tenant ID et le Client ID de votre application Microsoft Entra.');
    }
    const instance = new PublicClientApplication({
      auth: {
        clientId: settings.appClientId.trim(),
        authority: `https://login.microsoftonline.com/${settings.tenantId.trim()}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });
    await instance.initialize();
    setMsal(instance);
    return instance;
  };

  const acquireMicrosoftToken = async (scopes: string[]) => {
    const instance = await getMsal();
    const account = instance.getAllAccounts()[0];
    if (account) {
      try {
        const silent = await instance.acquireTokenSilent({ scopes, account });
        return silent.accessToken;
      } catch (error) {
        if (!(error instanceof InteractionRequiredAuthError)) throw error;
        const popup = await instance.acquireTokenPopup({ scopes, account });
        return popup.accessToken;
      }
    }
    const result = await instance.loginPopup({ scopes, prompt: 'select_account' });
    if (result.account) instance.setActiveAccount(result.account);
    return result.accessToken;
  };

  const connectCopilot = async () => {
    setBusy(true); setMessage('');
    try {
      const copilotSettings = new ConnectionSettings({
        environmentId: settings.environmentId.trim(),
        schemaName: settings.schemaName.trim(),
        tenantId: settings.tenantId.trim(),
        appClientId: settings.appClientId.trim(),
        authority: 'https://login.microsoftonline.com',
      });
      const token = await acquireMicrosoftToken([CopilotStudioClient.scopeFromSettings(copilotSettings)]);
      const client = new CopilotStudioClient(copilotSettings, token);
      const start = client.startConversationStreaming({ emitStartConversationEvent: false, locale: 'fr-FR' });
      let conversationId = '';
      for await (const activity of start) conversationId = activity.conversation?.id || conversationId;
      if (!conversationId) throw new Error('Copilot n’a pas retourné d’identifiant de conversation.');
      setConnected(true);
      setMessage('Connexion Copilot Studio établie.');
    } catch (error) {
      setConnected(false);
      setMessage(error instanceof Error ? error.message : 'Connexion Copilot impossible.');
    } finally { setBusy(false); }
  };

  const buildContext = () => {
    if (mode === 'coproj') {
      const project = selectedProject;
      return {
        project: project ? { code: project.code, name: project.name, description: project.description, status: project.status, startDate: project.startDate, endDate: project.endDate } : null,
        tasks: (project?.tasks || []).map((t) => ({ title: t.title, status: t.status, assignee: project?.members?.find((member) => member.id === t.assigneeId)?.name || t.assigneeId || 'Non affecté', startDate: t.startDate, dueDate: t.dueDate, completion: t.completionPercent })),
        milestones: (project?.milestones || []).map((m) => ({ title: m.title, targetDate: m.targetDate, completed: m.completed })),
        risks: (project?.risks || []).map((r) => ({ title: r.title, status: r.status, probability: r.probability, impact: r.impact, mitigation: r.mitigationPlan })),
        meetingNotes,
      };
    }
    if (!selectedMep) return null;
    const project = projects.find((p) => p.id === selectedMep.projectId);
    return {
      mep: {
        reference: selectedMep.ref || selectedMep.id,
        title: selectedMep.title,
        project: selectedMep.project,
        version: selectedMep.version,
        date: selectedMep.date,
        owner: selectedMep.owner,
        environment: selectedMep.environment,
        status: selectedMep.status,
        priority: selectedMep.priority,
        goNoGo: selectedMep.goNoGo,
        changeNumbers: selectedMep.changeNumbers,
        ritmNumbers: selectedMep.ritmNumbers,
        rollback: selectedMep.rollback,
        description: selectedMep.description,
        people: selectedMep.people,
        tasks: selectedMep.tasks,
      },
      project: project ? { code: project.code, name: project.name, status: project.status } : null,
    };
  };

  const generate = async () => {
    if (mode === 'coproj' && meetingNotes.trim().length < 20) {
      setMessage('Ajoutez les notes ou la transcription de la réunion (20 caractères minimum).'); return;
    }
    if (mode !== 'coproj' && !selectedMep) { setMessage('Sélectionnez une MEP.'); return; }
    if (!settings.environmentId.trim() || !settings.schemaName.trim()) {
      setMessage('Complétez l’Environment ID et le Schema name Copilot Studio.'); return;
    }
    setBusy(true); setMessage('Génération avec Copilot Studio…'); setSavedDraftId('');
    try {
      const copilotSettings = new ConnectionSettings({
        environmentId: settings.environmentId.trim(),
        schemaName: settings.schemaName.trim(),
        tenantId: settings.tenantId.trim(),
        appClientId: settings.appClientId.trim(),
        authority: 'https://login.microsoftonline.com',
      });
      const token = await acquireMicrosoftToken([CopilotStudioClient.scopeFromSettings(copilotSettings)]);
      const client = new CopilotStudioClient(copilotSettings, token);
      let conversationId = '';
      for await (const activity of client.startConversationStreaming({ emitStartConversationEvent: false, locale: 'fr-FR' })) {
        conversationId = activity.conversation?.id || conversationId;
      }
      if (!conversationId) throw new Error('Impossible de démarrer une conversation Copilot.');
      const instruction = mode === 'mep-start'
        ? 'Rédige un email professionnel de DÉBUT DE MEP destiné aux équipes projet et production. Mentionne uniquement les informations fournies : périmètre, date/créneau si disponible, Change, RITM, intervenants, prérequis, déroulé, GO/NO-GO, risques et rollback. N’invente aucune information : utilise « À confirmer » si une donnée manque.'
        : mode === 'mep-end'
          ? 'Rédige un email professionnel de FIN DE MEP. Indique le résultat réel, les contrôles/tests, le retour au nominal, les incidents, réserves et actions restantes. N’annonce jamais un succès si le statut ne le confirme pas. N’invente rien ; marque les éléments absents « À confirmer ».'
          : 'Rédige un compte rendu COPROJ professionnel, fidèle aux notes/transcription fournies. Structure : objet/date si connus, participants si cités, synthèse, sujets abordés, décisions, actions (responsable et échéance uniquement si indiqués), risques/alertes, points à arbitrer et prochaines étapes. Distingue clairement les faits, décisions et points à confirmer. N’invente aucun participant, décision, responsable ou délai.';
      const prompt = `Tu es l'assistant de communication d'un chef de projet production. Réponds en français professionnel, clair, synthétique et prêt à relire. ${instruction}
Retourne exclusivement un JSON valide de la forme {"subject":"...","body":"..."} ; body en texte brut avec des paragraphes et listes utilisant des retours à la ligne.
DONNÉES STRUCTURÉES :
${JSON.stringify(buildContext(), null, 2)}`;
      const activity = { type: 'message', text: prompt, conversation: { id: conversationId } } as any;
      const replies: string[] = [];
      for await (const reply of client.sendActivityStreaming(activity)) {
        if (reply.type === 'message' && reply.text) replies.push(reply.text);
      }
      const raw = replies.join('\n').trim();
      if (!raw) throw new Error('Copilot n’a retourné aucun contenu. Vérifiez les instructions de votre agent.');
      let parsed: DraftContent;
      try {
        const cleaned = raw.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
        const json = JSON.parse(cleaned);
        parsed = { subject: String(json.subject || ''), body: String(json.body || '') };
      } catch {
        const lines = raw.split('\n');
        parsed = { subject: lines[0].replace(/^#+\s*/, '').slice(0, 180), body: raw };
      }
      setDraft(parsed);
      setMessage('Brouillon généré. Relisez et corrigez le contenu avant toute création Outlook.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'La génération Copilot a échoué.');
    } finally { setBusy(false); }
  };

  const createOutlookDraft = async () => {
    if (!draft.subject.trim() || !draft.body.trim()) { setMessage('Le sujet et le contenu du mail sont obligatoires.'); return; }
    setBusy(true); setMessage('Création du brouillon Outlook…');
    try {
      const token = await acquireMicrosoftToken(['https://graph.microsoft.com/Mail.ReadWrite']);
      const toRecipients = recipientText.split(/[;,\n]/).map((email) => email.trim()).filter(Boolean).map((address) => ({ emailAddress: { address } }));
      const html = draft.body.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
      const response = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: draft.subject,
          body: { contentType: 'HTML', content: html },
          toRecipients,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || `Microsoft Graph a refusé la création du brouillon (${response.status}).`);
      setSavedDraftId(result.id || '');
      setMessage('Brouillon créé dans Outlook > Brouillons. Aucun envoi automatique n’a été effectué.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Création du brouillon Outlook impossible.');
    } finally { setBusy(false); }
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    setMessage('Sujet et contenu copiés.');
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-indigo-700"><Sparkles className="w-4 h-4" /><span className="text-[11px] font-black uppercase tracking-wider">Clarity AI · Communication</span></div>
          <h3 className="text-lg font-black text-slate-900 mt-1">Mails MEP & comptes rendus COPROJ</h3>
          <p className="text-xs text-slate-500 mt-1">Génération avec votre agent Copilot Studio, puis création d’un brouillon Outlook après relecture.</p>
        </div>
        <span className={`px-3 py-1 rounded-full border text-[11px] font-bold ${connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>{connected ? 'Copilot connecté' : 'Connexion Microsoft requise'}</span>
      </div>

      <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-xs text-sky-900">
        L’authentification Microsoft est indépendante de votre compte Clarity. Les jetons sont conservés dans le stockage de session MSAL ; aucun secret client n’est enregistré. La création Outlook utilise l’autorisation déléguée <b>Mail.ReadWrite</b> et ne déclenche jamais l’envoi du mail.
      </div>

      <div className="border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Settings2 className="w-4 h-4" /> Configuration Copilot Studio / Microsoft Entra</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([
            ['tenantId', 'Tenant ID'],
            ['appClientId', 'Application (Client) ID'],
            ['environmentId', 'Copilot Studio Environment ID'],
            ['schemaName', 'Agent Schema name'],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-[11px] font-bold text-slate-600 space-y-1">
              {label}
              <input value={settings[key]} onChange={(e) => { setSettings((s) => ({ ...s, [key]: e.target.value })); setMsal(null); setConnected(false); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800" placeholder={key === 'schemaName' ? 'cr299_clarity_tB6p_X' : 'À renseigner'} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={saveSettings} className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2"><Save className="w-3.5 h-3.5" /> Enregistrer la configuration</button>
          <button onClick={connectCopilot} disabled={busy} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5" /> Se connecter à Copilot</button>
        </div>
        <p className="text-[11px] text-slate-500">Dans Entra ID, ajoutez les autorisations déléguées Power Platform API → CopilotStudio.Copilots.Invoke et Microsoft Graph → Mail.ReadWrite. Configurez l’URL de redirection SPA sur l’URL de Clarity et accordez le consentement demandé par votre organisation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-slate-700 space-y-1">Document à générer
          <select value={mode} onChange={(e) => { setMode(e.target.value as CommunicationMode); setDraft({ subject: '', body: '' }); setSavedDraftId(''); }} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white">
            <option value="mep-start">Mail de début de MEP</option>
            <option value="mep-end">Mail de fin de MEP</option>
            <option value="coproj">Compte rendu COPROJ (notes)</option>
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

      {mode === 'coproj' && <label className="block text-xs font-bold text-slate-700 space-y-1">Notes ou transcription de la réunion
        <textarea rows={7} value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} placeholder="Collez ici vos notes, décisions, échanges et actions du COPROJ…" className="w-full border border-slate-300 rounded-xl p-3 text-sm font-normal" />
      </label>}

      {mode !== 'coproj' && selectedMep && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Référence</div><b>{selectedMep.ref || selectedMep.id}</b></div>
        <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Date MEP</div><b>{asText(selectedMep.date)}</b></div>
        <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">Change</div><b>{asText(selectedMep.changeNumbers)}</b></div>
        <div className="bg-slate-50 rounded-lg p-3"><div className="text-slate-500">RITM</div><b>{asText(selectedMep.ritmNumbers)}</b></div>
      </div>}

      <div className="flex flex-wrap gap-2">
        <button onClick={generate} disabled={busy} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Sparkles className="w-4 h-4" />{busy ? 'Traitement…' : 'Générer avec Copilot'}</button>
        {busy && <Loader2 className="w-5 h-5 animate-spin text-indigo-600 self-center" />}
      </div>

      {(draft.subject || draft.body) && <div className="border border-indigo-100 bg-indigo-50/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText className="w-4 h-4" /> Brouillon à relire et modifier</div>
        {mode !== 'coproj' && <label className="block text-xs font-bold text-slate-700 space-y-1">Destinataires (facultatif, séparés par ; ou ,)
          <input value={recipientText} onChange={(e) => setRecipientText(e.target.value)} placeholder="equipe@entreprise.fr; production@entreprise.fr" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>}
        <label className="block text-xs font-bold text-slate-700 space-y-1">Objet / titre
          <input value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-xs font-bold text-slate-700 space-y-1">Contenu
          <textarea rows={mode === 'coproj' ? 16 : 12} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} className="w-full border border-slate-300 rounded-lg p-3 text-sm font-normal leading-relaxed" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={copyDraft} className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Copier</button>
          {mode !== 'coproj' && <button onClick={createOutlookDraft} disabled={busy} className="px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Créer le brouillon Outlook</button>}
        </div>
        {savedDraftId && <p className="text-xs text-emerald-700 font-semibold">Brouillon enregistré dans Outlook. Référence : {savedDraftId}</p>}
      </div>}

      {message && <p role="status" className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3">{message}</p>}
    </section>
  );
};
