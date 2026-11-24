# Clarity AI – Copilot Studio et client Outlook

## Fonctionnalités

Dans **Production / MEP → Assistant Copilot**, Clarity permet de générer :
- un mail de début de MEP ;
- un mail de fin de MEP ;
- un compte rendu COPROJ à partir des notes ou de la transcription saisies.

Le brouillon reste modifiable dans Clarity. Pour les deux mails MEP, le bouton **Ouvrir dans Outlook** prépare un nouveau message dans le client de messagerie par défaut du poste via le protocole standard `mailto:`. Pour utiliser Outlook, configurez Outlook comme application par défaut pour les liens e-mail dans Windows / votre navigateur.

## Architecture et limites

- Clarity dialogue avec l'agent Copilot Studio via le SDK Microsoft Agents/Copilot Studio.
- L'authentification Microsoft (MSAL) sert uniquement à autoriser l'accès à l'agent Copilot Studio.
- **Aucune intégration Outlook API / Microsoft Graph n'est utilisée.**
- Clarity ne lit pas la boîte Outlook, ne crée pas de brouillon dans le dossier Brouillons via le cloud et n'envoie aucun message.
- Le client Outlook local reçoit un nouveau message prérempli (destinataires, objet et corps) via `mailto:`. L'utilisateur vérifie et envoie manuellement.
- Si Outlook n'est pas configuré comme gestionnaire des liens `mailto:`, le navigateur peut ouvrir une autre application ou demander de choisir un client.
- Les notes et les données de projet/MEP sélectionnées sont transmises à l'agent Copilot Studio. Vérifiez les règles de confidentialité de votre organisation avant d'utiliser des informations internes ou sensibles.

## Configuration Copilot Studio

1. Ouvrir l'agent Clarity dans Copilot Studio et vérifier qu'il est publié et accessible à l'utilisateur.
2. Dans **Settings → Advanced → Metadata**, récupérer l'**Environment ID** et le **Schema name**.
3. Vérifier le nom de schéma de l'agent ; la valeur préremplie dans Clarity est `cr299_clarity_tB6p_X`.

## Authentification Copilot

L'intégration Copilot Studio nécessite une application Microsoft Entra de type SPA et une autorisation déléguée à l'agent :

1. Créer une inscription d'application dans le tenant qui héberge l'environnement Copilot Studio.
2. Ajouter une plateforme **Single-page application (SPA)** et l'URL HTTPS exacte de Clarity comme URI de redirection.
3. Ajouter l'autorisation déléguée **Power Platform API → CopilotStudio.Copilots.Invoke**.
4. Accorder le consentement requis par la politique de l'organisation.
5. Ne pas créer de client secret et ne jamais stocker de secret dans le navigateur.

Aucune permission Microsoft Graph, notamment `Mail.ReadWrite`, n'est nécessaire pour Outlook.

## Configuration dans Clarity

Dans **Production / MEP → Assistant Copilot → Clarity AI · Communication**, renseigner :
- **Tenant ID** : Directory (tenant) ID ;
- **Application (Client) ID** : Application (client) ID ;
- **Copilot Studio Environment ID** : valeur de l'environnement ;
- **Agent Schema name** : `cr299_clarity_tB6p_X` (à confirmer dans le tenant).

Enregistrer la configuration puis cliquer sur **Se connecter à Copilot**.

## Utilisation

1. Choisir **Mail de début de MEP**, **Mail de fin de MEP** ou **Compte rendu COPROJ (notes)**.
2. Sélectionner la MEP ou le projet concerné.
3. Pour le COPROJ, coller les notes ou la transcription.
4. Cliquer sur **Générer avec Copilot**.
5. Relire et corriger le sujet et le contenu dans Clarity.
6. Pour un mail MEP, renseigner les destinataires si nécessaire et cliquer sur **Ouvrir dans Outlook**.
7. Vérifier le message dans le client Outlook avant de l'envoyer manuellement.

Le protocole `mailto:` dépend du navigateur et du poste. Si le corps du message est trop long pour le gestionnaire de liens, utiliser **Copier** dans Clarity puis coller le contenu dans un nouveau message Outlook.

## Dépannage

- **AADSTS / consentement refusé** : vérifier le tenant, l'URI SPA et l'autorisation déléguée Copilot Studio.
- **Agent introuvable / 404** : vérifier l'Environment ID, le Schema name, la publication de l'agent et les droits d'accès de l'utilisateur.
- **Outlook ne s'ouvre pas** : vérifier qu'Outlook est installé et défini comme application par défaut pour le protocole `MAILTO` dans Windows et le navigateur.
- **Le sujet ou le corps n'est pas prérempli** : utiliser le bouton **Copier**, puis coller dans un nouveau message Outlook ; certains clients limitent la longueur des URI `mailto:`.
- **Aucune réponse exploitable** : vérifier les instructions et les sorties de l'agent Copilot Studio. Les informations manquantes doivent rester à confirmer et le contenu doit être relu.

## Références Microsoft

- [Intégrer une application web ou native à Copilot Studio avec Microsoft 365 Agents SDK](https://learn.microsoft.com/microsoft-copilot-studio/publication-integrate-web-or-native-app-m365-agents-sdk)
