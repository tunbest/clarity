# Clarity PM – Teams Copilot et communication production

## Architecture sans service de transcription

Le module **Production / MEP → Assistant communication** propose :
- génération des mails de début et de fin de MEP ;
- préparation d'un compte rendu COPROJ depuis les notes ou la transcription fournies par Teams / Microsoft 365 Copilot ;
- import de fichiers texte Teams `.vtt` et `.txt`, ou collage direct du contenu Copilot ;
- édition du compte rendu, copie et ouverture d'un nouveau message Outlook via `mailto:`.

**Teams / Copilot réalise le travail de réunion. Clarity ne capture, n'enregistre et ne transcrit aucun audio.** Aucun conteneur Whisper, modèle local, GPU ou service de transcription supplémentaire n'est déployé sur le VPS.

## Utilisation pendant et après une réunion

1. Démarrer la réunion dans Microsoft Teams.
2. Utiliser Copilot dans la réunion pour demander les points abordés, les décisions, les actions, les responsables et les échéances. La disponibilité dépend de la licence Copilot et des politiques Microsoft 365 de l'organisation.
3. Si Teams propose une transcription ou un récapitulatif exportable, récupérer le fichier `.vtt` / `.txt`. Sinon, copier les notes ou la réponse Copilot.
4. Dans Clarity, ouvrir **Production / MEP → Assistant communication**, choisir **Compte rendu COPROJ**, puis le projet concerné.
5. Importer le fichier texte ou coller les notes dans la zone de transcription.
6. Cliquer **Générer le CR COPROJ**, relire les décisions, actions, propriétaires et dates, puis corriger les éléments incertains.
7. Copier le compte rendu ou ouvrir un nouveau message Outlook.

Le traitement de génération du compte rendu utilise le fournisseur IA déjà configuré côté serveur Clarity. Le contenu textuel et le contexte projet sont envoyés à ce fournisseur ; aucun flux audio n'est envoyé.

## Limite importante : pas de transcription Teams activée

Copilot peut, selon la licence, le type de réunion et les paramètres de l'organisation, répondre à des questions et produire des notes pendant la réunion sans activer la transcription classique. Cela ne signifie pas qu'un verbatim complet sera disponible après la réunion. Si aucune transcription ni notes Copilot exportables ne sont disponibles, Clarity ne peut pas reconstituer les paroles qui n'ont pas été capturées.

Clarity ne lit pas automatiquement la session Copilot et ne récupère pas le contenu Teams en arrière-plan. Cette version ne met en œuvre ni Microsoft Graph, ni Copilot Studio, ni accès Entra ID spécifique à la réunion.

## Outlook

L'ouverture via `mailto:` préremplit une fenêtre de composition du client de messagerie configuré. Clarity ne lit pas la boîte Outlook, ne crée pas directement un brouillon dans la boîte aux lettres et n'envoie aucun message. L'utilisateur vérifie et envoie manuellement.

## Sécurité et exploitation

- Aucun enregistrement audio ou fichier audio n'est conservé par Clarity.
- Aucun service Whisper ou volume de cache Whisper n'est créé par le workflow de déploiement.
- Les routes de génération restent soumises à la session Clarity.
- Le compte rendu est un brouillon à valider ; ne jamais traiter une décision, une personne ou une échéance absente des notes comme un fait confirmé.
- Informer les participants et respecter les règles internes de confidentialité et de protection des données.
