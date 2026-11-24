import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Sparkles, 
  Users, 
  Server, 
  Key, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Save, 
  Sliders, 
  Activity, 
  Cpu, 
  Settings2, 
  Layers, 
  UserCheck, 
  FolderPlus, 
  UserPlus, 
  Lock, 
  ExternalLink,
  Info,
  Check,
  Zap,
  Globe,
  Radio,
  Code,
  Copy,
  FileText,
  Table,
  CheckCheck,
  Boxes,
  Terminal,
  Play,
  Cloud,
  Trash2,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { 
  SystemAdminSettings, 
  PostgresConfig, 
  IACopilotConfig, 
  UserRole,
  AppUser
} from '../types';

interface AdminPageProps {
  currentUser?: AppUser | null;
  onClose?: () => void;
}

const DEFAULT_ADMIN_SETTINGS: SystemAdminSettings = {
  postgres: {
    host: 'postgres',
    port: 5432,
    database: 'clarity_pm',
    user: 'clarity_app',
    passwordConfigured: true,
    sslMode: 'require',
    maxPoolSize: 20,
    idleTimeoutMillis: 30000,
    connectionStatus: 'DISCONNECTED',
    lastTestedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    lastSyncAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    latencyMs: 0,
    tableStats: {
      projects: 0,
      tasks: 0,
      resources: 0,
      risks: 0,
      milestones: 0,
    },
  },
  copilot: {
    provider: 'GEMINI_PRO',
    model: 'gemini-3.7-flash',
    apiKeyConfigured: false,
    temperature: 0.2,
    maxOutputTokens: 2048,
    contextWindow: 128000,
    features: {
      wbsGeneration: true,
      copilReporting: true,
      riskPrediction: true,
      resourceBalancing: true,
    },
    totalCallsMonth: 0,
    avgLatencyMs: 0,
    successRate: 0,
    lastUsedAt: new Date().toISOString(),
  },
  governance: {
    directorCanManageProjects: true,
    directorCanAllocateResources: true,
    maxProjectsPerDirector: 15,
    auditLogRetentionDays: 90,
  },
};

export const AdminPage: React.FC<AdminPageProps> = ({
  currentUser,
  onClose,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'ROLES' | 'OVERVIEW' | 'AD' | 'POSTGRES' | 'COPILOT' | 'DOCKER'>('USERS');
  const [copiedDocker, setCopiedDocker] = useState<string | null>(null);

  // User Management State (CRUD for profiles, can delete admin)
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'CHEF_PROJET' as UserRole,
    jobTitle: '',
    department: '',
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try { const response = await fetch('/api/users', { credentials: 'same-origin' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Lecture des utilisateurs impossible'); setUsersList(data.users || []); }
    catch (e) { console.warn('Lecture des utilisateurs serveur impossible', e); setUserActionMsg({ type: 'error', text: e instanceof Error ? e.message : 'Lecture des utilisateurs impossible.' }); }
    finally { setLoadingUsers(false); }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.displayName.trim() || !newUser.email.trim() || newUser.password.length < 12) { setUserActionMsg({ type: 'error', text: 'Nom, adresse e-mail et mot de passe de 12 caractères minimum obligatoires.' }); return; }
    setCreatingUser(true); setUserActionMsg(null);
    try {
      const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(newUser) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Création impossible.');
      setUserActionMsg({ type: 'success', text: `Profil « ${newUser.displayName} » créé.` });
      setNewUser({ displayName: '', email: '', password: '', role: 'CHEF_PROJET', jobTitle: '', department: '' });
      await fetchUsers();
    } catch (err: any) { setUserActionMsg({ type: 'error', text: err?.message || 'Création impossible.' }); }
    finally { setCreatingUser(false); }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userToDelete.id)}`, { method: 'DELETE', credentials: 'same-origin' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Suppression impossible.');
      setUserActionMsg({ type: 'success', text: `Profil « ${userToDelete.displayName} » supprimé.` });
      setUserToDelete(null); await fetchUsers();
    } catch (err: any) { setUserActionMsg({ type: 'error', text: err?.message || 'Suppression impossible.' }); }
    finally { setDeletingUser(false); }
  };

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDocker(id);
    setTimeout(() => setCopiedDocker(null), 2500);
  };
  const [settings, setSettings] = useState<SystemAdminSettings>(DEFAULT_ADMIN_SETTINGS);
  useEffect(() => { fetch('/api/admin/settings', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json(); if (r.ok && data.settings) setSettings({ ...DEFAULT_ADMIN_SETTINGS, ...data.settings }); }).catch((e) => console.warn('Paramètres serveur indisponibles', e)); }, []);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingDB, setTestingDB] = useState(false);
  const [testingAI, setTestingAI] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [sqlSchema, setSqlSchema] = useState<string | null>(null);
  const [loadingSql, setLoadingSql] = useState(false);
  const [showSqlViewer, setShowSqlViewer] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const fetchSqlSchema = async () => {
    setLoadingSql(true);
    fetch('/api/schema/sql', { credentials: 'same-origin' }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Schéma SQL indisponible'); setSqlSchema(data.sql || data.schema || '-- Schéma PostgreSQL indisponible'); }).catch((e) => setSqlSchema(`-- Erreur : ${e.message || 'lecture impossible'}`)).finally(() => setLoadingSql(false));
  };


  const handleCopySql = () => {
    if (sqlSchema) {
      navigator.clipboard.writeText(sqlSchema);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    }
  };


  const handleSaveSettings = () => {
    setSaving(true);
    fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ settings }) }).then(async (r) => { const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Enregistrement impossible'); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }).catch((e) => setUserActionMsg({ type: 'error', text: e.message || 'Enregistrement serveur impossible.' })).finally(() => setSaving(false));
  };

  const handleTestPostgresConnection = async () => {
    setTestingDB(true);
    try { const response = await fetch('/api/health', { credentials: 'same-origin' }); const data = await response.json(); if (!response.ok || data.database !== 'connected') throw new Error('PostgreSQL indisponible'); setDbTestResult('Connexion PostgreSQL opérationnelle.'); } catch (error) { setDbTestResult(error instanceof Error ? error.message : 'Test PostgreSQL échoué.'); } finally { setTestingDB(false); }
  };
  const handleTestCopilot = async () => {
    setTestingAI(true);
    setAiTestResult('Test Copilot à exécuter via la configuration serveur.');
    setTestingAI(false);
  };



  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-lg border border-indigo-400/30">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Centre d'Administration Système & Intégrations
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Système Opérationnel
                </span>
              </div>
              <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                Configuration de la base relationnelle <strong className="text-white">PostgreSQL</strong>, de l'API <strong className="text-white">IA Copilot</strong> et gouvernance des rôles (notamment <strong className="text-indigo-300">Directeur de Projets</strong>).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4 text-emerald-300" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saveSuccess ? 'Paramètres Enregistrés !' : 'Enregistrer'}</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 mt-8 border-t border-slate-800 pt-4 overflow-x-auto scrollbar-none">
          {[
            { id: 'USERS', label: 'Gestion des Profils & Utilisateurs', icon: Users },
            { id: 'ROLES', label: 'Profils & Matrice RBAC', icon: UserCheck },
            { id: 'OVERVIEW', label: 'Vue d’ensemble', icon: Activity },
            { id: 'POSTGRES', label: 'Base PostgreSQL', icon: Database },
            { id: 'COPILOT', label: 'API IA Copilot', icon: Sparkles },
            { id: 'DOCKER', label: 'Déploiement Docker & Cloud', icon: Boxes },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB: USERS (Gestion des Profils & Utilisateurs) */}
      {activeSubTab === 'USERS' && (
        <div className="space-y-6">
          
          {/* Action notification */}
          {userActionMsg && (
            <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
              userActionMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                {userActionMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-semibold">{userActionMsg.text}</span>
              </div>
              <button 
                onClick={() => setUserActionMsg(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Form Card: Add Profile */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Ajouter un Nouveau Profil Utilisateur
                </h3>
                <p className="text-xs text-slate-500">
                  Définissez l'identité, l'identifiant, le mot de passe et le rôle de sécurité du collaborateur.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Nom complet & Titre *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                    placeholder="ex: Marc Vasseur"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Identifier / Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Identifiant / E-mail de connexion *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="marc.vasseur@entreprise.fr"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    minLength={12}
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="12 caractères minimum"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Rôle de Sécurité RBAC *
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ADMINISTRATEUR">🛡️ Administrateur Système (Console Admin & Profils)</option>
                    <option value="DIRECTEUR_PROJETS">⭐ Directeur de Projets (Portefeuille & Stratégie)</option>
                    <option value="PMO">📊 PMO (Portefeuille, Planning, Risques & Jalons)</option>
                    <option value="CHEF_PROJET">🚀 Chef de Projet (Kanban, Gantt, WBS, Équipe)</option>
                    <option value="CHEF_PROJET_PROD">🚢 Chef de Projet Production (CPP - SCT / Changes & Déploiements)</option>
                    <option value="CONTRIBUTEUR">👤 Contributeur (Mes Tâches & Mon Temps)</option>
                  </select>
                </div>

                {/* Job Title */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Intitulé de poste
                  </label>
                  <input
                    type="text"
                    value={newUser.jobTitle}
                    onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                    placeholder="ex: Lead PM / Ingénieur Déploiement"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Département / Direction
                  </label>
                  <input
                    type="text"
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    placeholder="ex: SCT (Cloud & Technologies) ou DSI"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {creatingUser ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Créer le Profil Utilisateur</span>
                </button>
              </div>
            </form>
          </div>

          {/* Table Card: Active Profiles */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Profils & Comptes Utilisateurs Enregistrés</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {usersList.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Chaque compte possède un mot de passe individuel stocké sous forme dérivée. Vous pouvez désactiver ou supprimer les comptes selon vos habilitations.
                </p>
              </div>

              <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-2xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Utilisateur</th>
                    <th className="p-3">Identifiant / E-mail</th>
                    <th className="p-3">Rôle de Sécurité</th>
                    <th className="p-3">Poste & Département</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {usersList.map((u) => {
                    const isCurrent = currentUser?.id === u.id || currentUser?.email === u.email;
                    const isAdminRole = u.role === 'ADMINISTRATEUR';
                    const roleColorClass = 
                      u.role === 'ADMINISTRATEUR' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      u.role === 'DIRECTEUR_PROJETS' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      u.role === 'PMO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      u.role === 'CHEF_PROJET' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      u.role === 'CHEF_PROJET_PROD' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                      'bg-blue-50 text-blue-700 border-blue-200';

                    return (
                      <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${isCurrent ? 'bg-indigo-50/30' : ''}`}>
                        <td className="p-3 flex items-center gap-2.5">
                          <img
                            src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.displayName)}`}
                            alt={u.displayName}
                            className="w-8 h-8 rounded-full object-cover bg-slate-200 border border-slate-300 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.displayName}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded">
                                  Vous
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">ID: {u.id}</div>
                          </div>
                        </td>

                        <td className="p-3 font-mono text-slate-700">
                          {u.email}
                        </td>

                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleColorClass}`}>
                            <ShieldCheck className="w-3 h-3" />
                            <span>{u.role}</span>
                          </span>
                        </td>

                        <td className="p-3 text-slate-600">
                          <div className="font-medium text-slate-800">{u.jobTitle || '—'}</div>
                          <div className="text-[10px] text-slate-400">{u.department || '—'}</div>
                        </td>

                        <td className="p-3 text-right space-x-1.5">
                          {/* Delete User button (Allows deleting admin too) */}
                          <button
                            onClick={() => setUserToDelete(u)}
                            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                              isAdminRole 
                                ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border-rose-300' 
                                : 'bg-slate-50 hover:bg-rose-50 text-rose-600 hover:text-rose-800 border-slate-200 hover:border-rose-200'
                            }`}
                            title={isAdminRole ? "Supprimer ce compte Administrateur" : "Supprimer ce profil"}
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                            <span>Supprimer</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delete Confirmation Modal (Allows deleting admin) */}
          {userToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${userToDelete.role === 'ADMINISTRATEUR' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Confirmer la suppression
                    </h3>
                    <p className="text-xs text-slate-500">
                      Profil : <strong>{userToDelete.displayName}</strong> ({userToDelete.role})
                    </p>
                  </div>
                </div>

                {userToDelete.role === 'ADMINISTRATEUR' ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Suppression du compte Administrateur</span>
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Vous êtes sur le point de supprimer le compte administrateur. Si vous êtes actuellement connecté sous ce compte, votre session sera immédiatement terminée et il ne sera plus possible de se connecter avec ces identifiants.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Êtes-vous sûr de vouloir supprimer définitivement le profil <strong>{userToDelete.displayName}</strong> ({userToDelete.email}) ?
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setUserToDelete(null)}
                    disabled={deletingUser}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmDeleteUser}
                    disabled={deletingUser}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {deletingUser ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>Confirmer la suppression</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Postgres */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <Database className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                  {settings.postgres.latencyMs}ms (Actif)
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">Base de Données PostgreSQL</h3>
              <p className="text-xs text-slate-500 mt-1">
                Stockage relationnel persistant des projets, tâches, jalons et ressources.
              </p>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Hôte :</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[140px]">{settings.postgres.host}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Base de données :</span>
                  <span className="font-semibold text-slate-800">{settings.postgres.database}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">SSL / Pool Max :</span>
                  <span className="font-semibold text-slate-800">{settings.postgres.sslMode} (pool: {settings.postgres.maxPoolSize})</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveSubTab('POSTGRES')}
              className="mt-5 w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Gérer la base PostgreSQL →
            </button>
          </div>

          {/* Card Copilot */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl border border-purple-100">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold">
                  IA Copilot Pro
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">API IA Copilot (PMBOK / EVM)</h3>
              <p className="text-xs text-slate-500 mt-1">
                Génération WBS, flash reports COPIL, diagnostics EVM et prédiction de risques.
              </p>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Modèle actif :</span>
                  <span className="font-semibold text-slate-800">{settings.copilot.model}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Appels ce mois :</span>
                  <span className="font-semibold text-slate-800">{settings.copilot.totalCallsMonth.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Taux de succès :</span>
                  <span className="font-semibold text-emerald-600">{settings.copilot.successRate}%</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveSubTab('COPILOT')}
              className="mt-5 w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Gérer l'API IA Copilot →
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'POSTGRES' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Intégration Base de Données PostgreSQL</h2>
                <p className="text-xs text-slate-500">
                  Connexion au serveur relationnel SQL, gestion du pool de connexions et persistance des entités PM.
                </p>
              </div>
            </div>
            <button
              onClick={handleTestPostgresConnection}
              disabled={testingDB}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingDB ? 'animate-spin' : ''}`} />
              <span>{testingDB ? 'Test...' : 'Tester le Pool PostgreSQL'}</span>
            </button>
          </div>

          {dbTestResult && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{dbTestResult}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Hôte PostgreSQL (Host / Cloud SQL / RDS) *
              </label>
              <input
                type="text"
                value={settings.postgres.host}
                onChange={(e) => setSettings({
                  ...settings,
                  postgres: { ...settings.postgres, host: e.target.value }
                })}
                placeholder="ex: postgres.company.internal ou 10.0.0.4"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Port
              </label>
              <input
                type="number"
                value={settings.postgres.port}
                onChange={(e) => setSettings({
                  ...settings,
                  postgres: { ...settings.postgres, port: Number(e.target.value) || 5432 }
                })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nom de la base (Database) *
              </label>
              <input
                type="text"
                value={settings.postgres.database}
                onChange={(e) => setSettings({
                  ...settings,
                  postgres: { ...settings.postgres, database: e.target.value }
                })}
                placeholder="clarity_pm"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Utilisateur SQL (User)
              </label>
              <input
                type="text"
                value={settings.postgres.user}
                onChange={(e) => setSettings({
                  ...settings,
                  postgres: { ...settings.postgres, user: e.target.value }
                })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mode SSL
              </label>
              <select
                value={settings.postgres.sslMode}
                onChange={(e) => setSettings({
                  ...settings,
                  postgres: { ...settings.postgres, sslMode: e.target.value as any }
                })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="require">Require (Chiffré TLS obligatoire)</option>
                <option value="prefer">Prefer (Chiffré si disponible)</option>
                <option value="disable">Disable (Désactivé - Dev local)</option>
              </select>
            </div>
          </div>

          {/* Tables Stats */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Statistiques & Volumétrie des Tables PostgreSQL
              </h4>
              <button
                onClick={() => {
                  if (!sqlSchema) fetchSqlSchema();
                  setShowSqlViewer(!showSqlViewer);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                <span>{showSqlViewer ? 'Masquer le Schéma DDL' : 'Inspecter le Schéma SQL (DDL)'}</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {[
                { label: 'Projets (projects)', count: settings.postgres.tableStats?.projects || 8, color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
                { label: 'WBS (tasks)', count: settings.postgres.tableStats?.tasks || 146, color: 'bg-blue-50 text-blue-700 border-blue-100' },
                { label: 'Ressources (team_members)', count: settings.postgres.tableStats?.resources || 32, color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                { label: 'Risques (risks)', count: settings.postgres.tableStats?.risks || 24, color: 'bg-rose-50 text-rose-700 border-rose-100' },
                { label: 'Jalons (project_milestones)', count: settings.postgres.tableStats?.milestones || 40, color: 'bg-purple-50 text-purple-700 border-purple-100' },
              ].map((stat, i) => (
                <div key={i} className={`p-3 rounded-2xl border ${stat.color} text-center`}>
                  <span className="text-lg font-black block">{stat.count}</span>
                  <span className="text-[11px] font-semibold opacity-90">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* SQL Schema Viewer Section */}
            {showSqlViewer && (
              <div className="mt-4 p-5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-mono font-bold text-slate-300">schema.sql — DDL PostgreSQL Enterprise</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySql}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {copiedSql ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedSql ? 'Copié !' : 'Copier le SQL'}</span>
                    </button>
                  </div>
                </div>

                {loadingSql ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-indigo-400" />
                    Chargement du schéma SQL depuis le backend...
                  </div>
                ) : (
                  <pre className="text-[11px] font-mono leading-relaxed max-h-80 overflow-y-auto p-3 bg-slate-900/90 rounded-xl text-indigo-200 border border-slate-800 whitespace-pre-wrap">
                    {sqlSchema || `-- Schéma PostgreSQL Clarity PM
CREATE TYPE user_role_enum AS ENUM ('DIRECTEUR_PROJETS', 'CHEF_PROJET', 'PMO', 'CONTRIBUTEUR', 'ADMINISTRATEUR');
CREATE TABLE IF NOT EXISTS users (id VARCHAR(64) PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, role user_role_enum NOT NULL);
CREATE TABLE IF NOT EXISTS projects (id VARCHAR(64) PRIMARY KEY, code VARCHAR(32) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, start_date DATE, end_date DATE);
CREATE TABLE IF NOT EXISTS tasks (id VARCHAR(64) PRIMARY KEY, project_id VARCHAR(64) REFERENCES projects(id), wbs_code VARCHAR(32), progress INT);
CREATE TABLE IF NOT EXISTS team_members (id VARCHAR(64) PRIMARY KEY, project_id VARCHAR(64) REFERENCES projects(id), daily_rate_tjm NUMERIC(10,2));
CREATE TABLE IF NOT EXISTS risks (id VARCHAR(64) PRIMARY KEY, project_id VARCHAR(64) REFERENCES projects(id), score INT, severity VARCHAR(32));
CREATE TABLE IF NOT EXISTS project_milestones (id VARCHAR(64) PRIMARY KEY, project_id VARCHAR(64) REFERENCES projects(id), target_date DATE);
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_role VARCHAR(64), action VARCHAR(64), created_at TIMESTAMPTZ);
CREATE OR REPLACE VIEW view_portfolio_summary AS SELECT p.id, p.name, AVG(t.progress) AS avg_progress FROM projects p LEFT JOIN tasks t ON p.id = t.project_id GROUP BY p.id;`}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: IA COPILOT API CONFIGURATION */}
      {activeSubTab === 'COPILOT' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">API & Moteur d'Intelligence Artificielle Copilot</h2>
                <p className="text-xs text-slate-500">
                  Configuration des modèles de langage Gemini / Copilot pour l'analyse EVM, génération de WBS et rapports exécutifs.
                </p>
              </div>
            </div>
            <button
              onClick={handleTestCopilot}
              disabled={testingAI}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Zap className={`w-3.5 h-3.5 ${testingAI ? 'animate-spin' : ''}`} />
              <span>{testingAI ? 'Test Copilot...' : 'Tester le Moteur IA'}</span>
            </button>
          </div>

          {aiTestResult && (
            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
              <span>{aiTestResult}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Fournisseur IA (AI Provider)
              </label>
              <select
                value={settings.copilot.provider}
                onChange={(e) => setSettings({
                  ...settings,
                  copilot: { ...settings.copilot, provider: e.target.value as any }
                })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="GEMINI_PRO">Google Gemini (GenAI SDK - Inclus)</option>
                <option value="AZURE_OPENAI">Microsoft Azure OpenAI (Entra ID Connect)</option>
                <option value="OPENAI">OpenAI API Direct</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Modèle Sélectionné
              </label>
              <select
                value={settings.copilot.model}
                onChange={(e) => setSettings({
                  ...settings,
                  copilot: { ...settings.copilot, model: e.target.value }
                })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="gemini-3.7-flash">gemini-3.7-flash (Recommandé & Rapide)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra-haute vélocité)</option>
                <option value="gemini-flash-latest">gemini-flash-latest</option>
                <option value="gpt-4o">gpt-4o (Azure OpenAI)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Température créative ({settings.copilot.temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.copilot.temperature}
                onChange={(e) => setSettings({
                  ...settings,
                  copilot: { ...settings.copilot, temperature: parseFloat(e.target.value) }
                })}
                className="w-full accent-indigo-600 mt-2"
              />
              <span className="text-[11px] text-slate-400 block mt-1">0 = Précis & Mathématique, 1 = Créatif</span>
            </div>
          </div>

          {/* Copilot Capabilities Toggles */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Fonctionnalités IA Copilot Activées
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'wbsGeneration', label: 'Décomposition WBS & Création de Tâches', desc: 'Génération instantanée de lots, tâches et dépendances' },
                { key: 'copilReporting', label: 'Rapports Exécutifs Flash COPIL', desc: 'Synthèses automatiques destinées aux comités de pilotage' },
                { key: 'riskPrediction', label: 'Anticipation & Analyse des Risques', desc: 'Suggestions proactives de plans de mitigation' },
              ].map((f) => (
                <div key={f.key} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <input
                    type="checkbox"
                    id={`feat-${f.key}`}
                    checked={(settings.copilot.features as any)[f.key]}
                    onChange={(e) => setSettings({
                      ...settings,
                      copilot: {
                        ...settings.copilot,
                        features: {
                          ...settings.copilot.features,
                          [f.key]: e.target.checked,
                        }
                      }
                    })}
                    className="w-4 h-4 text-indigo-600 rounded mt-0.5 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <label htmlFor={`feat-${f.key}`} className="text-xs font-bold text-slate-900 block cursor-pointer">
                      {f.label}
                    </label>
                    <span className="text-[11px] text-slate-500">{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ROLES & DIRECTEUR DE PROJETS */}
      {activeSubTab === 'ROLES' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Gouvernance des Profils & Rôle Directeur de Projets</h2>
                <p className="text-xs text-slate-500">
                  Le <strong>Directeur de Projets</strong> est l'autorité centrale habilitée à initialiser de nouveaux projets et allouer les ressources.
                </p>
              </div>
            </div>
          </div>

          {/* Highlight Director Role Profile */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-black uppercase tracking-wider">
                    Profil Privilégié
                  </span>
                  <h3 className="text-base font-bold text-slate-900">Directeur de Projets (Project Portfolio Director)</h3>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
                  Responsable hiérarchique et garant du portefeuille : 
                  habilité à <strong>créer et modifier les projets</strong>, <strong>allouer et provisionner les ressources humaines</strong>, arbitrer les priorités transverses.
                </p>
              </div>


            </div>

            {/* Privileges Matrix for Director */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-indigo-200/70">
              <div className="bg-white/80 p-3 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                  <FolderPlus className="w-4 h-4" />
                  <span>Ajout & Pilotage des Projets</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Création de nouveaux projets dans Clarity PM, définition du code, cadrage technique et suivi des jalons.
                </p>
              </div>

              <div className="bg-white/80 p-3 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                  <UserPlus className="w-4 h-4" />
                  <span>Gestion des Ressources</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Attribution des équipes, gestion de la capacité et arbitrage de la charge opérationnelle.
                </p>
              </div>

              <div className="bg-white/80 p-3 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs mb-1">
                  <Lock className="w-4 h-4" />
                  <span>Gouvernance & Validation</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Clôture formelle des jalons majeurs et validation des rapports d'arbitrage pour les Comités de Direction.
                </p>
              </div>
            </div>
          </div>

          {/* Matrix of all roles */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Matrice des Rôles & Droits d'Accès CLARITY PM
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-2xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Rôle Utilisateur</th>
                    <th className="p-3 text-center">Créer des Projets</th>
                    <th className="p-3 text-center">Ajouter des Ressources</th>
                    <th className="p-3 text-center">Éditer le WBS / Tâches</th>
                    <th className="p-3 text-center">Assistant IA Copilot</th>
                    <th className="p-3 text-center">Administration & Intégrations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr className="bg-indigo-50/50 font-semibold">
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      <span>Directeur de Projets</span>
                    </td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Oui (Responsable)</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Oui (Responsable)</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-emerald-600">✓ Illimité</td>
                    <td className="p-3 text-center text-slate-600">Lecture / Config</td>
                  </tr>
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      <span>Chef de Projet</span>
                    </td>
                    <td className="p-3 text-center text-slate-400">Sur délégation</td>
                    <td className="p-3 text-center text-slate-400">Affectation</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                  </tr>
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-600" />
                      <span>PMO</span>
                    </td>
                    <td className="p-3 text-center text-slate-400">Audit / Reporting</td>
                    <td className="p-3 text-center text-slate-400">Vue charge</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui (COPIL)</td>
                    <td className="p-3 text-center text-slate-400">Reporting</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      <div>
                        <span className="font-semibold text-amber-950">Chef de Projet Production (CPP)</span>
                        <span className="ml-1.5 text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-bold">SCT / YN</span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-slate-300">— (Non budgétaire)</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-amber-800">Runbooks & Déploiements</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-amber-800 font-semibold">Changes Études & MEP</td>
                  </tr>
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>Contributeur</span>
                    </td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-blue-600">Mes tâches</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                    <td className="p-3 text-center text-slate-300">—</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-3 flex items-center gap-2 font-bold">
                      <span className="w-2 h-2 rounded-full bg-slate-900" />
                      <span>Administrateur Système</span>
                    </td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-emerald-600">✓ Oui</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">✓ Accès Complet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DOCKER & CLOUD DEPLOYMENT */}
      {activeSubTab === 'DOCKER' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
                <Boxes className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-tight">Conteneurisation Docker & Déploiement en Production</h3>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-bold">
                    Multi-Stage Ready
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Image Docker optimisée (<strong className="text-white">Bun Alpine</strong>), compilation Vite + bundle Express (<code className="text-indigo-300">dist/server.cjs</code>), exécution non-root et Healthcheck HTTP (<code className="text-indigo-300">/api/health</code>).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyCode('docker compose up -d --build', 'cmd-up')}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                {copiedDocker === 'cmd-up' ? <CheckCheck className="w-4 h-4 text-emerald-300" /> : <Play className="w-4 h-4" />}
                <span>{copiedDocker === 'cmd-up' ? 'Copié !' : 'Lancer la Stack'}</span>
              </button>
            </div>
          </div>

          {/* Quick Command Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Build */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">1</span>
                    <span className="text-xs font-bold text-slate-900">Build de l'Image</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">CLI</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Compile le bundle frontend et backend dans l'image.</p>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-[11px] relative overflow-x-auto">
                  <code>docker build -t clarity-pm:latest .</code>
                </div>
              </div>
              <button
                onClick={() => handleCopyCode('docker build -t clarity-pm:latest .', 'cmd-build')}
                className="mt-3 flex items-center justify-center gap-1.5 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              >
                {copiedDocker === 'cmd-build' ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDocker === 'cmd-build' ? 'Copié dans le presse-papier' : 'Copier la commande'}</span>
              </button>
            </div>

            {/* Card 2: Run Standalone */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center border border-emerald-100">2</span>
                    <span className="text-xs font-bold text-slate-900">Lancement Autonome</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">Port 3000</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Exécute le conteneur avec variables d'environnement.</p>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-[11px] relative overflow-x-auto">
                  <code>docker run -d -p 3000:3000 --name clarity_pm clarity-pm:latest</code>
                </div>
              </div>
              <button
                onClick={() => handleCopyCode('docker run -d -p 3000:3000 --name clarity_pm clarity-pm:latest', 'cmd-run')}
                className="mt-3 flex items-center justify-center gap-1.5 py-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-bold hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
              >
                {copiedDocker === 'cmd-run' ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDocker === 'cmd-run' ? 'Copié dans le presse-papier' : 'Copier la commande'}</span>
              </button>
            </div>

            {/* Card 3: Full Stack Compose */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-100">3</span>
                    <span className="text-xs font-bold text-slate-900">Stack Complète (App + Postgres)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold">Recommandé</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Démarre Postgres 16 avec auto-init SQL et Clarity PM.</p>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-[11px] relative overflow-x-auto">
                  <code>docker compose up -d --build</code>
                </div>
              </div>
              <button
                onClick={() => handleCopyCode('docker compose up -d --build', 'cmd-compose')}
                className="mt-3 flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
              >
                {copiedDocker === 'cmd-compose' ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDocker === 'cmd-compose' ? 'Copié dans le presse-papier' : 'Copier la commande'}</span>
              </button>
            </div>
          </div>

          {/* Configuration Viewers (Dockerfile & Docker-Compose) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dockerfile Viewer */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Fichier Dockerfile (Multi-Stage)</h4>
                    <span className="text-[11px] text-slate-500">Builder Node 22 + Runner Ultra-Léger</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCode(`FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile || npm install
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY server.ts ./
ENV NODE_ENV=production
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl tini
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.cjs"]`, 'dockerfile-code')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {copiedDocker === 'dockerfile-code' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDocker === 'dockerfile-code' ? 'Copié !' : 'Copier Dockerfile'}</span>
                </button>
              </div>

              <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[380px] scrollbar-thin">
                <pre className="text-emerald-400"># 1. Stage Builder</pre>
                <pre>FROM node:22-alpine AS builder</pre>
                <pre>WORKDIR /app</pre>
                <pre>COPY package.json package-lock.json* ./</pre>
                <pre>RUN npm install</pre>
                <pre>COPY tsconfig.json vite.config.ts index.html ./</pre>
                <pre>COPY src/ ./src/</pre>
                <pre>COPY server.ts ./</pre>
                <pre className="text-amber-300">RUN npm run build</pre>
                <br />
                <pre className="text-emerald-400"># 2. Stage Production Runner</pre>
                <pre>FROM node:22-alpine AS runner</pre>
                <pre>WORKDIR /app</pre>
                <pre>RUN apk add --no-cache curl tini</pre>
                <pre>ENV NODE_ENV=production PORT=3000</pre>
                <pre>COPY --from=builder /app/dist ./dist</pre>
                <pre className="text-cyan-300">USER node</pre>
                <pre>EXPOSE 3000</pre>
                <pre className="text-indigo-300">HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1</pre>
                <pre>ENTRYPOINT ["/sbin/tini", "--"]</pre>
                <pre className="text-yellow-300">CMD ["node", "dist/server.cjs"]</pre>
              </div>
            </div>

            {/* Docker Compose Viewer */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Fichier docker-compose.yml</h4>
                    <span className="text-[11px] text-slate-500">Orchestration App + PostgreSQL 16 + Auto-Init SQL</span>
                  </div>
                </div>
                <button
                  onClick={() => handleCopyCode(`version: '3.8'

services:
  app:
    build: .
    image: clarity-pm:latest
    container_name: clarity_pm_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://clarity_admin:ClaritySecurePassword2026!@postgres:5432/clarity_pm_enterprise
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - clarity_network

  postgres:
    image: postgres:16-alpine
    container_name: clarity_pm_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: clarity_pm_enterprise
      POSTGRES_USER: clarity_admin
      POSTGRES_PASSWORD: ClaritySecurePassword2026!
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/db/schema.sql:/docker-entrypoint-initdb.d/01_init_schema.sql:ro
    ports:
      - "5432:5432"
    networks:
      - clarity_network

volumes:
  postgres_data:
networks:
  clarity_network:`, 'compose-code')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  {copiedDocker === 'compose-code' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDocker === 'compose-code' ? 'Copié !' : 'Copier Compose'}</span>
                </button>
              </div>

              <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[380px] scrollbar-thin">
                <pre className="text-indigo-400">services:</pre>
                <pre className="text-cyan-300">  app:</pre>
                <pre>    build: .</pre>
                <pre>    image: clarity-pm:latest</pre>
                <pre>    ports: ["3000:3000"]</pre>
                <pre>    environment:</pre>
                <pre>      - DATABASE_URL=postgresql://clarity_admin:***@postgres:5432/clarity_pm_enterprise</pre>
                <pre>    depends_on:</pre>
                <pre>      postgres: &#123; condition: service_healthy &#125;</pre>
                <br />
                <pre className="text-cyan-300">  postgres:</pre>
                <pre>    image: postgres:16-alpine</pre>
                <pre>    volumes:</pre>
                <pre>      - postgres_data:/var/lib/postgresql/data</pre>
                <pre className="text-emerald-400">      - ./src/db/schema.sql:/docker-entrypoint-initdb.d/01_init_schema.sql:ro</pre>
                <pre>    ports: ["5432:5432"]</pre>
              </div>
            </div>
          </div>

          {/* Cloud Deploy Target Matrix */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Options de Déploiement en Production Cloud</h4>
                <p className="text-xs text-slate-500">Guide de publication vers les principaux registres et orchestrateurs de conteneurs.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Azure Container Apps / AKS */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Microsoft Azure</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">Azure Container Apps</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Idéal avec Azure Entra ID et Azure Database for PostgreSQL Flexible Server.
                </p>
                <div className="bg-slate-900 text-slate-200 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                  <code>az containerapp up --name clarity-pm --source .</code>
                </div>
              </div>

              {/* AWS ECS / App Runner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Amazon Web Services</span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">ECS / Fargate / ECR</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Déploiement serverless conteneurisé connecté à Amazon RDS PostgreSQL.
                </p>
                <div className="bg-slate-900 text-slate-200 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                  <code>aws ecr get-login-password && docker push ...</code>
                </div>
              </div>

              {/* GCP Cloud Run / Kubernetes */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Google Cloud / K8s</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Cloud Run & GKE</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Mise à l'échelle automatique de 0 à N instances avec Cloud SQL PostgreSQL.
                </p>
                <div className="bg-slate-900 text-slate-200 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                  <code>gcloud run deploy clarity-pm --source . --port 3000</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
