# Connexion au compte Microsoft 365 et ouverture de Copilot

Clarity PM propose une authentification individuelle Microsoft Entra ID (OpenID Connect) avec une fenêtre popup MSAL. Après authentification, l'utilisateur peut ouvrir Microsoft 365 Copilot dans un nouvel onglet.

## Ce que fait cette fonctionnalité

- Authentifie un compte professionnel ou scolaire Microsoft avec MSAL Browser.
- Demande uniquement les scopes OpenID Connect `openid`, `profile` et `email`.
- Ne demande aucun scope Microsoft Graph et n'appelle aucune API Microsoft 365.
- Ne stocke aucun mot de passe ni jeton dans le backend Clarity.
- Utilise le cache MSAL du navigateur pour retrouver la session.
- Ouvre Microsoft 365 Copilot sur `https://m365.cloud.microsoft/chat`.

La connexion ne donne pas à Clarity accès au moteur Copilot, aux données Microsoft 365 ou aux API Graph. L'accès à Copilot dépend de la licence et des droits du compte dans le tenant Microsoft.

## Configuration Microsoft Entra ID

1. Dans le centre d'administration Microsoft Entra, créer une inscription d'application dédiée à Clarity PM.
2. Choisir les types de comptes « Comptes dans un annuaire organisationnel » (single tenant recommandé pour une entreprise) ou « Comptes dans tout annuaire organisationnel ».
3. Dans **Authentification**, ajouter une plateforme **Application monopage (SPA)**.
4. Ajouter l'URI de redirection exacte : `https://VOTRE-DOMAINE/auth/popup.html`.
5. Ne créer aucun secret client pour cette SPA.
6. Aucun droit Microsoft Graph n'est nécessaire pour cette simple connexion OpenID Connect.
7. Renseigner les variables de build :
   - `VITE_MICROSOFT_CLIENT_ID` : ID d'application (client).
   - `VITE_MICROSOFT_TENANT_ID` : ID du tenant pour un déploiement mono-tenant. Pour autoriser tous les comptes professionnels, utiliser `organizations`.

Les variables `VITE_*` sont intégrées au bundle frontend : le Client ID et le Tenant ID ne sont pas des secrets. Ne jamais y placer de secret client.

## Test

1. Déployer la nouvelle version avec les deux variables de build configurées.
2. Ouvrir Clarity PM et se connecter avec son compte applicatif Clarity.
3. Cliquer sur **Connecter mon compte Microsoft**.
4. Choisir le compte professionnel dans la popup Microsoft et terminer le MFA/consentement si demandé.
5. Le compte apparaît comme connecté et Microsoft 365 Copilot s'ouvre dans un nouvel onglet.
6. Cliquer sur **Déconnecter** pour retirer le compte du cache MSAL de ce navigateur.

Chaque utilisateur doit effectuer cette opération dans son propre profil navigateur. L'authentification Clarity et l'authentification Microsoft restent deux sessions distinctes.
