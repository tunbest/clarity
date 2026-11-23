import { ProductionRelease } from '../types';

export const INITIAL_PRODUCTION_RELEASES: ProductionRelease[] = [
  {
    id: 'rel-1',
    projectId: 'proj-apollo-1',
    projectName: 'Portail Client Digital v4',
    rfcCode: 'RFC-2026-088',
    title: 'Mise en Prod Passerelle Paiement Instantané & 3D-Secure v2',
    studyTeamName: 'Équipe Études Monétique & API',
    versionTag: 'v4.2.0-rc2',
    deliveryDateByEtude: '2026-10-24',
    scheduledWindowDate: '2026-11-02T22:00:00',
    maintenanceWindowDurationMinutes: 120,
    environment: 'PROD',
    status: 'CAB_APPROVED',
    cabApproved: true,
    cabMeetingDate: '2026-10-27',
    rollbackPlanTested: true,
    sqlMigrationScriptsIncluded: true,
    dockerImageTag: 'registry.corp/apollo/payment-gateway:4.2.0-prod',
    impactedUsersCount: 45000,
    releaseNotes: 'Package certifié PCI-DSS livré par l’équipe Études Monétique. Comprend les scripts DDL PostgreSQL et les nouveaux connecteurs bancaires.',

    // DSND / SCT Methodology & Governance
    gireJiraId: 'GIRE-4921',
    dailyCnpChgId: 'CHG-2026-8812',
    cpeName: 'Julien Delorme (CPE DSND)',
    cppName: 'Karim Belkacem (CPP SCT YN)',
    demandeur: 'Direction Métier Monétique & Paiements Digitaux',
    currentPhase: 'DEPLOYMENT',

    rfcDetails: {
      objectif: 'Déploiement en production du socle de paiement instantané DSP2 / 3D-Secure v2 pour supporter les pics de trafic e-commerce du Black Friday.',
      perimetre: 'Cluster Kubernetes Prod, Base de Données PostgreSQL Prod (schéma paiement), Passerelle d’API WAF F5 BIG-IP, Connecteurs banques partenaires.',
      importance: 'CRITIQUE',
      justification: 'Obligation réglementaire bancaire et sécurisation anti-fraude avec réduction du taux d’échec des transactions à moins de 0.05%.',
      dateMiseEnOeuvreSouhaitee: '2026-11-02T22:00:00',
      dailyCnpStatus: 'APPROUVE',
    },

    sctDomains: [
      {
        id: 'sct-1',
        domain: 'Cloud AWS/Azure',
        leadName: 'Jérôme B. (Lead Cloud YN)',
        allocatedResource: 'Sarah Alami (Ingénieur Cloud SCT)',
        status: 'LIVRE',
        taskDescription: 'Provisioning des instances Kubernetes Worker Nodes et ingress ALB sécurisé avec certificats dédiés.',
        workloadDays: 4.5,
      },
      {
        id: 'sct-2',
        domain: 'Base de Données PostgreSQL',
        leadName: 'Claire M. (Lead BDD YN)',
        allocatedResource: 'Yannick Mercier (DBA SCT)',
        status: 'LIVRE',
        taskDescription: 'Validation des index partitionnés, plan de backup pré-migration et qualification du rollback DDL.',
        workloadDays: 3.0,
      },
      {
        id: 'sct-3',
        domain: 'Réseau & F5/DNS',
        leadName: 'Fabrice D. (Lead Réseau YN)',
        allocatedResource: 'Benoît Roux (Ingénieur Réseau SCT)',
        status: 'LIVRE',
        taskDescription: 'Ouverture des flux MTLS interbancaires vers SWIFT et routage F5 Load Balancer avec bascule blue/green.',
        workloadDays: 2.0,
      },
      {
        id: 'sct-4',
        domain: 'Sécurité & IAM',
        leadName: 'Hélène P. (Lead Sécurité YN)',
        allocatedResource: 'Alexandre Roy (SecOps SCT)',
        status: 'LIVRE',
        taskDescription: 'Revue de conformité PCI-DSS 4.0, durcissement des clés KMS et rotation des secrets Vault.',
        workloadDays: 2.5,
      },
    ],

    exploitabilityRequirements: [
      {
        id: 'req-1',
        category: 'Supervision & Métriques',
        title: 'Tableau de bord Dynatrace & Alertes PagerDuty H24 opérationnels avec seuils d’erreurs 5xx < 0.1%',
        satisfied: true,
        verificationMethod: 'Test d’injection d’anomalie en pré-prod validé par le CPP et astreinte SCT',
      },
      {
        id: 'req-2',
        category: 'Sauvegarde & Restauration',
        title: 'Snapshot PostgreSQL froid & WAL shipping actif avec RTO < 15 min et RPO < 1 min',
        satisfied: true,
        verificationMethod: 'Restauration testée avec succès sur sandbox SCT avant la fenêtre de tir',
      },
      {
        id: 'req-3',
        category: 'Résilience & PRA',
        title: 'Procédure de Rollback N-1 documentée et scriptée en moins de 10 minutes sans perte de données',
        satisfied: true,
        verificationMethod: 'Tir à blanc de rollback exécuté sur l’environnement de VSR (Validation de Service Régulier)',
      },
      {
        id: 'req-4',
        category: 'Sécurité & Durcissement',
        title: 'Scan de vulnérabilités Trivy image conteneur 0 CVE critique / high',
        satisfied: true,
        verificationMethod: 'Rapport Harbor / SonarQube certifié conforme par le Lead Sécurité YN',
      },
    ],

    bdi: {
      id: 'bdi-1',
      reference: 'BDI-SCT-2026-0412',
      date: '2026-10-25',
      status: 'SIGNE',
      description: 'Bordereau de Demande d’Intervention technique validé par le CPE Julien Delorme et contresigné par le CPP Karim Belkacem.',
    },

    bdc: {
      id: 'bdc-1',
      reference: 'BDC-SCT-2026-0412',
      status: 'EN_ATTENTE',
      pvObservation: 'En attente de réalisation de la fenêtre de tir du 02/11/2026.',
    },

    rapportsFlash: [
      {
        id: 'rf-1',
        date: '2026-10-28',
        meteo: 'VERT',
        highlights: 'Validation CAB accordée à l’unanimité. Accord Études/Prod scellé sur les pré-requis exploitabilité. Créneau 22h00 confirmé.',
        nextMilestone: 'Ouverture de la salle virtuelle de MEP le 02/11 à 21h45 avec les astreintes Cloud, BDD et Réseau.',
        author: 'Karim Belkacem (CPP SCT)',
      },
      {
        id: 'rf-2',
        date: '2026-10-24',
        meteo: 'VERT',
        highlights: 'Réception du package d’études v4.2.0-rc2 et des scripts SQL. Début des contrôles d’exploitabilité SCT.',
        nextMilestone: 'Instance de passage en revue de faisabilité CPE/CPP du 26/10.',
        author: 'Karim Belkacem (CPP SCT)',
      },
    ],

    comptesRendus: [
      {
        id: 'cr-1',
        date: '2026-10-26',
        title: 'CR Instance Synchronisation CPE / CPP - Revue d’Exploitabilité',
        participants: ['Julien Delorme (CPE DSND)', 'Karim Belkacem (CPP SCT YN)', 'Yannick Mercier (DBA SCT)', 'Sarah Alami (Cloud SCT)'],
        decisions: [
          'Validation conjointe du runbook d’exploitation en 7 étapes séquentielles.',
          'Durée de coupure arrêtée à 120 minutes max entre 22h00 et 00h00.',
          'Accord sur le passage en Surveillance Rapprochée (PSC) H+48 suite au déploiement.',
        ],
      },
    ],

    transitionPostMep: {
      mode: 'PSC',
      startDate: '2026-11-03',
      endDate: '2026-11-10',
      incidentsCount: 0,
      rexClotureDone: false,
      observationsMco: 'Prise en charge de la surveillance rapprochée (PSC) par l’équipe d’astreinte SCT niveau 2/3.',
    },

    runbookSteps: [
      {
        id: 'step-1-1',
        stepNumber: 1,
        title: 'Vérification météo système & Snapshot de la base de données PostgreSQL',
        responsible: 'DBA Prod (Yannick)',
        estimatedMinutes: 15,
        completed: true,
      },
      {
        id: 'step-1-2',
        stepNumber: 2,
        title: 'Activation de la page de maintenance / drain du trafic via Reverse Proxy Nginx',
        responsible: 'CP Production (Karim)',
        estimatedMinutes: 10,
        completed: true,
      },
      {
        id: 'step-1-3',
        stepNumber: 3,
        title: 'Exécution du script de migration SQL (schema_v4.2_payment.sql)',
        responsible: 'DBA Prod (Yannick)',
        estimatedMinutes: 20,
        completed: false,
      },
      {
        id: 'step-1-4',
        stepNumber: 4,
        title: 'Déploiement du conteneur Docker v4.2.0-prod & rolling update Kubernetes',
        responsible: 'DevOps Prod (Sarah)',
        estimatedMinutes: 25,
        completed: false,
      },
      {
        id: 'step-1-5',
        stepNumber: 5,
        title: 'Tirs de recette technique & Smoke tests automatisés (API Health + Auth)',
        responsible: 'Ingénieur QA Prod (Julien)',
        estimatedMinutes: 30,
        completed: false,
      },
      {
        id: 'step-1-6',
        stepNumber: 6,
        title: 'Désactivation du mode maintenance et réouverture du trafic client',
        responsible: 'CP Production (Karim)',
        estimatedMinutes: 10,
        completed: false,
      },
      {
        id: 'step-1-7',
        stepNumber: 7,
        title: 'Supervision post-MEP H+2 (Dynatrace / Logs d’erreurs / Métriques 5xx)',
        responsible: 'Astreinte Prod SCT',
        estimatedMinutes: 10,
        completed: false,
      },
    ],
    rollbackSteps: [
      {
        id: 'rb-1',
        title: 'Bascule DNS immédiate vers le cluster Blue précédent (v4.1.9)',
        commandOrAction: 'kubectl rollout undo deployment/payment-gateway-deployment -n production',
      },
      {
        id: 'rb-2',
        title: 'Restauration snapshot PostgreSQL pré-migration si corruption schéma',
        commandOrAction: 'psql -f /backup/pre_mep_20261102.dump',
      },
    ],
  },
  {
    id: 'rel-2',
    projectId: 'proj-titanerp',
    projectName: 'Migration ERP SAP S/4HANA',
    rfcCode: 'RFC-2026-092',
    title: 'Batch de Synchronisation des Stocks & Connecteur Logistique',
    studyTeamName: 'Équipe Études Supply Chain & Logistique',
    versionTag: 'v1.1.4-hotfix',
    deliveryDateByEtude: '2026-10-27',
    scheduledWindowDate: '2026-11-05T01:00:00',
    maintenanceWindowDurationMinutes: 60,
    environment: 'PROD',
    status: 'DELIVERED_BY_ETUDE',
    cabApproved: false,
    cabMeetingDate: '2026-10-30',
    rollbackPlanTested: true,
    sqlMigrationScriptsIncluded: false,
    dockerImageTag: 'registry.corp/titan/stock-sync:1.1.4',
    impactedUsersCount: 1200,
    releaseNotes: 'Correctif d’optimisation mémoire sur le calcul de réapprovisionnement automatique des entrepôts.',

    gireJiraId: 'GIRE-3890',
    dailyCnpChgId: 'CHG-2026-9043',
    cpeName: 'Sophie Martin (CPE DSND)',
    cppName: 'Karim Belkacem (CPP SCT YN)',
    demandeur: 'Direction des Opérations Logistiques & Chaîne d’Approvisionnement',
    currentPhase: 'VALIDATION',

    rfcDetails: {
      objectif: 'Résolution des goulots d’étranglement I/O sur les flux de synchronisation des stocks SAP avec WMS.',
      perimetre: 'Serveurs batch Linux CentOS / Kubernetes CronJobs, Files RabbitMQ de distribution.',
      importance: 'MAJEURE',
      justification: 'Éviter les ruptures de stock non signalées aux 180 points de vente régionaux.',
      dateMiseEnOeuvreSouhaitee: '2026-11-05T01:00:00',
      dailyCnpStatus: 'SOUMIS_CAB',
    },

    sctDomains: [
      {
        id: 'sct-2-1',
        domain: 'Système Linux/Windows',
        leadName: 'Thierry V. (Lead Système YN)',
        allocatedResource: 'Thomas Bernard (Ingénieur Système SCT)',
        status: 'AFFECTE',
        taskDescription: 'Vérification du dimensionnement CPU/RAM des conteneurs batch et des quotas cgroups.',
        workloadDays: 1.5,
      },
      {
        id: 'sct-2-2',
        domain: 'Middleware & Kafka',
        leadName: 'Aurélie G. (Lead Middleware YN)',
        allocatedResource: 'Damien Leclerc (Ingénieur Middleware SCT)',
        status: 'SOLLICITE',
        taskDescription: 'Revue des buffers RabbitMQ et dimensionnement de la Dead Letter Queue.',
        workloadDays: 2.0,
      },
    ],

    exploitabilityRequirements: [
      {
        id: 'req-2-1',
        category: 'Supervision & Métriques',
        title: 'Métriques d’occupation des files RabbitMQ et alertes de latence batch sous Centreon/Grafana',
        satisfied: true,
        verificationMethod: 'Dashboard Grafana opérationnel avec sondes de santé',
      },
      {
        id: 'req-2-2',
        category: 'Résilience & PRA',
        title: 'Plan de reprise automatique des jobs après crash sans double écriture en base',
        satisfied: false,
        verificationMethod: 'Test d’idempotence en cours de qualification par l’équipe Études',
      },
    ],

    bdi: {
      id: 'bdi-2',
      reference: 'BDI-SCT-2026-0428',
      date: '2026-10-27',
      status: 'EN_ATTENTE',
      description: 'En attente de validation CAB du 30/10 avant confirmation formelle.',
    },

    bdc: {
      id: 'bdc-2',
      reference: 'BDC-SCT-2026-0428',
      status: 'EN_ATTENTE',
      pvObservation: 'Intervention non encore démarrée.',
    },

    rapportsFlash: [
      {
        id: 'rf-2-1',
        date: '2026-10-28',
        meteo: 'ORANGE',
        highlights: 'Dossier livré par le CPE Sophie Martin. Passage CAB prévu le 30/10. Réserve mineure sur l’idempotence du batch.',
        nextMilestone: 'Clôture de la qualification d’idempotence avant réunion CAB.',
        author: 'Karim Belkacem (CPP SCT)',
      },
    ],

    comptesRendus: [
      {
        id: 'cr-2-1',
        date: '2026-10-27',
        title: 'CR Cadrage Déploiement Batch SAP - CPE Sophie Martin & CPP Karim Belkacem',
        participants: ['Sophie Martin (CPE DSND)', 'Karim Belkacem (CPP SCT YN)', 'Damien Leclerc (Middleware SCT)'],
        decisions: [
          'Sélection de la fenêtre de tir nocturne du 05/11 à 01h00 (période de creux logistique).',
          'Demande d’ajustement des paramètres de retry RabbitMQ auprès des études.',
        ],
      },
    ],

    transitionPostMep: {
      mode: 'PSS',
      startDate: '2026-11-06',
      endDate: '2026-11-20',
      incidentsCount: 0,
      rexClotureDone: false,
      observationsMco: 'Période de Stabilisation / Support (PSS) planifiée sur 14 jours.',
    },

    runbookSteps: [
      {
        id: 'step-2-1',
        stepNumber: 1,
        title: 'Suspension du planificateur de batch (Airflow crons)',
        responsible: 'CP Production (Karim)',
        estimatedMinutes: 5,
        completed: false,
      },
      {
        id: 'step-2-2',
        stepNumber: 2,
        title: 'Mise à jour des images de conteneurs de traitement batch',
        responsible: 'DevOps Prod (Sarah)',
        estimatedMinutes: 15,
        completed: false,
      },
      {
        id: 'step-2-3',
        stepNumber: 3,
        title: 'Exécution d’un job test sur lot témoin (100 références)',
        responsible: 'Validation Études Métier',
        estimatedMinutes: 20,
        completed: false,
      },
      {
        id: 'step-2-4',
        stepNumber: 4,
        title: 'Réactivation du cron et surveillance des files de messages RabbitMQ',
        responsible: 'Astreinte Prod SCT',
        estimatedMinutes: 20,
        completed: false,
      },
    ],
    rollbackSteps: [
      {
        id: 'rb-2-1',
        title: 'Retour à l’image v1.1.3 et purge des messages en Dead Letter Queue',
        commandOrAction: 'helm rollback titan-stock-sync 3',
      },
    ],
  },
  {
    id: 'rel-3',
    projectId: 'proj-apollo-1',
    projectName: 'Portail Client Digital v4',
    rfcCode: 'RFC-2026-081',
    title: 'Correctif Sécurité OpenSSL & Durcissement TLS 1.3',
    studyTeamName: 'Équipe Études Sécurité & Socle Infra',
    versionTag: 'v4.1.9-p1',
    deliveryDateByEtude: '2026-10-18',
    scheduledWindowDate: '2026-10-22T23:00:00',
    maintenanceWindowDurationMinutes: 30,
    environment: 'PROD',
    status: 'DEPLOYED_PROD',
    cabApproved: true,
    cabMeetingDate: '2026-10-20',
    rollbackPlanTested: true,
    sqlMigrationScriptsIncluded: false,
    dockerImageTag: 'registry.corp/apollo/ingress-proxy:tls13',
    impactedUsersCount: 60000,
    releaseNotes: 'Déploiement en production réussi sans interruption de service (Zero-downtime rolling update).',

    gireJiraId: 'GIRE-5012',
    dailyCnpChgId: 'CHG-2026-8109',
    cpeName: 'Marc Vidal (CPE DSND)',
    cppName: 'Karim Belkacem (CPP SCT YN)',
    demandeur: 'Direction des Risques & de la Cybersécurité Groupe',
    currentPhase: 'CLOTURE',

    rfcDetails: {
      objectif: 'Élimination des vulnérabilités CVE OpenSSL et renforcement du chiffrement vers TLS 1.3 exclusif.',
      perimetre: 'Reverse proxies Nginx Ingress, Répartiteurs de charge F5 BIG-IP, Certificats wildcard SSL.',
      importance: 'MAJEURE',
      justification: 'Audit de sécurité ANSSI et maintien de la note A+ sur Qualys SSL Labs.',
      dateMiseEnOeuvreSouhaitee: '2026-10-22T23:00:00',
      dailyCnpStatus: 'CLOS',
    },

    sctDomains: [
      {
        id: 'sct-3-1',
        domain: 'Sécurité & IAM',
        leadName: 'Hélène P. (Lead Sécurité YN)',
        allocatedResource: 'Alexandre Roy (SecOps SCT)',
        status: 'LIVRE',
        taskDescription: 'Validation du chiffrement TLS 1.3 et révocation des anciennes suites cryptographiques faibles.',
        workloadDays: 1.0,
      },
      {
        id: 'sct-3-2',
        domain: 'Réseau & F5/DNS',
        leadName: 'Fabrice D. (Lead Réseau YN)',
        allocatedResource: 'Benoît Roux (Ingénieur Réseau SCT)',
        status: 'LIVRE',
        taskDescription: 'Mise à jour des profils SSL client et serveurs sur F5 BIG-IP.',
        workloadDays: 1.0,
      },
    ],

    exploitabilityRequirements: [
      {
        id: 'req-3-1',
        category: 'Sécurité & Durcissement',
        title: 'Contrôle SSL Labs A+ et handshake TLS 1.3 validé sur tous les endpoints publics',
        satisfied: true,
        verificationMethod: 'Test automatisé Qualys SSL Labs avec rapport sans réserve',
      },
    ],

    bdi: {
      id: 'bdi-3',
      reference: 'BDI-SCT-2026-0390',
      date: '2026-10-20',
      status: 'SIGNE',
      description: 'Intervention autorisée en mode Zero-Downtime.',
    },

    bdc: {
      id: 'bdc-3',
      reference: 'BDC-SCT-2026-0390',
      date: '2026-10-23',
      status: 'CLOS_SANS_RESERVE',
      pvObservation: 'Intervention achevée sans aucune déconnexion utilisateur. Bilan REX et transfert MCO validé.',
    },

    rapportsFlash: [
      {
        id: 'rf-3-1',
        date: '2026-10-23',
        meteo: 'VERT',
        highlights: 'Déploiement en production réalisé avec succès à 23h25. Zéro incident détecté. Note A+ confirmée.',
        nextMilestone: 'Clôture du dossier JIRA Production GIRE-5012 et transfert définitif au MCO.',
        author: 'Karim Belkacem (CPP SCT)',
      },
    ],

    comptesRendus: [
      {
        id: 'cr-3-1',
        date: '2026-10-24',
        title: 'CR Clôture & Bilan REX - Déploiement TLS 1.3',
        participants: ['Marc Vidal (CPE DSND)', 'Karim Belkacem (CPP SCT YN)', 'Hélène P. (Sécurité YN)'],
        decisions: [
          'Clôture du changement DailyCNP CHG-2026-8109 sans réserve.',
          'Transfert complet de l’exploitation courante vers l’équipe MCO Socle.',
          'Archivage de la GIRE de référence dans JIRA Production.',
        ],
      },
    ],

    transitionPostMep: {
      mode: 'TRANSFERE_MCO',
      startDate: '2026-10-23',
      endDate: '2026-10-25',
      incidentsCount: 0,
      rexClotureDone: true,
      observationsMco: 'Projet clôturé et basculé en maintien en conditions opérationnelles (MCO).',
    },

    runbookSteps: [
      {
        id: 'step-3-1',
        stepNumber: 1,
        title: 'Mise à jour des certificats et conf cipher suites',
        responsible: 'Ingénieur Sécu Prod SCT',
        estimatedMinutes: 10,
        completed: true,
      },
      {
        id: 'step-3-2',
        stepNumber: 2,
        title: 'Reload sans perte de connexion (Graceful Nginx reload)',
        responsible: 'CP Production (Karim)',
        estimatedMinutes: 5,
        completed: true,
      },
      {
        id: 'step-3-3',
        stepNumber: 3,
        title: 'Contrôle SSL Labs A+ et handshake check',
        responsible: 'Sécu Prod SCT',
        estimatedMinutes: 15,
        completed: true,
      },
    ],
    rollbackSteps: [
      {
        id: 'rb-3-1',
        title: 'Restauration ancienne conf TLS',
        commandOrAction: 'cp /etc/nginx/conf.d.bak/* /etc/nginx/conf.d/ && nginx -s reload',
      },
    ],
  },
  {
    id: 'rel-4',
    projectId: 'proj-apollo-1',
    projectName: 'Portail Client Digital v4',
    rfcCode: 'RFC-2026-105',
    title: 'Connecteur Webhook Partenaires Logistique (FedEx / Chronopost)',
    studyTeamName: 'Équipe Études Interfaces & EAI',
    versionTag: 'v4.3.0-b1',
    deliveryDateByEtude: '2026-10-28',
    scheduledWindowDate: '2026-11-08T03:00:00',
    maintenanceWindowDurationMinutes: 45,
    environment: 'PROD',
    status: 'DELIVERED_BY_ETUDE',
    cabApproved: false,
    cabMeetingDate: '2026-11-03',
    rollbackPlanTested: false,
    sqlMigrationScriptsIncluded: true,
    dockerImageTag: 'registry.corp/apollo/webhooks:4.3.0',
    impactedUsersCount: 8500,
    releaseNotes: 'Livraison toute fraîche de l’équipe Études Interfaces. En attente de qualification du plan de rollback et passage en CAB.',

    gireJiraId: 'GIRE-5240',
    dailyCnpChgId: 'CHG-2026-9214',
    cpeName: 'Julien Delorme (CPE DSND)',
    cppName: 'Karim Belkacem (CPP SCT YN)',
    demandeur: 'Direction E-Commerce & Suivi Colis',
    currentPhase: 'CONSTRUCTION',

    rfcDetails: {
      objectif: 'Intégration temps réel des statuts de livraison transporteurs par webhooks asynchrones sécurisés.',
      perimetre: 'Service Ingress API Gateway, Microservice Webhooks Receiver, Table PostgreSQL des événements.',
      importance: 'MINEURE',
      justification: 'Amélioration de l’expérience client avec notification SMS en quasi temps réel.',
      dateMiseEnOeuvreSouhaitee: '2026-11-08T03:00:00',
      dailyCnpStatus: 'BROUILLON',
    },

    sctDomains: [
      {
        id: 'sct-4-1',
        domain: 'Cloud AWS/Azure',
        leadName: 'Jérôme B. (Lead Cloud YN)',
        allocatedResource: 'Sarah Alami (Ingénieur Cloud SCT)',
        status: 'SOLLICITE',
        taskDescription: 'Création des routes ingress et limitation de débit (rate limiting) anti-DDOS.',
        workloadDays: 2.0,
      },
      {
        id: 'sct-4-2',
        domain: 'Base de Données PostgreSQL',
        leadName: 'Claire M. (Lead BDD YN)',
        allocatedResource: 'Yannick Mercier (DBA SCT)',
        status: 'SOLLICITE',
        taskDescription: 'Validation des tables de partitionnement journalier des événements webhooks.',
        workloadDays: 1.5,
      },
    ],

    exploitabilityRequirements: [
      {
        id: 'req-4-1',
        category: 'Supervision & Métriques',
        title: 'Monitoring du taux de réessais HTTP 429 et 504 sur les endpoints transporteurs',
        satisfied: false,
        verificationMethod: 'À instrumenter dans Dynatrace par le CPE et le CPP',
      },
      {
        id: 'req-4-2',
        category: 'Résilience & PRA',
        title: 'Plan de Rollback qualifié en environnement de VSR',
        satisfied: false,
        verificationMethod: 'Test de non-régression prévu le 31/10',
      },
    ],

    bdi: {
      id: 'bdi-4',
      reference: 'BDI-SCT-2026-0441',
      date: '2026-10-28',
      status: 'A_EMETTRE',
      description: 'Bordereau en cours de rédaction par le CPP en attente de la fin de recette.',
    },

    bdc: {
      id: 'bdc-4',
      reference: 'BDC-SCT-2026-0441',
      status: 'EN_ATTENTE',
      pvObservation: 'Intervention non encore démarrée.',
    },

    rapportsFlash: [
      {
        id: 'rf-4-1',
        date: '2026-10-28',
        meteo: 'ROUGE',
        highlights: 'Plan de rollback non encore testé. Déploiement suspendu tant que la qualification n’est pas validée.',
        nextMilestone: 'Instance de recette VSR le 31/10 avec le CPE Julien Delorme.',
        author: 'Karim Belkacem (CPP SCT)',
      },
    ],

    comptesRendus: [
      {
        id: 'cr-4-1',
        date: '2026-10-28',
        title: 'CR Réception Package & Examen Pré-requis - CPE Julien Delorme & CPP Karim Belkacem',
        participants: ['Julien Delorme (CPE DSND)', 'Karim Belkacem (CPP SCT YN)'],
        decisions: [
          'Blocage temporaire de l’inscription au CAB tant que le test de rollback n’est pas exécuté.',
          'Sollicitation du Lead BDD YN pour la vérification des scripts de partitionnement SQL.',
        ],
      },
    ],

    transitionPostMep: {
      mode: 'PSC',
      startDate: '2026-11-09',
      endDate: '2026-11-16',
      incidentsCount: 0,
      rexClotureDone: false,
      observationsMco: 'Surveillance rapprochée post-déploiement standard.',
    },

    runbookSteps: [
      {
        id: 'step-4-1',
        stepNumber: 1,
        title: 'Création des tables partitionnées pour les logs de webhooks',
        responsible: 'DBA Prod SCT',
        estimatedMinutes: 15,
        completed: false,
      },
      {
        id: 'step-4-2',
        stepNumber: 2,
        title: 'Déploiement du microservice récepteur d’événements',
        responsible: 'DevOps Prod SCT',
        estimatedMinutes: 15,
        completed: false,
      },
      {
        id: 'step-4-3',
        stepNumber: 3,
        title: 'Vérification de l’authentification par HMAC signature',
        responsible: 'QA Prod SCT',
        estimatedMinutes: 15,
        completed: false,
      },
    ],
    rollbackSteps: [
      {
        id: 'rb-4-1',
        title: 'Désactivation des endpoints webhooks au niveau du WAF',
        commandOrAction: 'waf-cli disable-rule rule-webhooks-ingress',
      },
    ],
  },
];
