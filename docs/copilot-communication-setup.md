# Clarity AI – Copilot Studio et brouillons Outlook

## Fonctionnalités

Dans **Assistant Copilot**, le panneau **Clarity AI · Communication** permet de générer :
- un mail de début de MEP ;
- un mail de fin de MEP ;
- un compte rendu COPROJ à partir de notes ou d'une transcription.

Le texte généré reste modifiable. Pour les mails MEP, l'utilisateur peut créer un brouillon dans Outlook. Clarity ne déclenche aucun envoi automatique.

## Architecture et sécurité

- L'authentification locale Clarity reste inchangée.
- La connexion Copilot Studio et Outlook est une authentification Microsoft séparée, effectuée dans le navigateur avec MSAL.
- Aucun client secret Entra n'est nécessaire pour cette application SPA.
- Les jetons MSAL sont conservés dans le stockage de session du navigateur.
- Le brouillon Outlook est créé par Microsoft Graph avec l'autorisation déléguée `Mail.ReadWrite`.
- Les notes et les données de projet sélectionnées sont envoyées à l'agent Copilot Studio pour générer le document. Vérifier les règles de confidentialité de l'organisation avant d'utiliser des données sensibles.

## Configuration à réaliser une fois dans Microsoft Entra

1. Créer une inscription d'application (App registrations) dans le même tenant que l'environnement Copilot Studio.
2. Choisir une application monoposte / single tenant et ajouter une plateforme **Single-page application (SPA)**.
3. Ajouter comme URI de redirection l'URL exacte utilisée pour accéder à Clarity (par exemple l'URL HTTPS de production).
4. Dans **API permissions**, ajouter :
   - **Power Platform API** → **Delegated permissions** → `CopilotStudio.Copilots.Invoke`.
   - **Microsoft Graph** → **Delegated permissions** → `Mail.ReadWrite`.
5. Accorder le consentement administrateur si la politique du tenant le demande.
6. Ne pas créer ni placer de client secret dans Clarity : le Client ID d'une SPA est public.

## Configuration dans Copilot Studio

1. Ouvrir l'agent Clarity et vérifier qu'il est publié.
2. Vérifier que l'inscription Entra est dans le même tenant que l'agent.
3. Dans **Settings → Advanced → Metadata**, récupérer l'**Environment ID** et le **Schema name**.
4. Le champ Schema name de Clarity est prérempli avec `cr299_clarity_tB6p_X` ; vérifier qu'il correspond bien à l'agent publié.
5. Le nom de schéma connu ne remplace pas l'Environment ID, le Tenant ID ni le Client ID.

## Configuration dans Clarity

Ouvrir **Production / MEP → Assistant Copilot → Clarity AI · Communication** et renseigner :
- Tenant ID : Directory (tenant) ID de l'inscription Entra ;
- Application (Client) ID : Application (client) ID de l'inscription ;
- Copilot Studio Environment ID : valeur des métadonnées de l'environnement ;
- Agent Schema name : `cr299_clarity_tB6p_X` (à confirmer dans le tenant).

Cliquer sur **Enregistrer la configuration**, puis **Se connecter à Copilot**. Le navigateur ouvre la fenêtre de connexion Microsoft.

## Utilisation

1. Choisir le type de document.
2. Sélectionner une MEP pour les mails, ou un projet et coller les notes/transcription pour un CR COPROJ.
3. Générer avec Copilot.
4. Relire et corriger le contenu.
5. Pour un mail MEP, renseigner éventuellement les destinataires puis cliquer sur **Créer le brouillon Outlook**.
6. Vérifier le message dans Outlook → Brouillons avant tout envoi manuel.

## Dépannage

- **AADSTS / consentement refusé** : vérifier le tenant, l'URI SPA et les permissions déléguées.
- **Agent introuvable / 404** : vérifier l'Environment ID, le Schema name, la publication de l'agent et le partage/droits d'accès de l'utilisateur.
- **Copilot répond mais Outlook échoue** : vérifier le consentement délégué Microsoft Graph `Mail.ReadWrite`.
- **Aucune réponse exploitable** : vérifier les instructions et les sorties de l'agent Copilot Studio. Clarity n'invente pas les informations manquantes ; le contenu reste à relire.

## Références Microsoft

- [Intégrer une application web ou native à Copilot Studio avec Microsoft 365 Agents SDK](https://learn.microsoft.com/microsoft-copilot-studio/publication-integrate-web-or-native-app-m365-agents-sdk)
- [Créer un brouillon Outlook avec Microsoft Graph](https://learn.microsoft.com/graph/api/user-post-messages?view=graph-rest-1.0)
