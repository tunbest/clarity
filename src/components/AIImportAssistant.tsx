import React, { useState } from 'react';
import { FileUp, Sparkles, Download, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type ExtractedDraft = {
  format: 'clarity-ai-import';
  version: number;
  scopes: any[];
  projects: any[];
  meps: any[];
  coprojMeetings: any[];
  reviewItems?: any[];
  sourceSummary?: string;
};

export const AIImportAssistant: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);
  const [sourceName, setSourceName] = useState('');

  const analyze = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(''); setDraft(null); setSourceName(file.name);
    try {
      if (file.size > 12 * 1024 * 1024) throw new Error('Fichier trop volumineux : 12 Mo maximum.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const fileBase64 = btoa(binary);
      const response = await fetch('/api/ai/extract-portfolio', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, fileBase64 })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Analyse IA impossible.');
      setDraft(result.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant l’analyse du document.');
    } finally { setBusy(false); }
  };

  const download = () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'clarity-import-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(url);
  };

  return <section className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-3">
    <div className="flex items-center gap-2"><span className="p-2 rounded-lg bg-indigo-50 text-indigo-700"><Sparkles className="w-4 h-4" /></span><div><h2 className="text-sm font-extrabold text-slate-900">Assistant IA – Documents vers JSON Clarity</h2><p className="text-xs text-slate-500">Excel, PowerPoint, Word, PDF, CSV ou TXT. Analyse sans modifier les données du portefeuille.</p></div></div>
    <label className="flex items-center justify-center gap-2 p-4 border border-dashed border-indigo-300 rounded-xl bg-indigo-50/40 text-indigo-800 text-xs font-bold cursor-pointer hover:bg-indigo-50">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
      {busy ? 'Analyse IA en cours…' : 'Déposer ou choisir un document'}
      <input type="file" accept=".xlsx,.xls,.pptx,.docx,.pdf,.csv,.txt" className="hidden" disabled={busy} onChange={e => { void analyze(e.target.files?.[0]); e.target.value=''; }} />
    </label>
    {error && <div className="text-xs text-rose-700 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
    {draft && <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold"><CheckCircle2 className="w-4 h-4" />Extraction terminée – vérification obligatoire</div>
      <p className="text-[11px] text-slate-600">Source : {sourceName}. {draft.sourceSummary || 'Les informations extraites sont prêtes à être relues.'}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{[['Périmètres',draft.scopes.length],['Projets',draft.projects.length],['MEP',draft.meps.length],['COPROJ',draft.coprojMeetings.length]].map(([label,value])=><div key={String(label)} className="bg-white border border-slate-200 rounded-lg p-2"><div className="text-lg font-black text-slate-900">{value}</div><div className="text-[10px] text-slate-500">{label}</div></div>)}</div>
      {!!draft.reviewItems?.length && <div className="text-xs text-amber-800"><strong>{draft.reviewItems.length} point(s) à vérifier :</strong><ul className="list-disc pl-5 mt-1">{draft.reviewItems.slice(0,8).map((item:any,i)=><li key={i}>{item.field}: {item.value} – {item.reason}</li>)}</ul></div>}
      <button onClick={download} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-2"><Download className="w-4 h-4" />Télécharger le JSON extrait</button>
      <pre className="max-h-56 overflow-auto bg-slate-950 text-emerald-200 rounded-lg p-3 text-[10px]">{JSON.stringify(draft, null, 2)}</pre>
      <p className="text-[10px] text-slate-500">Le JSON est un brouillon d’extraction. Vérifie les rattachements périmètre/projet/trigramme et les numéros ITSM avant de l’intégrer.</p>
    </div>}
  </section>;
};
