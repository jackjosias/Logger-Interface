import fs from 'fs/promises'; // Importe le module 'fs/promises' pour les opérations asynchrones sur le système de fichiers.
import path from 'path'; // Importe le module 'path' pour travailler avec les chemins de fichiers.
import { v4 as uuidv4 } from 'uuid'; // Importe la fonction 'uuidv4' du module 'uuid' pour générer des identifiants uniques.
import { ILogger, LogEntry } from '../clientLogger/clientLogger'; // Importe les interfaces 'ILogger' et 'LogEntry' du module 'clientLogger'.

// Interface définissant la structure d'une entrée de journal
interface LogEntry {
    id: number; // Identifiant unique de l'entrée de journal
    timestamp: string; // Horodatage de l'entrée de journal
    level: 'info' | 'warn' | 'error' | 'debug'; // Niveau de l'entrée de journal
    fileName: string; // Nom du fichier d'où provient l'entrée de journal
    lineNumber: number; // Numéro de ligne d'où provient l'entrée de journal
    message: string; // Message de l'entrée de journal
    details?: any; // Détails supplémentaires de l'entrée de journal
    key: string; // Clé unique pour l'entrée de journal
    context: string; // Contexte de l'entrée de journal
    sessionId: string; // ID de la session
    metadata?: Record<string, any>; // Métadonnées supplémentaires
    hash: string; // Hash de l'entrée de journal pour la déduplication
}

// Interface définissant les méthodes d'un logger
interface ILogger {
    log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    info(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    warn(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    error(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    debug(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    getLogs(): Promise<LogEntry[]>;
    clearLogs(): Promise<void>;
    addListener(listener: () => void): () => void;
    filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]>;
}


// Classe ServerLogger implémentant l'interface ILogger pour la gestion des journaux côté serveur.
class ServerLogger implements ILogger {
    private static instance: ServerLogger; // Instance unique de la classe ServerLogger (singleton).
    private sessionId: string; // ID de session unique pour regrouper les journaux.
    private logs: LogEntry[] = []; // Tableau contenant les entrées de journal.
    private maxLogs: number = 1000; // Nombre maximum d'entrées de journal à conserver.
    private maxAgeInDays: number = 7; // Durée maximale de conservation des journaux en jours.
    private listeners: Set<() => void> = new Set(); // Ensemble des écouteurs pour les changements dans les journaux.
    private logFilePath: string; // Chemin du fichier où sont stockés les journaux.
    private logIndexPath: string; // Chemin du fichier d'index des journaux.


    private constructor() {
        this.sessionId = this.generateSessionId(); // Génère un ID de session unique lors de la création de l'instance.
        this.logFilePath = path.join(process.cwd(), 'server-logs.json'); // Définit le chemin du fichier de journaux.
        this.logIndexPath = path.join(process.cwd(), 'server-logs-index.json'); // Définit le chemin du fichier d'index des journaux pour la déduplication.
        this.initServerStorage(); // Initialise le stockage des journaux.
        this.cleanupOldLogs();
    }

    public static getInstance(): ServerLogger { // Méthode statique pour obtenir l'instance unique de ServerLogger (singleton).
        if (!ServerLogger.instance) { // Si l'instance n'existe pas, la créer.
            ServerLogger.instance = new ServerLogger();
        }
        return ServerLogger.instance; // Retourne l'instance unique.
    }

    private generateSessionId(): string { // Génère un ID de session unique à l'aide de la bibliothèque 'uuid'.
        return uuidv4();
    }

    private async initServerStorage(): Promise<void> { // Initialise le stockage des journaux en créant les fichiers s'ils n'existent pas.
        try {
            await fs.access(this.logFilePath); // Vérifie si le fichier de journaux existe.
            await fs.access(this.logIndexPath); // Vérifie si le fichier d'index existe.

        } catch (error) {
            await fs.writeFile(this.logFilePath, '[]'); // Crée le fichier de journaux s'il n'existe pas.
            await fs.writeFile(this.logIndexPath, '{}'); // Crée le fichier d'index s'il n'existe pas.
        }

        await this.loadLogsFromFile(); // Charge les journaux depuis le fichier.
    }


    private async loadLogsFromFile(): Promise<void> { // Charge les journaux depuis le fichier de journaux.
        try {
            const data = await fs.readFile(this.logFilePath, 'utf8'); // Lit le contenu du fichier de journaux.
            this.logs = JSON.parse(data); // Parse le contenu JSON du fichier et le stocke dans le tableau 'logs'.
        } catch (error) {
            console.error('Erreur lors du chargement des journaux depuis le fichier :', error); // Affiche un message d'erreur en cas de problème.
            this.logs = []; // Réinitialise le tableau des journaux si une erreur se produit.
        }
    }

    public async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
        // Crée une nouvelle entrée de journal avec les informations fournies.
        const logEntry: LogEntry = {
            id: Date.now(), // ID unique basé sur le timestamp actuel.
            timestamp: new Date().toISOString(), // Horodatage de l'entrée.
            level, // Niveau de l'entrée (info, warn, error, debug).
            fileName: this.getCallerFile(), // Nom du fichier d'où provient l'entrée.
            lineNumber: this.getLineNumber(), // Numéro de ligne d'où provient l'entrée.
            message, // Message de l'entrée.
            details, // Détails supplémentaires (optionnel).
            key: `${level}_${message}_${JSON.stringify(details)}`, // Clé unique pour l'entrée.
            context: 'server', // Contexte de l'entrée (serveur).
            sessionId: this.sessionId, // ID de la session.
            metadata, // Métadonnées supplémentaires (optionnel).
            hash: this.generateLogHash(level, message, details, metadata), // Hash de l'entrée pour la déduplication.
        };

        // Vérifie si l'entrée de journal est un doublon
        if (await this.isDuplicateLog(logEntry)) {
            return; // Si c'est un doublon, ne pas l'enregistrer
        }


        this.logs.push(logEntry); // Ajoute la nouvelle entrée au tableau des journaux.
        await this.saveLogs(); // Enregistre les journaux dans le fichier.
        await this.limitLogs(); // Limite le nombre de journaux conservés.
        this.notifyListeners(); // Notifie les écouteurs des changements.

    }

    public async info(message: string, details?: any, metadata?: Record<string, any>): Promise<void> { // Enregistre une entrée de niveau 'info'.
        return this.log('info', message, details, metadata);
    }

    public async warn(message: string, details?: any, metadata?: Record<string, any>): Promise<void> { // Enregistre une entrée de niveau 'warn'.
        return this.log('warn', message, details, metadata);
    }

    public async error(message: string, details?: any, metadata?: Record<string, any>): Promise<void> { // Enregistre une entrée de niveau 'error'.
        return this.log('error', message, details, metadata);
    }


    public async debug(message: string, details?: any, metadata?: Record<string, any>): Promise<void> { // Enregistre une entrée de niveau 'debug'.
        return this.log('debug', message, details, metadata);
    }

    private async saveLogs(): Promise<void> {
        try {
            // Enregistre les journaux dans le fichier, formattés avec 2 espaces d'indentation
            await fs.writeFile(this.logFilePath, JSON.stringify(this.logs, null, 2));
            const logIndex = await this.getLogIndex();
            await fs.writeFile(this.logIndexPath, JSON.stringify(logIndex, null, 2));

        } catch (error) {
            console.error('Erreur lors de l\'enregistrement des journaux dans le fichier :', error);
        }
    }

    private getCallerFile(): string { // Récupère le nom du fichier appelant.
        const err = new Error(); // Crée une nouvelle erreur pour obtenir la pile d'appels.
        if (err.stack) { // Vérifie si la pile d'appels est disponible.
            const stackLines = err.stack.split('\n'); // Divise la pile d'appels en lignes.
            const callerLine = stackLines[3]; // Récupère la ligne de l'appelant (la troisième ligne de la pile).
            const match = callerLine.match(/(?:at\s+)?(.+?):\d+:\d+/); // Extrait le nom du fichier de la ligne de l'appelant.
            if (match) {
                return match[1].split('/').pop() ?? 'unknown'; // Retourne le nom du fichier ou 'unknown' si non trouvé.
            }
        }
        return 'unknown'; // Retourne 'unknown' si la pile d'appels n'est pas disponible.
    }

    private getLineNumber(): number { // Récupère le numéro de ligne de l'appelant.
        const err = new Error(); // Crée une nouvelle erreur pour obtenir la pile d'appels.
        const stack = err.stack; // Obtient la pile d'appels.
        if (stack) { // Vérifie si la pile d'appels est disponible.
            const stackLines = stack.split('\n'); // Divise la pile d'appels en lignes.
            const callerLine = stackLines[3]; // Récupère la ligne de l'appelant.
            const match = callerLine.match(/:(\d+):\d+/); // Extrait le numéro de ligne de la ligne de l'appelant.
            if (match) {
                return parseInt(match[1], 10); // Retourne le numéro de ligne ou 0 si non trouvé.
            }
        }
        return 0; // Retourne 0 si la pile d'appels n'est pas disponible.
    }

    public async getLogs(): Promise<LogEntry[]> { // Retourne tous les journaux.
        await this.loadLogsFromFile(); // Charge les journaux depuis le fichier.
        return this.logs; // Retourne le tableau des journaux.
    }

    public async clearLogs(): Promise<void> { // Efface tous les journaux.
        this.logs = []; // Vide le tableau des journaux.
        await this.saveLogs(); // Enregistre les journaux vides dans le fichier.
        this.notifyListeners(); // Notifie les écouteurs des changements.
    }

    public addListener(listener: () => void): () => void { // Ajoute un écouteur pour les changements dans les journaux.
        this.listeners.add(listener); // Ajoute l'écouteur à l'ensemble des écouteurs.
        return () => this.listeners.delete(listener); // Retourne une fonction pour supprimer l'écouteur.
    }


    private notifyListeners(): void { // Notifie tous les écouteurs des changements dans les journaux.
        this.listeners.forEach(listener => listener()); // Appelle chaque écouteur.
    }

    // Génère un hash unique pour une entrée de journal afin de détecter les doublons
    private generateLogHash(level: string, message: string, details?: any, metadata?: Record<string, any>): string {
        const content = `${level}:${message}:${JSON.stringify(details)}:${JSON.stringify(metadata)}`; // Concatène les informations de l'entrée
        let hash = 0; // Initialise le hash à 0
        for (let i = 0; i < content.length; i++) { // Boucle sur chaque caractère du contenu
            const char = content.charCodeAt(i); // Obtient le code ASCII du caractère
            hash = ((hash << 5) - hash) + char; // Applique une opération de hachage
            hash = hash & hash; // Conversion en entier 32 bits
        }
        return hash.toString(16); // Convertit le hash en une chaîne hexadécimale
    }

    // Vérifie si une entrée de journal est un doublon en utilisant son hash
    private async isDuplicateLog(log: LogEntry): Promise<boolean> {
        const logIndex = await this.getLogIndex(); // Récupère l'index des journaux
        return !!logIndex[log.hash]; // Retourne true si le hash existe déjà dans l'index, false sinon
    }


    private async getLogIndex(): Promise<Record<string, boolean>> { // Charge l'index des journaux depuis le fichier
        try {
            const data = await fs.readFile(this.logIndexPath, 'utf8'); // Lit le contenu du fichier d'index
            return JSON.parse(data); // Parse le contenu JSON et le retourne
        } catch (error) {
            console.error('Erreur lors du chargement de l\'index des journaux :', error); // Affiche un message d'erreur en cas de problème
            return {}; // Retourne un objet vide en cas d'erreur
        }
    }

    public async filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]> { // Filtre les journaux selon les critères spécifiés.
        await this.loadLogsFromFile(); // Charge les journaux depuis le fichier.
        return this.logs.filter(log =>
            Object.entries(criteria).every(([key, value]) => log[key as keyof LogEntry] === value) // Filtre les journaux en fonction des critères.
        );
    }


    private async limitLogs(): Promise<void> {
        if (this.logs.length > this.maxLogs) { // Vérifie si le nombre de journaux dépasse la limite.
            this.logs = this.logs.slice(this.logs.length - this.maxLogs); // Supprime les journaux les plus anciens si la limite est dépassée.
            await this.saveLogs(); // Enregistre les journaux dans le fichier.
        }
    }


    private async cleanupOldLogs(): Promise<void> { // Supprime les anciens journaux en fonction de maxAgeInDays
        const now = new Date(); // Date actuelle
        const oldestAllowedDate = new Date(now.getTime() - this.maxAgeInDays * 24 * 60 * 60 * 1000); // Calcule la date la plus ancienne autorisée
        this.logs = this.logs.filter(log => new Date(log.timestamp) > oldestAllowedDate); // Filtre les journaux pour ne conserver que ceux dont la date est supérieure à la date la plus ancienne autorisée
        await this.saveLogs(); // Enregistre les journaux mis à jour
    }
}



export { ServerLogger }; // Exporte la classe ServerLogger.
export type { LogEntry, ILogger }; // Exporte les interfaces LogEntry et ILogger.



/*

**Documentation du code et explications:**

Ce code implémente un système de journalisation côté serveur pour une application Next.js. Il utilise le patron de conception Singleton pour garantir qu'une seule instance du logger est utilisée dans toute l'application.  Les journaux sont stockés dans un fichier JSON et un index est maintenu pour éviter les doublons.


**Fonctionnement général :**

1. **Initialisation:**  Lors de la première utilisation, `ServerLogger.getInstance()` crée une instance du logger, génère un ID de session, définit les chemins des fichiers de journaux et charge les journaux existants.
2. **Enregistrement des journaux:** Les méthodes `log()`, `info()`, `warn()`, `error()` et `debug()` permettent d'enregistrer des messages de différents niveaux de gravité. Chaque entrée de journal contient des informations telles que l'horodatage, le niveau, le nom du fichier, le numéro de ligne, le message, les détails, etc.
3. **Déduplication:** Avant d'enregistrer un journal, le code vérifie s'il s'agit d'un doublon en utilisant un hash généré à partir du contenu du journal.
4. **Stockage:** Les journaux sont stockés dans un fichier JSON (`server-logs.json`). Un index des journaux est également maintenu dans un fichier séparé (`server-logs-index.json`) pour accélérer la détection des doublons.
5. **Limite et nettoyage:** Le nombre de journaux est limité à `maxLogs` (1000 par défaut) et les journaux plus anciens que `maxAgeInDays` (7 jours par défaut) sont supprimés.
6. **Notifications:**  Des écouteurs peuvent être ajoutés pour être notifiés des changements dans les journaux.

**Lacunes et améliorations possibles :**

* **Gestion des erreurs:**  Améliorer la gestion des erreurs lors des opérations de fichier (lecture, écriture).  Utiliser des blocs `try...catch` plus précis et gérer les erreurs de manière plus robuste.
* **Rotation des journaux:**  Implémenter un système de rotation des journaux pour éviter que le fichier de journaux ne devienne trop volumineux.
* **Configuration:** Permettre de configurer les paramètres tels que `maxLogs`, `maxAgeInDays` et le chemin des fichiers de journaux.
* **Tests unitaires:**  Ajouter des tests unitaires pour garantir le bon fonctionnement du logger.


**Pensées du développeur (Jack-Josias) :**

Le développeur a probablement cherché à créer un système de journalisation simple et efficace pour une application Next.js.  L'objectif était de faciliter le débogage et la surveillance de l'application en enregistrant les événements importants côté serveur.  L'utilisation du patron Singleton et le stockage dans un fichier JSON étaient probablement motivés par la simplicité et la facilité d'implémentation.  Cependant, le développeur n'a peut-être pas anticipé tous les cas d'utilisation et les besoins futurs, ce qui explique certaines lacunes dans la conception actuelle.



**Impact du code :**

**Positif:**

* Facilite le débogage et la surveillance de l'application.
* Fournit un historique des événements côté serveur.
* Permet de détecter les erreurs et les problèmes de performance.

**Négatif:**

* Peut impacter les performances si le volume de journaux est important.
* Le fichier de journaux peut devenir volumineux s'il n'est pas géré correctement.
* Risque de perte de données en cas de problème avec le fichier de journaux.

**Cas pratiques d'utilisation en 2024 :**

* **Débogage d'API:** Enregistrer les requêtes et les réponses des API pour identifier les erreurs et les problèmes de performance.
* **Surveillance des applications:** Collecter des données sur l'utilisation de l'application, telles que le nombre d'utilisateurs connectés, les pages visitées, etc.
* **Audit de sécurité:** Enregistrer les événements liés à la sécurité, tels que les tentatives de connexion échouées, les accès non autorisés, etc.
* **Analyse des données:**  Utiliser les journaux pour analyser le comportement des utilisateurs et identifier les tendances.
* **Détection des erreurs:** Enregistrer les erreurs et les exceptions pour faciliter le diagnostic et la résolution des problèmes.
* **Journalisation des transactions:** Enregistrer les détails des transactions pour assurer la traçabilité et la conformité.



**Tutoriel sur Clean Architecture et Next.js (pour débutants):**

Ce code utilise certains principes de Clean Architecture, notamment la séparation des préoccupations. Le logger est une entité indépendante qui peut être utilisée par différentes parties de l'application sans dépendre de détails d'implémentation spécifiques.

Next.js est un framework React pour le développement d'applications web. Il offre des fonctionnalités telles que le rendu côté serveur, le routage et l'optimisation des performances.

Ce code s'intègre dans Next.js en fournissant un moyen de journaliser les événements côté serveur.  Il peut être utilisé dans les fonctions API, les middlewares, etc.

**Bonnes pratiques Next.js:**

* Utiliser les API Routes pour créer des API.
* Utiliser `getServerSideProps` ou `getStaticProps` pour récupérer les données côté serveur.
* Optimiser les images pour améliorer les performances.
* Utiliser un système de gestion d'état comme Redux ou Zustand.


*/



