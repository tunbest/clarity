import React, { useEffect, useMemo, useState } from 'react';
import { FileText, FolderKanban, Rocket, CalendarDays, ListTodo, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Project, PortfolioScope } from '../types';
import { CommunicationAssistant } from './CommunicationAssistant';

interface CoprojPortalProps { projects: Project[]; scopes: PortfolioScope[]; }
export const CoprojPortal: React.FC<CoprojPortalProps> = ({ projects, scopes }) => {
  const [meps, setMeps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scopeId, setScopeId] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/meps', { credentials: 'same-origin' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Chargement des MEP impossible.');
      return data;
    }).then((data) => { if (active) { setMeps(data.meps || []); setError(''); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Chargement des MEP impossible.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const availableScopes = useMemo(() => scopes.filter((scope) => projects.some((project) => project.scopeId === scope.id)), [scopes, projects]);
  useEffect(() => { if (!availableScopes.some((scope) => scope.id === scopeId)) setScopeId(availableScopes[0]?.id || ''); }, [availableScopes, scopeId]);
  const selectedScope = availableScopes.find((scope) => scope.id === scopeId);
  const scopeProjects = projects.filter((project) => project.scopeId === scopeId);
  const projectIds = new Set(scopeProjects.map((project) => project.id));
  const scopeMeps = meps.filter((mep) => (Array.isArray(mep.scopeIds) && mep.scopeIds.includes(scopeId)) || projectIds.has(String(mep.projectId || '')));
  const tasks = scopeProjects.flatMap((project) => project.tasks || []);
  const milestones = scopeProjects.flatMap((project) => project.milestones || []);
  const risks = scopeProjects.flatMap((project) => project.risks || []);
  const lateTasks = tasks.filter((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'DONE');
  const blockedTasks = tasks.filter((task) => task.status === 'BLOCKED');
  const openRisks = risks.filter((risk) => !['CLOSED', 'RESOLVED'].includes(String(risk.status || '').toUpperCase()));
  if (loading) return <div className="rounded-2xl bg-white border border-slate-200 p-8 text-sm text-slate-500">Chargement des données COPROJ…</div>;
  return <div className="space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><FileText className="w-5 h-5" /></div><div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Gouvernance de production</p><h1 className="text-xl font-black text-slate-900">COPROJ — Comité de pilotage</h1><p className="text-sm text-slate-500">Synthèse et compte rendu par périmètre applicatif</p></div></div>
      {error && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="mt-4 max-w-xl"><label className="mb-1 block text-xs font-bold text-slate-700">Périmètre</label><select value={scopeId} onChange={(event) => setScopeId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm">{availableScopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.code} · {scope.name}</option>)}</select></div>
    </header>
    {selectedScope ? <><section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {[{label:'Projets',value:scopeProjects.length,icon:FolderKanban},{label:'MEP',value:scopeMeps.length,icon:Rocket},{label:'Jalons',value:milestones.length,icon:CalendarDays},{label:'Tâches',value:tasks.length,icon:ListTodo},{label:'En retard / bloquées',value:lateTasks.length+blockedTasks.length,icon:AlertTriangle},{label:'Risques ouverts',value:openRisks.length,icon:ShieldAlert}].map((item) => { const Icon=item.icon; return <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-semibold">{item.label}</span><Icon className="h-4 w-4" /></div><div className="mt-2 text-2xl font-black tabular-nums text-slate-900">{item.value}</div></div>; })}
    </section><section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center gap-2 text-sm font-bold text-amber-900"><AlertTriangle className="h-4 w-4" /> Points à surveiller</div><p className="mt-1 text-xs text-amber-900">{lateTasks.length} tâche(s) en retard · {blockedTasks.length} tâche(s) bloquée(s) · {openRisks.length} risque(s) ouvert(s). Les éléments détaillés sont repris dans le compte rendu.</p></section>
    <CommunicationAssistant projects={projects} meps={meps} scopes={scopes} allowedModes={['coproj']} initialMode="coproj" />
    </> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Aucun périmètre avec projet disponible. Ajoutez ou rattachez d’abord les projets à un périmètre.</div>}
  </div>;
};