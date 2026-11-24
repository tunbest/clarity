# Clarity PM – Transcription Teams et communication

## Fonctionnement

Le module **Production / MEP → Assistant communication** propose :
- mails de début et de fin de MEP préparés côté serveur ;
- capture audio explicite d'une réunion Teams Desktop depuis Edge ou Chrome ;
- transcription française par Whisper / faster-whisper hébergé sur le VPS ;
- compte rendu COPROJ structuré à partir de la transcription ;
- édition du sujet et du corps, copie et ouverture d'un nouveau message Outlook via `mailto:`.

Aucune intégration Copilot Studio, Microsoft Entra, Microsoft Graph ou Outlook API n'est utilisée. Clarity ne lit pas la boîte Outlook et n'envoie aucun e-mail. L'ouverture `mailto:` préremplit une fenêtre de composition du client configuré ; l'utilisateur vérifie et envoie manuellement.

## Capture audio Teams Desktop

1. Ouvrir Clarity dans Edge ou Chrome via HTTPS et se connecter.
2. Aller dans **Production / MEP → Assistant communication** et choisir **Transcription + CR COPROJ**.
3. Cliquer **Démarrer l'écoute**.
4. Dans le sélecteur du navigateur, choisir l'écran sur lequel Teams Desktop est affiché et activer **Partager l'audio du système**.
5. Autoriser le microphone pour inclure également la voix locale. Si le microphone est refusé, seul l'audio système sera capturé.
6. Cliquer **Arrêter et transcrire** à la fin de la réunion.
7. Le fichier audio est envoyé au serveur privé Whisper du VPS ; le texte revient dans Clarity.
8. Le serveur utilise la clé `GEMINI_API_KEY` déjà configurée dans Clarity pour produire le CR. Relire, corriger, puis copier ou ouvrir le brouillon dans Outlook.

La capture nécessite une action explicite du navigateur et le partage de l'audio. Clarity n'écoute pas en arrière-plan. Le partage d'écran peut être interrompu par le navigateur ou l'utilisateur. Le navigateur enregistre l'audio pendant la réunion ; la transcription complète et le CR sont produits après l'arrêt, pas en direct.

## Déploiement Whisper sur le VPS

Le workflow de déploiement ajoute un service Docker privé sur le réseau de l'application :
- image CPU `onerahmet/openai-whisper-asr-webservice:v1.10.0` ;
- moteur `faster_whisper` ;
- modèle `base`, langue demandée `fr` ;
- cache persistant Docker `whisper-cache` ;
- API interne `http://whisper:9000/asr`, aucun port public exposé.

Le modèle est téléchargé au premier démarrage. Prévoir environ 2,5 Go pour l'image Docker et de l'espace disque supplémentaire pour le cache du modèle. Le modèle `base` est un compromis de ressources ; un modèle `small` peut améliorer la précision au prix d'une consommation mémoire et d'un temps de traitement supérieurs.

## Configuration

- `WHISPER_API_URL` : facultatif, défaut `http://whisper:9000/asr` ; ne doit pointer que vers un service Whisper de confiance.
- `GEMINI_API_KEY` : déjà utilisée par le serveur Clarity pour la génération du compte rendu et des mails. L'audio n'est pas envoyé à Gemini ; seul le texte transcrit et le contexte métier sont utilisés pour générer le CR.

## Sécurité et confidentialité

- Les routes de transcription et de génération exigent une session Clarity valide.
- Le service Whisper n'expose aucun port sur Internet ; il est joignable uniquement depuis le réseau Docker.
- Les fichiers audio ne sont pas enregistrés dans PostgreSQL ni conservés par Clarity après la requête.
- Les participants doivent être informés et les règles de l'entreprise relatives à l'enregistrement et aux données personnelles doivent être respectées.
- Le compte rendu reste modifiable et n'est jamais envoyé automatiquement.

## Limites connues

- La capture audio système de Teams Desktop dépend du navigateur, de Windows et du périphérique audio. Utiliser Edge/Chrome à jour et partager l'écran entier avec l'audio système activé.
- La capture du microphone local est demandée séparément ; si elle est refusée, la voix locale peut manquer.
- La transcription n'identifie pas automatiquement de façon fiable chaque intervenant. Les noms, responsables et échéances absents de la transcription doivent rester « À confirmer ».
- Les enregistrements très longs peuvent nécessiter davantage de mémoire et de temps CPU sur le VPS.
