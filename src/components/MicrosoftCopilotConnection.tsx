import React, { useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';
import { PublicClientApplication, type AccountInfo } from '@azure/msal-browser';

const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID?.trim() || '';
const MICROSOFT_TENANT_ID = import.meta.env.VITE_MICROSOFT_TENANT_ID?.trim() || 'organizations';
const MICROSOFT_AUTHORITY = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`;
const MICROSOFT_REDIRECT_URI = `${window.location.origin}/redirect.html`;
const COPILOT_URL = 'https://m365.cloud.microsoft/chat';

export const MicrosoftCopilotConnection: React.FC = () => {
  const [client, setClient] = useState<PublicClientApplication | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const configured = Boolean(MICROSOFT_CLIENT_ID);
  const configurationHint = useMemo(
    () => 'Configurez VITE_MICROSOFT_CLIENT_ID et l’URI SPA ' + MICROSOFT_REDIRECT_URI + ' dans Microsoft Entra ID.',
    []
  );

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const instance = new PublicClientApplication({
      auth: {
        clientId: MICROSOFT_CLIENT_ID,
        authority: MICROSOFT_AUTHORITY,
        redirectUri: MICROSOFT_REDIRECT_URI,
        postLogoutRedirectUri: MICROSOFT_REDIRECT_URI,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    });

    instance.initialize()
      .then(() => {
        if (!active) return;
        const accounts = instance.getAllAccounts();
        const savedAccount = accounts[0] || null;
        if (savedAccount) instance.setActiveAccount(savedAccount);
        setAccount(savedAccount);
        setClient(instance);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Initialisation Microsoft impossible.');
      });

    return () => { active = false; };
  }, [configured]);

  const connectAndOpenCopilot = async () => {
    if (!client || loading) return;
    setError('');
    setLoading(true);

    // Open the destination tab synchronously from the click to avoid popup blockers.
    const copilotTab = window.open('about:blank', '_blank');
    try {
      const response = await client.loginPopup({
        scopes: ['openid', 'profile', 'email'],
        prompt: 'select_account',
      });
      if (response.account) {
        client.setActiveAccount(response.account);
        setAccount(response.account);
      }
      if (copilotTab && !copilotTab.closed) {
        copilotTab.opener = null;
        copilotTab.location.href = COPILOT_URL;
      } else {
        window.open(COPILOT_URL, '_blank', 'noopener,noreferrer');
      }
    } catch (reason: unknown) {
      copilotTab?.close();
      const message = reason instanceof Error ? reason.message : 'Connexion Microsoft annulée ou impossible.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const openCopilot = () => {
    window.open(COPILOT_URL, '_blank', 'noopener,noreferrer');
  };

  const disconnect = async () => {
    if (!client || !account || loading) return;
    setLoading(true);
    setError('');
    try {
      await client.logoutPopup({ account, postLogoutRedirectUri: window.location.origin });
      setAccount(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Déconnexion Microsoft impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto mt-3 w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Connexion Microsoft Copilot">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Compte Microsoft 365</p>
            {account ? (
              <p className="truncate text-xs text-emerald-700">Connecté : {account.username || account.name || 'Compte Microsoft'}</p>
            ) : (
              <p className="text-xs text-slate-500">Connexion individuelle sécurisée · aucun mot de passe stocké dans Clarity</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {account ? (
            <>
              <button type="button" onClick={openCopilot} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
                <ExternalLink className="h-4 w-4" /> Ouvrir Microsoft 365 Copilot
              </button>
              <button type="button" onClick={disconnect} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <LogOut className="h-4 w-4" /> Déconnecter
              </button>
            </>
          ) : (
            <button type="button" onClick={connectAndOpenCopilot} disabled={!configured || !client || loading} title={!configured ? configurationHint : undefined} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <LogIn className="h-4 w-4" /> {loading ? 'Connexion en cours…' : 'Connecter mon compte Microsoft'}
            </button>
          )}
        </div>
      </div>

      {!configured && (
        <p className="mt-2 text-xs text-amber-700">Configuration administrateur requise : renseigner VITE_MICROSOFT_CLIENT_ID et déclarer l’URI de redirection SPA dans Entra ID.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <p className="mt-1 text-[11px] text-slate-500">Cette connexion authentifie l’identité Microsoft uniquement. Elle n’intègre pas le moteur Copilot dans Clarity et n’accorde aucun accès API à Microsoft 365.</p>
    </section>
  );
};
