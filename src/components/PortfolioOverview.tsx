import React, { useState } from 'react';
import { Project, PortfolioScope } from '../types';
import { AIImportAssistant } from './AIImportAssistant';
import { calculateProjectMetrics, formatCurrency, formatDateFR } from '../utils/pmCalculations';
import { 
  Layers, 
  Plus, 
  ArrowRight, 
  Activity, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Clock 
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface PortfolioOverviewProps {
  projects: Project[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  scopes?: PortfolioScope[];
  canManageScopes?: boolean;
  canManageProjectCatalog?: boolean;
  onImportCatalog?: (payload: any) => Promise<void>;
  onEditProject?: (project: Project) => void;
  onSaveScopes?: (scopes: PortfolioScope[]) => Promise<void>;
  onUpdateProject?: (project: Project) => void;
}

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({
  projects,
  onSelectProject,
  onOpenNewProject,
  scopes = [],
  canManageScopes = false,
  canManageProjectCatalog = false,
  onImportCatalog,
  onEditProject,
  onSaveScopes,
  onUpdateProject,
}) => {
  const [scopeCode, setScopeCode] = useState('');
  const [scopeName, setScopeName] = useState('');
  const [scopeTrigrams, setScopeTrigrams] = useState('');
  const [scopeError, setScopeError] = useState('');
  const [scopeBusy, setScopeBusy] = useState(false);
  const [trigramDrafts, setTrigramDrafts] = useState<Record<string, string>>({});
  const [catalogError, setCatalogError] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const saveScopeList = async (next: PortfolioScope[]) => { if (!onSaveScopes) return; setScopeBusy(true); setScopeError(''); try { await onSaveScopes(next); } catch (e) { setScopeError(e instanceof Error ? e.message : 'Enregistrement impossible'); } finally { setScopeBusy(false); } };
  const addTrigram = async (scope: PortfolioScope) => { const value=(trigramDrafts[scope.id] || '').trim().toUpperCase(); if(!value || value.length>20){setScopeError('Saisissez un trigramme de 1 à 20 caractères.');return;} if(scope.trigrams.includes(value)){setScopeError('Ce trigramme existe déjà dans ce périmètre.');return;} await saveScopeList(scopes.map(s=>s.id===scope.id?{...s,trigrams:[...s.trigrams,value],updatedAt:new Date().toISOString()}:s)); setTrigramDrafts(current=>({...current,[scope.id]:''})); };
  const removeTrigram = async (scope: PortfolioScope, trigram: string) => { if(projects.some(p=>p.scopeId===scope.id && (p.trigrams || []).includes(trigram))){setScopeError(`Impossible de supprimer ${trigram} : il est encore utilisé par un projet.`);return;} if(!window.confirm(`Supprimer le trigramme ${trigram} du périmètre ${scope.code} ?`))return; await saveScopeList(scopes.map(s=>s.id===scope.id?{...s,trigrams:s.trigrams.filter(t=>t!==trigram),updatedAt:new Date().toISOString()}:s)); };
  const downloadCatalogTemplate = () => { const template={format:'clarity-catalog',version:1,instructions:'Les périmètres sont créés par le Directeur de Projets. Le Chef de Projet peut ajouter/supprimer des trigrammes dans les périmètres existants et créer des projets. Conservez les scopes fournis et ajoutez vos projets dans projects[]. Les trigrammes d’un projet doivent être présents dans le périmètre indiqué par scopeCode.',scopes:scopes.map(scope=>({code:scope.code,name:scope.name,description:scope.description || '',trigrams:[...scope.trigrams]})),projects:[],exampleProject:{code:'PRJ-001',name:'Modernisation réseau',description:'Exemple à copier dans projects[]',scopeCode:scopes[0]?.code || 'CODE_PERIMETRE_EXISTANT',trigrams:scopes[0]?.trigrams?.slice(0,1) || ['TRIGRAMME_EXISTANT']}}; const blob=new Blob([JSON.stringify(template,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download='clarity-catalog-template.json'; link.click(); URL.revokeObjectURL(url); };
  const importCatalogFile = async (event: React.ChangeEvent<HTMLInputElement>) => { const file=event.target.files?.[0]; if(!file)return; setCatalogBusy(true);setCatalogError('');try{const payload=JSON.parse(await file.text());await onImportCatalog?.(payload);}catch(error){setCatalogError(error instanceof Error?error.message:'Import JSON impossible.');}finally{setCatalogBusy(false);event.target.value='';} };
  const addScope = async () => { const code=scopeCode.trim().toUpperCase(); const name=scopeName.trim(); if(!code || !name) { setScopeError('Code et nom du périmètre obligatoires.'); return; } if(scopes.some(s=>s.code.toUpperCase()===code)) { setScopeError('Ce code de périmètre existe déjà.'); return; } const trigrams=Array.from(new Set(scopeTrigrams.split(/[\\n,; ]+/).map(x=>x.trim().toUpperCase()).filter(Boolean))); const now=new Date().toISOString(); await saveScopeList([...scopes,{id:'SCOPE-'+Math.random().toString(36).slice(2,9).toUpperCase(),code,name,trigrams,createdAt:now,updatedAt:now}]); setScopeCode(''); setScopeName(''); setScopeTrigrams(''); };

  // Compute portfolio aggregated KPIs
  const projectStats = projects.map((p) => {
    const metrics = calculateProjectMetrics(p);
    return {
      project: p,
      metrics,
    };
  });

  const totalPortfolioBudget = projectStats.reduce((sum, ps) => sum + (ps.metrics?.BAC || 0), 0);
  const totalPortfolioActualCost = projectStats.reduce((sum, ps) => sum + (ps.metrics?.AC || 0), 0);
  const averageProgress = Math.round(
    projectStats.reduce((sum, ps) => sum + (ps.metrics?.progressPercent || 0), 0) / (projects.length || 1)
  );
  const totalActiveRisks = projectStats.reduce((sum, ps) => sum + (ps.metrics?.criticalRisksCount || 0), 0);

  // Chart data
  const chartData = projectStats.map((ps) => ({
    name: ps.project.code,
    Budget: ps.metrics?.BAC || 0,
    Dépensé: ps.metrics?.AC || 0,
    Avancement: ps.metrics?.progressPercent || 0,
  }));

  return (
    <div className="space-y-6">
      
      {/* Top Portfolio Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-indigo-100 text-indigo-700">
              <Layers className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Direction des Projets & PMO
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Vue Portefeuille Multi-Projets
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Suivi consolidé de {projects.length} projets stratégiques en cours d'exécution
          </p>
        </div>

        <button
          onClick={onOpenNewProject}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un Nouveau Projet</span>
        </button>
      </div>

      {canManageScopes && <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div><h2 className="text-sm font-extrabold text-slate-900">Administration des périmètres</h2><p className="text-xs text-slate-500 mt-1">Le Directeur de projets et l’administrateur créent, renomment et suppriment les périmètres.</p></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input value={scopeCode} onChange={e=>setScopeCode(e.target.value)} placeholder="Code (ex. INFRA)" className="p-2.5 rounded-lg border border-slate-300 text-xs" />
          <input value={scopeName} onChange={e=>setScopeName(e.target.value)} placeholder="Nom du périmètre" className="p-2.5 rounded-lg border border-slate-300 text-xs" />
          <input value={scopeTrigrams} onChange={e=>setScopeTrigrams(e.target.value)} placeholder="Trigrammes : NET, VOI, SEC" className="p-2.5 rounded-lg border border-slate-300 text-xs" />
          <button disabled={scopeBusy} onClick={addScope} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">Ajouter le périmètre</button>
        </div>
        {scopeError && <p className="text-xs text-rose-600">{scopeError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{scopes.map(scope=><div key={scope.id} className="border border-slate-200 rounded-xl p-3"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-slate-900">{scope.code} — {scope.name}</div><div className="text-[10px] text-slate-500 mt-1">{projects.filter(p=>p.scopeId===scope.id).length} projet(s)</div></div><button onClick={()=>{if(window.confirm('Supprimer ce périmètre ? Les projets associés doivent être réaffectés avant suppression.')){if(projects.some(p=>p.scopeId===scope.id)){setScopeError('Réaffectez les projets de ce périmètre avant de le supprimer.');return;}void saveScopeList(scopes.filter(s=>s.id!==scope.id));}}} className="text-xs text-rose-600 font-bold">Supprimer le périmètre</button></div>
          <div className="flex flex-wrap gap-1 mt-3">{scope.trigrams.map(t=><span key={t} className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">{t}</span>)}</div>
        </div>)}</div>
      </section>}

      {canManageProjectCatalog && <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h2 className="text-sm font-extrabold text-slate-900">Catalogue projets & trigrammes</h2><p className="text-xs text-slate-500 mt-1">Le Chef de Projet peut créer/supprimer ses projets et gérer les trigrammes dans les périmètres existants.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={downloadCatalogTemplate} className="px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-bold">Télécharger le modèle JSON</button><label className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">{catalogBusy?'Import…':'Importer un JSON'}<input type="file" accept=".json,application/json" onChange={importCatalogFile} className="hidden" disabled={catalogBusy}/></label></div>
        </div>
        {catalogError && <p className="text-xs text-rose-600">{catalogError}</p>}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-700 mb-2">Vue graphique de la hiérarchie</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{scopes.map(scope=><div key={scope.id} className="rounded-xl border border-indigo-100 bg-white p-3 space-y-3"><div className="flex items-center justify-between"><div className="text-xs font-extrabold text-slate-900">{scope.code} — {scope.name}</div><span className="text-[10px] text-slate-500">{projects.filter(p=>p.scopeId===scope.id).length} projet(s)</span></div>
            <div className="rounded-lg bg-indigo-50/70 p-2"><div className="text-[10px] font-bold text-indigo-800 mb-2">TRIGRAMMES DU PÉRIMÈTRE</div><div className="flex flex-wrap gap-1">{scope.trigrams.map(t=><span key={t} className="inline-flex items-center gap-1 rounded-full bg-white border border-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-800">{t}<button type="button" title={`Supprimer ${t}`} onClick={()=>void removeTrigram(scope,t)} className="text-rose-500 font-black" aria-label={`Supprimer le trigramme ${t}`}>×</button></span>)}</div>
              <div className="flex gap-2 mt-2"><input value={trigramDrafts[scope.id] || ''} onChange={e=>setTrigramDrafts(current=>({...current,[scope.id]:e.target.value}))} placeholder="Nouveau trigramme" className="min-w-0 flex-1 p-2 rounded-lg border border-slate-200 text-xs"/><button disabled={scopeBusy} onClick={()=>void addTrigram(scope)} className="px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50">Ajouter</button></div></div>
            <div><div className="text-[10px] font-bold text-slate-600 mb-2">PROJETS RATTACHÉS</div><div className="space-y-2">{projects.filter(p=>p.scopeId===scope.id).map(project=><div key={project.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2"><div className="min-w-0"><div className="text-xs font-bold text-slate-800 truncate">{project.code} — {project.name}</div><div className="text-[10px] text-slate-500">{(project.trigrams||[]).join(' · ') || 'Aucun trigramme affecté'}</div></div><button onClick={()=>onEditProject?.(project)} className="shrink-0 text-[10px] font-bold text-indigo-700">Modifier / supprimer</button></div>)}{!projects.some(p=>p.scopeId===scope.id)&&<p className="text-[10px] text-slate-400">Aucun projet dans ce périmètre.</p>}</div></div>
          </div>)}</div>
        </div>
      </section>}

      {canManageScopes && <AIImportAssistant />}

      {/* Aggregate Portfolio KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Budget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Budget Portefeuille</span>
            <DollarSign className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">
              {formatCurrency(totalPortfolioBudget, '€')}
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              Engagé : <strong>{formatCurrency(totalPortfolioActualCost, '€')}</strong>
            </span>
          </div>
        </div>

        {/* Average Progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Avancement Moyen</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{averageProgress}%</span>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${averageProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Global Risks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Risques Critiques</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-black ${totalActiveRisks > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {totalActiveRisks}
            </span>
            <span className="text-xs text-slate-500 block mt-1">
              sur l'ensemble des chantiers
            </span>
          </div>
        </div>

        {/* Total Projects Active */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Chantiers Actifs</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{projects.length}</span>
            <span className="text-xs text-slate-500 block mt-1">
              Tous sous contrôle PM
            </span>
          </div>
        </div>

      </div>

      {/* Cross-Project Comparison Chart */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
          Comparatif Budgétaire des Projets (Budget Alloué vs Consommé)
        </h3>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `${v / 1000}k€`} tickLine={false} />
              <Tooltip 
                formatter={(val: any) => formatCurrency(Number(val), '€')}
                contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#F8FAFC', fontSize: '11px' }}
              />
              <Bar dataKey="Budget" fill="#6366F1" radius={[4, 4, 0, 0]} name="Budget Alloué (BAC)" />
              <Bar dataKey="Dépensé" fill="#10B981" radius={[4, 4, 0, 0]} name="Dépensé Réel (AC)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Projects List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Tableau Récapitulatif des Projets
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3">Projet & Code</th>
                <th className="p-3">Périmètre / trigrammes</th>
                <th className="p-3">Chef de Projet</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Score Santé</th>
                <th className="p-3">Indices SPI / CPI</th>
                <th className="p-3">Avancement</th>
                <th className="p-3 text-right">Budget Consommé / Alloué</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {projectStats.map(({ project, metrics }) => {
                return (
                  <tr key={project.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 text-xs">
                        {project.name}
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                        {project.code}
                      </span>
                    </td>

                    <td className="p-3">
                      {canManageProjectCatalog ? <div className="space-y-1"><select value={project.scopeId || ''} onChange={e=>{const scope=scopes.find(s=>s.id===e.target.value);onUpdateProject?.({...project,scopeId:e.target.value || undefined,trigrams:(project.trigrams || []).filter(t=>scope?.trigrams.includes(t))});}} className="w-full p-1.5 rounded border border-slate-200 text-[10px]"><option value="">Sans périmètre</option>{scopes.map(s=><option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select><div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1 max-h-28 overflow-y-auto" aria-label="Trigrammes du projet">{(scopes.find(s=>s.id===project.scopeId)?.trigrams || []).map(t=><label key={t} className="flex items-center gap-2 text-[10px] cursor-pointer"><input type="checkbox" checked={(project.trigrams || []).includes(t)} onChange={e=>onUpdateProject?.({...project,trigrams:e.target.checked?Array.from(new Set([...(project.trigrams || []),t])):(project.trigrams || []).filter(x=>x!==t)})} className="accent-indigo-600"/><span>{t}</span></label>)}{!(scopes.find(s=>s.id===project.scopeId)?.trigrams || []).length && <span className="text-[10px] text-slate-400">Aucun trigramme dans ce périmètre</span>}</div></div> : <span className="text-[10px]">{scopes.find(s=>s.id===project.scopeId)?.name || '—'}<br/>{(project.trigrams || []).join(', ')}</span>}
                    </td>
                    <td className="p-3 text-slate-700 font-medium">
                      {project.managerName}
                    </td>

                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        project.status === 'IN_PROGRESS' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : project.status === 'AT_RISK'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {project.status === 'IN_PROGRESS' ? 'En cours' : project.status === 'AT_RISK' ? 'Risque Élevé' : 'Planification'}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-sm font-black text-slate-900">{metrics.healthScore}</strong>
                        <span className="text-[10px] text-slate-400">/100</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${metrics.SPI >= 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          SPI: {metrics.SPI}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${metrics.CPI >= 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          CPI: {metrics.CPI}
                        </span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${metrics.progressPercent}%` }} />
                        </div>
                        <span className="font-bold text-slate-700">{metrics.progressPercent}%</span>
                      </div>
                    </td>

                    <td className="p-3 text-right">
                      <strong className="text-slate-900">{formatCurrency(metrics.AC, project.currency)}</strong>
                      <span className="text-slate-400 block text-[10px]">
                        sur {formatCurrency(metrics.BAC, project.currency)}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ouvrir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
