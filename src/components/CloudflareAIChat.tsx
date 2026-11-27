import React, { useState } from 'react';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

export const CloudflareAIChat: React.FC<{ projectName?: string; projectCode?: string }> = ({ projectName, projectCode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const content = prompt.trim();
    if (!content || loading) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setPrompt('');
    setError('');
    setLoading(true);
    try {
      const context = projectName ? `Contexte projet actif : ${projectName} (${projectCode || 'sans code'}). Ne déduis aucune donnée non fournie.\n\n` : '';
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...next.slice(-8, -1), { role: 'user', content: context + content }] }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.response !== 'string') throw new Error(data.error || 'Réponse IA indisponible.');
      setMessages([...next, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages(messages);
      setPrompt(content);
      setError(err instanceof Error ? err.message : 'Erreur de communication avec Clarity AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-600 p-2 text-white"><Bot className="w-4 h-4" /></span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Clarity AI</h3>
            <p className="text-[11px] text-slate-600">Cloudflare Workers AI · Assistant de pilotage</p>
          </div>
        </div>
        <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Connecté via Clarity</span>
      </div>
      <div className="max-h-64 min-h-28 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="text-xs text-slate-500">Pose une question sur le pilotage, les risques, les jalons, les MEP ou la préparation d’un rapport. Seules les informations que tu fournis dans la conversation sont transmises au modèle.</p>}
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'}`}>{message.content}</div>
          </div>
        ))}
        {loading && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Clarity AI réfléchit…</div>}
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex gap-2">
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} maxLength={8000} placeholder="Ex. Prépare une synthèse des risques et des prochaines actions…" className="min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          <button type="button" onClick={() => void send()} disabled={loading || !prompt.trim()} aria-label="Envoyer le message" className="self-end rounded-xl bg-indigo-600 p-3 text-white transition hover:bg-indigo-700 disabled:opacity-40"><Send className="w-4 h-4" /></button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
        <p className="mt-2 text-[10px] text-slate-400">Ne transmets pas de données personnelles ou confidentielles non autorisées. L’IA propose ; elle n’exécute aucune modification.</p>
      </div>
    </section>
  );
};
