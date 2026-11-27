import React, { useState } from 'react';
import { Bot, Send, Loader2, Sparkles, CheckCircle2, ShieldCheck, RotateCcw } from 'lucide-react';
import { Project, Task, Milestone, Risk } from '../types';

type Message = { role: 'user' | 'assistant'; content: string };
type AgentChange = { type: string; description: string; data: any };

interface Props { project: Project; onApplyProject: (project: Project) => void; }

const makeId = () => `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function buildProjectProposal(project: Project, changes: AgentChange[]): Project {
  let next: Project = { ...project, tasks: [...project.tasks], milestones: [...project.milestones], risks: [...project.risks] };
  for (const change of changes) {
    const data = change.data || {};
    if (change.type === 'update_project') {
      const allowed = ['name','description','status','priority','startDate','endDate'];
      const patch = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
      next = { ...next, ...patch };
    } else if (change.type === 'create_task') {
      if (!String(data.title || '').trim()) continue;
      const task: Task = { id: makeId(), projectId: project.id, title: String(data.title).slice(0,200), description: String(data.description || ''), status: data.status || 'TODO', priority: data.priority || 'MEDIUM', startDate: data.startDate || new Date().toISOString().slice(0,10), dueDate: data.dueDate || new Date(Date.now()+14*86400000).toISOString().slice(0,10), estimatedHours: Math.max(0, Number(data.estimatedHours) || 8), actualHours: 0, completionPercent: 0, category: String(data.category || 'Général'), tags: ['IA-Clarity'] };
      next.tasks = [...next.tasks, task];
    } else if (change.type === 'update_task') {
      const allowed = ['title','description','status','priority','startDate','dueDate','estimatedHours','category'];
      const patch = Object.fromEntries(Object.entries(data.updates || {}).filter(([key]) => allowed.includes(key)));
      next.tasks = next.tasks.map(task => task.id === data.targetId ? { ...task, ...patch } : task);
    } else if (change.type === 'create_milestone') {
      if (!String(data.title || '').trim() || !data.targetDate) continue;
      const milestone: Milestone = { id: makeId(), projectId: project.id, title: String(data.title).slice(0,200), targetDate: String(data.targetDate), completed: false, description: String(data.description || '') };
      next.milestones = [...next.milestones, milestone];
    } else if (change.type === 'update_milestone') {
      const allowed = ['title','targetDate','description','completed'];
      const patch = Object.fromEntries(Object.entries(data.updates || {}).filter(([key]) => allowed.includes(key)));
      next.milestones = next.milestones.map(item => item.id === data.targetId ? { ...item, ...patch } : item);
    } else if (change.type === 'create_risk') {
      if (!String(data.title || '').trim()) continue;
      const risk: Risk = { id: makeId(), projectId: project.id, title: String(data.title).slice(0,200), description: String(data.description || ''), category: data.category || 'TECHNIQUE', probability: Math.min(5,Math.max(1,Number(data.probability)||3)), impact: Math.min(5,Math.max(1,Number(data.impact)||3)), mitigationPlan: String(data.mitigationPlan || 'À définir'), status: 'ACTIVE' };
      next.risks = [...next.risks, risk];
    } else if (change.type === 'update_risk') {
      const allowed = ['title','description','category','probability','impact','mitigationPlan','status'];
      const patch = Object.fromEntries(Object.entries(data.updates || {}).filter(([key]) => allowed.includes(key)));
      next.risks = next.risks.map(item => item.id === data.targetId ? { ...item, ...patch } : item);
    }
  }
  return { ...next, updatedAt: new Date().toISOString() };
}

export const CloudflareAIChat: React.FC<Props> = ({ project, onApplyProject }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<{ message: string; changes: AgentChange[]; project: Project } | null>(null);
  const [applied, setApplied] = useState(false);

  const send = async () => {
    const content = prompt.trim();
    if (!content || loading) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next); setPrompt(''); setError(''); setProposal(null); setApplied(false); setLoading(true);
    try {
      const response = await fetch('/api/ai/agent/plan', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ projectId:project.id, messages:next.slice(-10) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Clarity AI indisponible.');
      const assistantText = String(data.message || 'Voici ma proposition.');
      setMessages([...next, { role:'assistant', content:assistantText }]);
      if (Array.isArray(data.changes) && data.changes.length) setProposal({ message:assistantText, changes:data.changes, project:buildProjectProposal(project,data.changes) });
    } catch (err) { setMessages(messages); setPrompt(content); setError(err instanceof Error ? err.message : 'Erreur de communication avec Clarity AI.'); }
    finally { setLoading(false); }
  };

  const apply = () => { if (!proposal || applied) return; onApplyProject(proposal.project); setApplied(true); setProposal(null); setMessages(current => [...current, { role:'assistant', content:'Modifications transmises à Clarity pour enregistrement. Je te conseille de vérifier le projet et son planning.' }]); };
  const discard = () => setProposal(null);

  return <section className='flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm'>
    <div className='flex items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50 px-4 py-3'>
      <div className='flex items-center gap-2'><span className='rounded-lg bg-indigo-600 p-2 text-white'><Bot className='h-4 w-4' /></span><div><h3 className='text-sm font-bold text-slate-900'>Clarity AI — Agent de projet</h3><p className='text-[11px] text-slate-600'>Projet : {project.name} · {project.code}</p></div></div>
      <span className='flex items-center gap-1 text-[10px] font-semibold text-emerald-700'><ShieldCheck className='h-3 w-3'/> Validation obligatoire</span>
    </div>
    <div className='min-h-0 flex-1 space-y-3 overflow-y-auto p-4'>
      {messages.length === 0 && <div className='rounded-xl bg-slate-50 p-4 text-sm text-slate-600'><p className='font-semibold text-slate-800'>Bonjour, je suis ton agent Clarity.</p><p className='mt-1'>Je peux analyser ce projet et préparer des changements sur ses informations, tâches, jalons et risques. Rien ne sera modifié avant ta validation.</p><p className='mt-2 text-xs text-slate-500'>Exemple : « Ajoute les tâches de préparation, tests de préproduction et validation CAB avant la MEP du 15 décembre. »</p></div>}
      {messages.map((message,index)=><div key={index} className={`flex ${message.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${message.role==='user'?'bg-indigo-600 text-white':'bg-slate-100 text-slate-800'}`}>{message.content}</div></div>)}
      {loading && <div className='flex items-center gap-2 text-xs text-slate-500'><Loader2 className='h-4 w-4 animate-spin'/> Analyse du projet et préparation de la proposition…</div>}
      {proposal && <div className='rounded-xl border border-amber-300 bg-amber-50 p-4'><div className='flex items-center gap-2 text-sm font-bold text-amber-900'><ShieldCheck className='h-4 w-4'/> Proposition à valider</div><p className='mt-1 text-xs text-amber-800'>{proposal.changes.length} modification(s) préparée(s). Aucune n’est encore enregistrée.</p><ul className='mt-3 space-y-2'>{proposal.changes.map((change,index)=><li key={index} className='rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700'><span className='font-semibold'>{index+1}. </span>{change.description}</li>)}</ul><div className='mt-4 flex flex-wrap gap-2'><button type='button' onClick={apply} className='inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700'><CheckCircle2 className='h-4 w-4'/> Valider et appliquer</button><button type='button' onClick={discard} className='inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50'><RotateCcw className='h-4 w-4'/> Refuser</button></div></div>}
      {applied && <div className='flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800'><CheckCircle2 className='h-4 w-4'/> Modifications validées et envoyées à Clarity.</div>}
      {error && <p role='alert' className='text-xs text-rose-600'>{error}</p>}
    </div>
    <div className='border-t border-slate-100 p-3'><div className='flex gap-2'><textarea value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void send();}}} rows={2} maxLength={5000} placeholder='Décris ce que tu veux que je fasse dans ce projet…' className='min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'/><button type='button' onClick={()=>void send()} disabled={loading||!prompt.trim()} aria-label='Envoyer' className='self-end rounded-xl bg-indigo-600 p-3 text-white hover:bg-indigo-700 disabled:opacity-40'><Send className='h-4 w-4'/></button></div><p className='mt-2 text-[10px] text-slate-400'>Les propositions sont préparées à partir des données autorisées du projet. Les modifications ne sont enregistrées qu’après validation.</p></div>
  </section>;
};
