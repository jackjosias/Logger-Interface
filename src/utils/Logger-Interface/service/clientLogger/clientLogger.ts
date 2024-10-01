import { openDB, DBSchema, IDBPDatabase } from 'idb'; // Importe les fonctions nécessaires de la bibliothèque 'idb' pour gérer la base de données IndexedDB.
import { v4 as uuidv4 } from 'uuid'; // Importe la fonction uuidv4 pour générer des identifiants uniques.

// Interface définissant le schéma de la base de données IndexedDB.
interface LoggerDB extends DBSchema {
    logs: { // Nom du magasin d'objets pour les logs.
        key: number; // Clé primaire pour chaque entrée de log.
        value: LogEntry; // Type de valeur pour chaque entrée de log.
        indexes: { // Définition des index pour optimiser les recherches.
            'by-timestamp': string; // Index par timestamp (date et heure).
            'by-key': string; // Index par clé unique.
            'by-hash': string;  // Index par hash unique pour éviter les doublons.
        };
    };
}

// Interface définissant la structure d'une entrée de log.
interface LogEntry {
    id: number; // Identifiant unique auto-incrémenté.
    timestamp: string; // Date et heure du log au format ISO 8601.
    level: 'info' | 'warn' | 'error' | 'debug'; // Niveau de gravité du log.
    fileName: string; // Nom du fichier source du log.
    lineNumber: number; // Numéro de ligne du log dans le fichier source.
    message: string; // Message du log.
    details?: any; // Détails supplémentaires optionnels.
    key?: string;  // Clé unique pour faciliter la recherche et filtrer des entrées spécifiques.
    context: 'client' | 'server'; // Contexte du log (client ou serveur).
    sessionId: string; // Identifiant de session utilisateur.
    userAgent?: string; // Agent utilisateur (navigateur web).
    metadata?: Record<string, any>; // Métadonnées supplémentaires optionnelles.
    hash: string; // Hash unique du log pour éviter les doublons
}

// Interface définissant les méthodes du logger.
export interface ILogger {
    log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    info(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    warn(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    error(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    debug(message: string, details?: any, metadata?: Record<string, any>): Promise<void>;
    getLogs(): Promise<LogEntry[]>;
    clearLogs(): Promise<void>;
    filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]>;
    addListener(listener: () => void): () => void;
}

// Classe implémentant le logger côté client.
class ClientLogger implements ILogger {
    private static instance: ClientLogger; // Instance unique du logger (singleton).
    private sessionId: string; // Identifiant de session.
    private db: IDBPDatabase<LoggerDB> | null = null; // Instance de la base de données IndexedDB.
    private dbInitialized: boolean = false; // Indicateur d'initialisation de la base de données.
    private logs: LogEntry[] = []; // Tableau des logs en mémoire.
    private maxLogs: number = 1000; // Nombre maximum de logs à conserver.
    private maxAgeInDays: number = 7; // Durée maximale de conservation des logs en jours.
    private listeners: Set<() => void> = new Set(); // Ensemble des écouteurs d'événements.

    private constructor() {
        this.sessionId = this.generateSessionId(); // Génère un identifiant de session unique.
        if (typeof window !== 'undefined') { // Vérifie si le code s'exécute dans un environnement navigateur.
            this.initIndexedDB(); // Initialise la base de données IndexedDB.
        }
    }

    // Méthode statique pour obtenir l'instance unique du logger (singleton).
    public static getInstance(): ClientLogger {
        if (!ClientLogger.instance) {
            ClientLogger.instance = new ClientLogger();
        }
        return ClientLogger.instance;
    }

    // Génère un identifiant de session unique.
    private generateSessionId(): string {
        return uuidv4();
    }

    // Initialise la base de données IndexedDB.
    private async initIndexedDB(): Promise<void> {
        try {
            this.db = await openDB<LoggerDB>('UniversalLoggerDB', 2, { // Ouvre ou crée la base de données 'UniversalLoggerDB' en version 2.
                upgrade(db, oldVersion, newVersion, transaction) { // Fonction appelée lors d'une mise à jour de version de la base de données.
                    if (oldVersion < 1) { // Si la version précédente est inférieure à 1.
                        const store = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true }); // Crée le magasin d'objets 'logs' avec une clé primaire auto-incrémentée 'id'.
                        store.createIndex('by-timestamp', 'timestamp'); // Crée un index 'by-timestamp' sur le champ 'timestamp'.
                        store.createIndex('by-key', 'key'); // Crée un index 'by-key' sur le champ 'key'.
                    }
                    if (oldVersion < 2) { // Si la version précédente est inférieure à 2.
                        const store = transaction.objectStore('logs'); // Récupère le magasin d'objets 'logs'.
                        store.createIndex('by-hash', 'hash', { unique: true });  // Ajoute un index unique 'by-hash' pour le champ 'hash'
                    }
                },
            });
            this.dbInitialized = true; // Marque la base de données comme initialisée.
            await this.loadLogsFromStorage(); // Charge les logs depuis la base de données.
            await this.cleanupOldLogs();  // Supprime les anciens logs.

        } catch (error) {
            console.error('Erreur lors de l\'initialisation d\'IndexedDB :', error);
            this.dbInitialized = false; // Marque la base de données comme non initialisée en cas d'erreur.
        }
    }

    // Enregistre un log.
    public async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
        const logEntry: LogEntry = {  // Crée un objet LogEntry.
            id: Date.now(), // Utilise le timestamp actuel comme ID.
            timestamp: new Date().toISOString(),  // Date et heure du log.
            level,  // Niveau du log.
            fileName: this.getCallerFile(), // Nom du fichier source.
            lineNumber: this.getLineNumber(), // Numéro de ligne.
            message, // Message du log.
            details, // Détails optionnels.
            key: `${level}_${message}_${JSON.stringify(details)}`, // Clé de recherche unique.
            context: 'client', // Contexte du log (client).
            sessionId: this.sessionId, // ID de session.
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined, // Agent utilisateur (si disponible).
            metadata, // Métadonnées optionnelles.
            hash: this.generateLogHash(level, message, details, metadata), // Hash unique pour éviter la duplication.
        };


        if (await this.isDuplicateLog(logEntry)) { // Vérifie si le log est un doublon.
            return; // Si c'est un doublon, on ne l'enregistre pas.
        }

        await this.saveLogToIndexedDB(logEntry); // Enregistre le log dans IndexedDB.
        this.logs.push(logEntry); // Ajoute le log au tableau en mémoire.
        await this.limitLogs(); // Limite le nombre de logs en mémoire et dans IndexedDB.
        this.notifyListeners(); // Notifie les écouteurs d'événements.

    }

    // Enregistre un log d'information.
    public async info(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
        return this.log('info', message, details, metadata);
    }

    // Enregistre un log d'avertissement.
    public async warn(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
        return this.log('warn', message, details, metadata);
    }

    // Enregistre un log d'erreur.
    public async error(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
        return this.log('error', message, details, metadata);
    }

    // Enregistre un log de débogage.
    public async debug(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
        return this.log('debug', message, details, metadata);
    }


    // Récupère tous les logs (client et serveur).
    public async getLogs(): Promise<LogEntry[]> {
        const clientLogs = await this.getClientLogs(); // Récupère les logs client.
        const serverLogs = await this.getServerLogs(); // Récupère les logs serveur.

        // Fusionner les logs client et serveur dans un seul tableau en conservant les propriétés 'context' distinctes.
        const allLogs: LogEntry[] = [];
        clientLogs.forEach(log => allLogs.push({ ...log, context: 'client' }));
        serverLogs.forEach(log => allLogs.push({ ...log, context: 'server' }));


        // Trier les logs par timestamp (du plus récent au plus ancien).
        allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return allLogs;
    }


    // Récupère les logs client depuis IndexedDB ou la mémoire.
    private async getClientLogs(): Promise<LogEntry[]> {
        if (this.db && this.dbInitialized) { // Si la base de données est initialisée.
            try {
                return await this.db.getAll('logs'); // Récupère tous les logs de la base de données.
            } catch (error) {
                console.error('Erreur lors de la récupération des logs depuis IndexedDB :', error);
                return this.logs; // Retourne les logs en mémoire en cas d'erreur.
            }
        }
        return this.logs; // Retourne les logs en mémoire si la base de données n'est pas initialisée.
    }

    // Récupère les logs serveur depuis l'API.
    private async getServerLogs(): Promise<LogEntry[]> {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_LOGGER_API_URL}`); // Fait une requête à l'API pour récupérer les logs serveur.
            if (!response.ok) {
                // Gérer les erreurs de requête ici si nécessaire, par exemple :
                // throw new Error('Erreur lors de la récupération des logs serveur');
                console.error('Erreur lors de la récupération des logs du serveur:', response.status);
            }
            return await response.json(); // Convertit la réponse JSON en un tableau de LogEntry.
        } catch (error) {
            // Gérer les erreurs de réseau ici si nécessaire, par exemple :
            // console.error('Erreur lors de la récupération des logs serveur :', error);
            return []; // Retourne un tableau vide en cas d'erreur.
        }
    }



    // Supprime tous les logs du serveur.
    private async clearServerAllLogs(): Promise<void> {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_LOGGER_API_URL}`, 
            { // Effectue une requête DELETE à l'API.
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                // Gérer les erreurs de requête ici. Par exemple :
                // throw new Error('Échec de la suppression des logs');
                console.error('Échec de la suppression des logs du serveur:', response.status);

            }
            const result = await response.json(); // Récupère la réponse JSON.
            console.log(result.message); // Affiche le message de confirmation (si présent).
        } catch (error) {
            // Gérer les erreurs réseau ici. Par exemple :
            // console.error('Erreur lors de la suppression des logs:', error);
            console.error('Erreur lors de la suppression des logs du serveur:', error);

        }
    }

    // Enregistre un log dans IndexedDB ou en mémoire.
    private async saveLogToIndexedDB(logEntry: LogEntry): Promise<void> {
        if (this.db && this.dbInitialized) { // Si la base de données est initialisée.
            try {

                await this.db.add('logs', logEntry); // Ajoute le log à la base de données.
            } catch (error) {
                if (error instanceof DOMException && error.name === 'ConstraintError') { // Gère les erreurs de contrainte (doublons).
                    console.warn('Entrée de log dupliquée détectée, ignorée :', logEntry);
                } else {
                    console.error('Erreur lors de l\'enregistrement du log dans IndexedDB :', error);
                    this.logs.push(logEntry); // Ajoute le log au tableau en mémoire en cas d'erreur.
                }
            }

        } else {
            this.logs.push(logEntry); // Ajoute le log au tableau en mémoire si la base de données n'est pas initialisée.
        }
    }

    // Récupère le nom du fichier source du log.
    private getCallerFile(): string {
        const err = new Error(); // Crée une nouvelle erreur pour capturer la pile d'appels.
        if (err.stack) { // Vérifie si la pile d'appels est disponible.
            const stackLines = err.stack.split('\n'); // Sépare la pile d'appels en lignes.
            const callerLine = stackLines[3]; // Récupère la ligne de l'appelant (3ème ligne, après l'erreur et getCallerFile).

            const match = callerLine.match(/(?:at\s+)?(.+?):\d+:\d+/);  // Extrait le nom du fichier et le numéro de ligne avec une expression régulière.
            if (match) {
                return match[1].split('/').pop() ?? 'unknown'; // Extrait le nom du fichier du chemin et retourne 'unknown' si non trouvé.

            }
        }
        return 'unknown'; // Retourne 'unknown' si la pile d'appels n'est pas disponible ou si le nom du fichier n'est pas trouvé.
    }

    // Récupère le numéro de ligne du log.
    private getLineNumber(): number {
        const err = new Error(); // Crée une nouvelle erreur pour capturer la pile d'appels.
        const stack = err.stack;  // Récupère la pile d'appels.
        if (stack) { // Vérifie si la pile d'appels est disponible.
            const stackLines = stack.split('\n'); // Sépare la pile d'appels en lignes.
            const callerLine = stackLines[3]; // Récupère la ligne de l'appelant.
            const match = callerLine.match(/:(\d+):\d+/); // Extrait le numéro de ligne avec une expression régulière.
            if (match) {
                return parseInt(match[1], 10); // Convertit le numéro de ligne en entier.
            }
        }
        return 0; // Retourne 0 si la pile d'appels n'est pas disponible ou si le numéro de ligne n'est pas trouvé.
    }


    // Charge les logs depuis IndexedDB.
    private async loadLogsFromStorage(): Promise<void> {

        if (this.db && this.dbInitialized) { // Si la base de données est initialisée.
            try {

                this.logs = await this.db.getAll('logs'); // Récupère tous les logs de la base de données.

            } catch (error) {

                console.error('Erreur lors du chargement des logs depuis IndexedDB :', error);
            }
        }
    }


    // Limite le nombre de logs en mémoire et dans IndexedDB.
    private async limitLogs(): Promise<void> {

        if (this.logs.length > this.maxLogs) { // Si le nombre de logs dépasse la limite.
            this.logs = this.logs.slice(this.logs.length - this.maxLogs); // Supprime les logs les plus anciens du tableau en mémoire.

            if (this.db && this.dbInitialized) { // Si la base de données est initialisée.
                try {

                    const tx = this.db.transaction('logs', 'readwrite'); // Crée une transaction en lecture/écriture.
                    const store = tx.objectStore('logs'); // Récupère le magasin d'objets 'logs'.
                    const keys = await store.getAllKeys(); // Récupère toutes les clés des logs.

                    for (let i = 0; i < keys.length - this.maxLogs; i++) { // Supprime les anciens logs de la base de données.

                        await store.delete(keys[i]);
                    }
                    await tx.done; // Attend la fin de la transaction.


                } catch (error) {
                    console.error('Erreur lors de la limitation des logs dans IndexedDB :', error);
                }
            }
        }
    }

    // Supprime les anciens logs de la mémoire et d'IndexedDB.
    private async cleanupOldLogs(): Promise<void> {
        const now = new Date(); // Date actuelle.
        const oldestAllowedDate = new Date(now.getTime() - this.maxAgeInDays * 24 * 60 * 60 * 1000); // Calcule la date la plus ancienne autorisée.

        this.logs = this.logs.filter(log => new Date(log.timestamp) > oldestAllowedDate);  // Filtre les logs en mémoire pour ne conserver que ceux qui ne sont pas trop anciens.

        if (this.db && this.dbInitialized) {  // Si la base de données est initialisée.
            try {
                const tx = this.db.transaction('logs', 'readwrite'); // Crée une transaction.
                const store = tx.objectStore('logs'); // Récupère le magasin d'objets.
                const index = store.index('by-timestamp'); // Utilise l'index 'by-timestamp' pour optimiser la recherche.
                const range = IDBKeyRange.upperBound(oldestAllowedDate.toISOString()); // Crée une plage de clés pour les logs plus anciens que la date limite.
                let cursor = await index.openCursor(range); // Ouvre un curseur sur l'index avec la plage de clés.


                while (cursor) {
                    await cursor.delete(); // Supprime le log actuel pointé par le curseur.
                    cursor = await cursor.continue(); // Passe au log suivant.

                }
                await tx.done; // Finalise la transaction.


            } catch (error) {
                console.error('Erreur lors du nettoyage des anciens logs dans IndexedDB :', error);

            }
        }
    }


    // Supprime tous les logs.
    public async clearLogs(): Promise<void> {

        if (this.db && this.dbInitialized) {  // Si la base de données est initialisée.
            try {

                await this.db.clear('logs'); // Supprime tous les logs de la base de données.
                await this.clearServerAllLogs(); // Supprime tous les logs du serveur.
            } catch (error) {
                console.error('Erreur lors de la suppression des logs depuis IndexedDB :', error);
            }
        }
        this.logs = []; // Vide le tableau des logs en mémoire.
        this.notifyListeners(); // Notifie les écouteurs d'événements.

    }

    // Ajoute un écouteur d'événements.
    public addListener(listener: () => void): () => void {
        this.listeners.add(listener); // Ajoute l'écouteur à l'ensemble des écouteurs.
        return () => this.listeners.delete(listener); // Retourne une fonction pour supprimer l'écouteur.
    }

    // Notifie tous les écouteurs d'événements.
    private notifyListeners(): void {

        this.listeners.forEach(listener => listener()); // Appelle chaque écouteur.

    }

    // Génère un hash unique pour un log.
    private generateLogHash(level: string, message: string, details?: any, metadata?: Record<string, any>): string {
        const content = `${level}:${message}:${JSON.stringify(details)}:${JSON.stringify(metadata)}`; // Concatène les informations du log.
        let hash = 0; // Initialise le hash à 0.
        for (let i = 0; i < content.length; i++) { // Parcourt chaque caractère du contenu.
            const char = content.charCodeAt(i); // Récupère le code Unicode du caractère.
            hash = ((hash << 5) - hash) + char; // Applique une opération de hachage.
            hash = hash & hash; // Convertit en entier 32 bits.
        }
        return hash.toString(16); // Convertit le hash en chaîne hexadécimale.
    }


    // Vérifie si un log est un doublon en comparant son hash avec les logs existants dans IndexedDB ou la mémoire.
    private async isDuplicateLog(log: LogEntry): Promise<boolean> {

        if (this.db && this.dbInitialized) { // Si IndexedDB est initialisé.
            try {

                const existingLog = await this.db.getFromIndex('logs', 'by-hash', log.hash);  // Recherche un log avec le même hash dans l'index 'by-hash'.
                return !!existingLog; // Retourne true si un log avec le même hash existe, false sinon.
            } catch (error) {

                console.error('Erreur lors de la vérification des logs dupliqués :', error);
                return false; // Retourne false en cas d'erreur.
            }
        }
        return this.logs.some(existingLog => existingLog.hash === log.hash); // Recherche un doublon dans le tableau `logs` en mémoire si IndexedDB n'est pas disponible.
    }

    // Filtrer les logs en fonction des critères spécifiés.
    public async filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]> {
        const allLogs = await this.getLogs(); // Récupère tous les logs.
        return allLogs.filter(log =>
            Object.entries(criteria).every(([key, value]) => log[key as keyof LogEntry] === value) // Filtre les logs en fonction des critères.
        );
    }

}



export { ClientLogger };
export type { LogEntry };











/*

  **Documentation du code et explications:**

  Ce code implémente un système de journalisation universel (client et serveur) pour une application Next.js. Il utilise IndexedDB pour stocker les logs côté client et une API pour les logs côté serveur.

  **Fonctionnement:**

  1. **Initialisation:**  Lors de l'initialisation, le `ClientLogger` crée une base de données IndexedDB nommée "UniversalLoggerDB" s'il n'en existe pas déjà. Il crée également un magasin d'objets "logs" avec des index pour optimiser les recherches par timestamp, clé et hash.

  2. **Enregistrement des logs:**  Les méthodes `log`, `info`, `warn`, `error` et `debug` permettent d'enregistrer des logs avec différents niveaux de gravité.  Chaque log est enregistré dans IndexedDB (si disponible) et dans un tableau en mémoire. Un hash unique est généré pour chaque log afin d'éviter les doublons.  Avant l'enregistrement d'un nouveau log, on vérifie s'il existe déjà via son hash. Si oui, on ne l'enregistre pas.

  3. **Récupération des logs:**  La méthode `getLogs` permet de récupérer tous les logs, en combinant les logs client (depuis IndexedDB) et les logs serveur (depuis l'API). Les logs sont triés par timestamp du plus récent au plus ancien.

  4. **Suppression des logs:**  La méthode `clearLogs` permet de supprimer tous les logs client (IndexedDB) et serveur (via une requête `DELETE` à l'API).

  5. **Limite et nettoyage des logs:**  Le code implémente une logique pour limiter le nombre de logs stockés (en mémoire et dans IndexedDB) via `maxLogs` et pour supprimer les logs plus anciens que `maxAgeInDays`. Ce nettoyage est effectué dans la méthode `cleanupOldLogs` lors de l'initialisation et dans la méthode `limitLogs` après chaque ajout de log.

  6. **Écouteurs d'événements:**  La méthode `addListener` permet d'ajouter des écouteurs qui seront notifiés à chaque fois qu'un log est ajouté.


  **Lacunes et améliorations possibles:**

  * **Gestion des erreurs côté serveur:**  Améliorer la gestion des erreurs lors des appels à l'API serveur, par exemple en affichant des messages d'erreur à l'utilisateur ou en implémentant une stratégie de nouvelle tentative.
  * **Sécurité:**  Si les logs contiennent des informations sensibles, il est important de sécuriser l'API serveur et la base de données IndexedDB.
  * **Compression des logs:**  Pour optimiser le stockage, il pourrait être intéressant de compresser les logs avant de les enregistrer dans IndexedDB.
  * **Interface utilisateur:**  Développer une interface utilisateur pour afficher et filtrer les logs côté client.


  **Pensées du développeur (Jack-Josias):**

  Le développeur a probablement voulu créer un système de journalisation robuste et performant, capable de gérer un grand volume de logs et de faciliter le débogage des applications Next.js. L'utilisation d'IndexedDB permet de stocker les logs côté client même hors ligne, tandis que l'API serveur permet de centraliser les logs et de les analyser plus facilement. L'accent a été mis sur la performance (index, limitation du nombre de logs) et l'évolutivité (architecture client/serveur).


  **Impact du code:**

  **Positif:**

  * **Débogage facilité:**  Les logs permettent de suivre l'exécution du code et d'identifier les erreurs plus facilement.
  * **Analyse des données:**  Les logs peuvent être utilisés pour analyser le comportement des utilisateurs et améliorer l'application.
  * **Surveillance:**  Les logs permettent de surveiller l'état de l'application et de détecter les problèmes en temps réel.

  **Négatif:**

  * **Performance:**  L'enregistrement des logs peut impacter les performances de l'application, surtout si le volume de logs est important.
  * **Stockage:**  Les logs peuvent occuper beaucoup d'espace disque.
  * **Sécurité:**  Si les logs contiennent des informations sensibles, ils peuvent représenter un risque de sécurité.



  **Cas d'utilisation en 2024:**

  * **Débogage d'applications web et mobiles:** Identifier les erreurs et les problèmes de performance.
  * **Analyse de l'utilisation des applications:**  Comprendre comment les utilisateurs interagissent avec l'application et identifier les points d'amélioration.
  * **Surveillance des serveurs et des infrastructures:**  Détecter les anomalies et les problèmes de performance.
  * **Sécurité:**  Enregistrer les événements de sécurité et les tentatives d'intrusion.
  * **Audits:**  Conserver un historique des actions effectuées dans l'application.
  * **Analyse des données marketing:**  Suivre les conversions et l'efficacité des campagnes marketing.
  * **Applications IoT:**  Collecter et analyser les données des objets connectés.


  **Clean Architecture et Next.js:**

  Ce code s'intègre dans une architecture clean en séparant la logique de journalisation du reste de l'application. Le `ClientLogger` peut être considéré comme une couche d'infrastructure indépendante. Dans Next.js, ce code peut être utilisé dans n'importe quel composant ou page. Il est recommandé d'utiliser l'instance unique du logger via `ClientLogger.getInstance()` pour éviter de créer plusieurs instances et de gaspiller des ressources.

  **Tutoriel Clean Architecture avec Next.js :**
  Ce code illustre des aspects importants de la Clean Architecture avec Next.js:
  - **Séparation des préoccupations :** Le code de journalisation est encapsulé dans une classe séparée (`ClientLogger`), respectant le principe de responsabilité unique.
  - **Abstraction :** L'interface `ILogger` définit un contrat pour la journalisation, permettant de changer d'implémentation sans affecter le reste du code.
  - **Indépendance de l'infrastructure :** L'utilisation d'IndexedDB est encapsulée dans `ClientLogger`, permettant de facilement changer de mécanisme de stockage si nécessaire.

  **Structure Next.js et bonnes pratiques :**
  - **Utilisation de dossiers :** Le code devrait idéalement résider dans un dossier dédié, comme `utils` ou `lib`, pour une meilleure organisation du projet.
  - **Typage TypeScript :** L'utilisation de TypeScript améliore la maintenabilité et la robustesse du code.
  - **Gestion des erreurs :** Le code inclut une gestion des erreurs de base, qui pourrait être améliorée avec des mécanismes plus avancés.


  **Exemple d'utilisation COTE (Client uniquement) :**

  ```typescript
    import { ClientLogger } from './votre-chemin/logger';

    const logger = ClientLogger.getInstance();

    logger.info('Application démarrée');

    try {
        // Votre code ici
    } catch (error) {
        logger.error('Une erreur est survenue', error);
    }
  ```

  J'espère que cette documentation détaillée et ces explications vous aideront à mieux comprendre le code et à l'utiliser efficacement. N'hésitez pas à me poser d'autres questions si besoin.

*/