import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, CheckCircle2, AlertTriangle, Trash2, RefreshCw, Eye, EyeOff, Zap } from 'lucide-react';

type Status = { configured: boolean; provider: string; updatedAt?: string | null };

async function readApiResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const raw = await response.text();
  if (!contentType.toLowerCase().includes('application/json')) {
    const isHtml = /^\s*<!doctype html|^\s*<html/i.test(raw);
    throw new Error(isHtml
      ? `L'API Clarity n'a pas répondu en JSON (HTTP ${response.status}). La route Gemini n'est probablement pas déployée ou la requête est redirigée vers l'interface web.`
      : `Réponse API inattendue (HTTP ${response.status}, ${contentType || 'type inconnu'}).`);
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { throw new Error(`Réponse JSON invalide (HTTP ${response.status}).`); }
}

export const GeminiKeyManager: React.FC = () => {
  const [status, setStatus] = useState<Status>({ configured: false, provider: 'Google Gemini Flash' });
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/gemini/status', { credentials: 'same-origin', cache: 'no-store' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Lecture de la configuration impossible.');
      setStatus(data);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Service indisponible.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (apiKey.trim().length < 20) { setMessage({ ok: false, text: 'La clé API semble trop courte.' }); return; }
    setSaving(true); setMessage(null);
    try {
      const response = await fetch('/api/admin/gemini/key', {
        method: 'PUT', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible.');
      setApiKey(''); setShowKey(false);
      setMessage({ ok: true, text: 'Clé Gemini enregistrée et chiffrée côté serveur.' });
      await refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Enregistrement impossible.' });
    } finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setMessage(null);
    try {
      const response = await fetch('/api/admin/gemini/test', { method: 'POST', credentials: 'same-origin' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Test Gemini échoué.');
      setMessage({ ok: true, text: `Connexion Gemini opérationnelle · ${data.model} · ${data.latencyMs} ms` });
      await refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Test Gemini échoué.' });
    } finally { setTesting(false); }
  };

  const remove = async () => {
    if (!window.confirm('Supprimer la clé API Gemini de Clarity ?')) return;
    setDeleting(true); setMessage(null);
    try {
      const response = await fetch('/api/admin/gemini/key', { method: 'DELETE', credentials: 'same-origin' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error || 'Suppression impossible.');
      setStatus({ configured: false, provider: 'Google Gemini Flash' });
      setMessage({ ok: true, text: 'Clé Gemini supprimée.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Suppression impossible.' });
    } finally { setDeleting(false); }
  };

  return (
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/60 p-5 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><KeyRound className="h-5 w-5" /></div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Clé API Google Gemini Flash</h3>
            <p className="text-xs text-slate-500">Gestion sécurisée depuis l'administration Clarity.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${status.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
          <span className={`h-2 w-2 rounded-full ${status.configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {loading ? 'Vérification…' : status.configured ? 'Clé configurée' : 'Clé non configurée'}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 flex gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        <p>La clé est chiffrée avec AES-256-GCM avant stockage PostgreSQL. Elle n'est jamais relue ni affichée dans le navigateur. Seul le rôle Administrateur peut la gérer.</p>
      </div>

      <form onSubmit={save} className="space-y-3">
        <label className="block text-xs font-bold text-slate-700" htmlFor="clarity-gemini-key">Nouvelle clé API</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input id="clarity-gemini-key" type={showKey ? 'text' : 'password'} autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={status.configured ? 'Saisir pour remplacer la clé actuelle' : 'Coller la clé Google AI Studio'} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-11 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <button type="button" onClick={() => setShowKey(v => !v)} aria-label={showKey ? 'Masquer la clé' : 'Afficher la clé saisie'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <button type="submit" disabled={saving || !apiKey.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Enregistrer
          </button>
        </div>
        <p className="text-[11px] text-slate-500">Génère ta clé sur Google AI Studio. Ne la partage jamais dans un message ou un ticket.</p>
      </form>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={test} disabled={!status.configured || testing} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
          {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Tester la connexion
        </button>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
        <button type="button" onClick={remove} disabled={!status.configured || deleting} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
          {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Supprimer la clé
        </button>
      </div>

      {message && <div role="status" className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-semibold ${message.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
        {message.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}{message.text}
      </div>}
      {status.updatedAt && <p className="text-[10px] text-slate-400">Dernière modification : {new Date(status.updatedAt).toLocaleString('fr-FR')}</p>}
    </section>
  );
};
