import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  RefreshCw, 
} from 'lucide-react';
import { AppUser } from '../types';


interface LoginPageProps {
  onLoginSuccess: (user: AppUser) => void;
  currentUser?: AppUser | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const rememberMe = false;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Connexion locale par adresse e-mail et mot de passe
  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMsg('Veuillez renseigner votre identifiant ou adresse e-mail.');
      return;
    }

    if (!password) {
      setErrorMsg('Veuillez renseigner votre mot de passe.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ identifier: cleanId, password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.user) throw new Error(payload.error || 'Identifiants invalides.');
      onLoginSuccess(payload.user as AppUser);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Échec de la connexion. Vérifiez vos identifiants.');
    } finally { setLoading(false); }

  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 font-sans">
      
      {/* Brand Header */}
      <div className="w-full max-w-[440px] mb-4 text-center">
        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 shadow-xl mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-blue-600 to-cyan-400 flex items-center justify-center text-white font-black tracking-tight shadow-md">
            <span className="text-base font-black">C</span>
            <span className="text-[10px] font-bold text-cyan-200 -ml-0.5">PM</span>
          </div>
          <span className="text-lg font-black tracking-tight text-white">
            CLARITY <span className="text-cyan-400">PM</span>
          </span>
          <span className="text-[11px] font-semibold text-slate-300 border-l border-white/20 pl-2">
            Gestion de Portefeuille & Projets
          </span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-[440px]">
        <div className="bg-white rounded-3xl shadow-2xl p-7 sm:p-8 space-y-5 text-slate-800 border border-slate-100">
          
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Connexion Utilisateur
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Accédez à votre espace selon votre rôle et vos privilèges de sécurité.
            </p>
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
            Authentification sécurisée par le serveur. Le compte administrateur initial est créé à partir des secrets de déploiement.
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmitLogin} className="space-y-4">
            
            {/* Identifier / Email Field */}
            <div className="space-y-1.5">
              <label 
                htmlFor="input-identifier" 
                className="block text-xs font-bold text-slate-700"
              >
                Identifiant ou E-mail
              </label>
              <div className="relative">
                <input
                  id="input-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="prenom.nom@entreprise.fr"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all font-medium"
                />
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="input-password" 
                  className="block text-xs font-bold text-slate-700"
                >
                  Mot de passe
                </label>
                <span className="text-[11px] text-slate-400">
                </span>
              </div>
              <div className="relative">
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Saisissez votre mot de passe"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                id="btn-login-submit"
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Se connecter</span>
                  </>
                )}
              </button>
            </div>

          </form>


        </div>
      </div>

    </div>
  );
};
