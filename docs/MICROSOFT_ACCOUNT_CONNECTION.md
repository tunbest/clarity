# Ouvrir Microsoft 365 Copilot depuis Clarity PM

Clarity PM propose un simple raccourci vers l'interface officielle Microsoft 365 Copilot.

- Aucun agent Copilot Studio.
- Aucune inscription d'application Entra ID.
- Aucun Client ID, secret, jeton ou API Microsoft.
- Aucune modification de l'authentification Clarity PM.
- Aucun accès aux données Microsoft 365 depuis Clarity.

Le bouton ouvre `https://m365.cloud.microsoft/chat` dans un nouvel onglet. Microsoft Edge réutilise la session SSO de l'utilisateur si son compte professionnel y est déjà connecté et si la politique de l'entreprise autorise cette session. Sinon, Microsoft peut demander une connexion ou une validation MFA.

Cette méthode ouvre Copilot dans son interface Microsoft officielle. Elle ne permet pas d'afficher les réponses Copilot dans Clarity PM.
