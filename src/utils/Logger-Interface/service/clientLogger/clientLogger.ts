import { openDB, DBSchema, IDBPDatabase } from "idb";
import { v4 as uuidv4 } from "uuid";
import StackTrace from "stacktrace-js";

interface LoggerDB extends DBSchema {
  logs: {
    key: number;
    value: LogEntry;
    indexes: {
      "by-timestamp": string;
      "by-key": string;
      "by-hash": string;
    };
  };
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  fileName: string;
  lineNumber: number;
  message: string;
  details?: any;
  key?: string;
  context: "client" | "server";
  sessionId: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  hash: string;
}

export interface ILogger {
  log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void>;
  info(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void>;
  warn(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void>;
  error(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void>;
  debug(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void>;
  getLogs(): Promise<LogEntry[]>;
  clearLogs(): Promise<void>;
  filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]>;
  addListener(listener: () => void): () => void;
}

class ClientLogger implements ILogger {
  private static instance: ClientLogger;
  private sessionId: string;
  private db: IDBPDatabase<LoggerDB> | null = null;
  private dbInitialized: boolean = false;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private maxAgeInDays: number = 7;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.sessionId = this.generateSessionId();
    if (typeof window !== "undefined") {
      this.initIndexedDB();
    }
  }

  public static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
  }

  private generateSessionId(): string {
    return uuidv4();
  }

  private async initIndexedDB(): Promise<void> {
    try {
      this.db = await openDB<LoggerDB>("UniversalLoggerDB", 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
          try {
            if (oldVersion < 1) {
              const store = db.createObjectStore("logs", {
                keyPath: "id",
                autoIncrement: true,
              });
              store.createIndex("by-timestamp", "timestamp");
              store.createIndex("by-key", "key");
            }
            if (oldVersion < 2) {
              const store = transaction.objectStore("logs");
              if (!store.indexNames.contains("by-hash")) {
                store.createIndex("by-hash", "hash", { unique: true });
              }
            }
          } catch (error) {
            console.error(
              "Erreur lors de la mise à jour de la base de données :",
              error
            );
          }
        },
      });
      this.dbInitialized = true;
      await this.loadLogsFromStorage();
      await this.cleanupOldLogs();
    } catch (error) {
      console.error("Erreur lors de l'initialisation d'IndexedDB :", error);
      this.dbInitialized = false;
    }
  }

  public async log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logEntry: LogEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      level,
      fileName: this.getCallerFile(),
      lineNumber: this.getLineNumber(),
      message,
      details,
      key: `${level}_${message}_${JSON.stringify(details)}`,
      context: "client",
      sessionId: this.sessionId,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      metadata,
      hash: this.generateLogHash(level, message, details, metadata),
    };

    if (await this.isDuplicateLog(logEntry)) {
      return;
    }

    await this.saveLogToIndexedDB(logEntry);
    this.logs.push(logEntry);
    await this.limitLogs();
    this.notifyListeners();
  }

  public async info(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log("info", message, details, metadata);
  }

  public async warn(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log("warn", message, details, metadata);
  }

  public async error(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log("error", message, details, metadata);
  }

  public async debug(
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log("debug", message, details, metadata);
  }

  public async getLogs(): Promise<LogEntry[]> {
    const clientLogs = await this.getClientLogs();
    const serverLogs = await this.getServerLogs();
    const allLogs: LogEntry[] = [];
    clientLogs.forEach((log) => allLogs.push({ ...log, context: "client" }));
    serverLogs.forEach((log) => allLogs.push({ ...log, context: "server" }));
    allLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return allLogs;
  }

  private async getClientLogs(): Promise<LogEntry[]> {
    if (this.db && this.dbInitialized) {
      try {
        return await this.db.getAll("logs");
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des logs depuis IndexedDB :",
          error
        );
        return this.logs;
      }
    }
    return this.logs;
  }

  private async getServerLogs(): Promise<LogEntry[]> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_LOGGER_API_URL}`
      );
      if (!response.ok) {
        console.error(
          "Erreur lors de la récupération des logs du serveur:",
          response.status
        );
      }
      return await response.json();
    } catch (error) {
      return [];
    }
  }

  private async clearServerAllLogs(): Promise<void> {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_LOGGER_API_URL}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        console.error(
          "Échec de la suppression des logs du serveur:",
          response.status
        );
      }
      const result = await response.json();
      console.log(result.message);
    } catch (error) {
      console.error(
        "Erreur lors de la suppression des logs du serveur:",
        error
      );
    }
  }

  private async saveLogToIndexedDB(logEntry: LogEntry): Promise<void> {
    if (this.db && this.dbInitialized) {
      try {
        await this.db.add("logs", logEntry);
      } catch (error) {
        if (error instanceof DOMException && error.name === "ConstraintError") {
          console.warn("Entrée de log dupliquée détectée, ignorée :", logEntry);
        } else {
          console.error(
            "Erreur lors de l'enregistrement du log dans IndexedDB :",
            error
          );
          this.logs.push(logEntry);
        }
      }
    } else {
      this.logs.push(logEntry);
    }
  }

  private getCallerFile(): string {
    const err = new Error();
    if (err.stack) {
      const stackLines = err.stack.split("\n");
      const callerLine = stackLines[3];
      const match = callerLine.match(/(?:at\s+)?(.+?):\d+:\d+/);
      if (match) {
        return match[1].split("/").pop() ?? "unknown";
      }
    }
    return "unknown";
  }

  private getLineNumber(): number {
    const err = new Error();
    const stack = err.stack;
    if (stack) {
      const stackLines = stack.split("\n");
      const callerLine = stackLines[3];
      const match = callerLine.match(/:(\d+):\d+/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  private async loadLogsFromStorage(): Promise<void> {
    if (this.db && this.dbInitialized) {
      try {
        this.logs = await this.db.getAll("logs");
      } catch (error) {
        console.error(
          "Erreur lors du chargement des logs depuis IndexedDB :",
          error
        );
      }
    }
  }

  private async limitLogs(): Promise<void> {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(this.logs.length - this.maxLogs);
      if (this.db && this.dbInitialized) {
        try {
          const tx = this.db.transaction("logs", "readwrite");
          const store = tx.objectStore("logs");
          const keys = await store.getAllKeys();
          for (let i = 0; i < keys.length - this.maxLogs; i++) {
            await store.delete(keys[i]);
          }
          await tx.done;
        } catch (error) {
          console.error(
            "Erreur lors de la limitation des logs dans IndexedDB :",
            error
          );
        }
      }
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const now = new Date();
    const oldestAllowedDate = new Date(
      now.getTime() - this.maxAgeInDays * 24 * 60 * 60 * 1000
    );
    this.logs = this.logs.filter(
      (log) => new Date(log.timestamp) > oldestAllowedDate
    );
    if (this.db && this.dbInitialized) {
      try {
        const tx = this.db.transaction("logs", "readwrite");
        const store = tx.objectStore("logs");
        const index = store.index("by-timestamp");
        const range = IDBKeyRange.upperBound(oldestAllowedDate.toISOString());
        let cursor = await index.openCursor(range);
        while (cursor) {
          await cursor.delete();
          cursor = await cursor.continue();
        }
        await tx.done;
      } catch (error) {
        console.error(
          "Erreur lors du nettoyage des anciens logs dans IndexedDB :",
          error
        );
      }
    }
  }

  public async clearLogs(): Promise<void> {
    if (this.db && this.dbInitialized) {
      try {
        await this.db.clear("logs");
        await this.clearServerAllLogs();
      } catch (error) {
        console.error(
          "Erreur lors de la suppression des logs depuis IndexedDB :",
          error
        );
      }
    }
    this.logs = [];
    this.notifyListeners();
  }

  public addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  private generateLogHash(
    level: string,
    message: string,
    details?: any,
    metadata?: Record<string, any>
  ): string {
    const content = `${level}:${message}:${JSON.stringify(
      details
    )}:${JSON.stringify(metadata)}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private async isDuplicateLog(log: LogEntry): Promise<boolean> {
    if (this.db && this.dbInitialized) {
      try {
        const existingLog = await this.db.getFromIndex(
          "logs",
          "by-hash",
          log.hash
        );
        return !!existingLog;
      } catch (error) {
        console.error(
          "Erreur lors de la vérification des logs dupliqués :",
          error
        );
        return false;
      }
    }
    return this.logs.some((existingLog) => existingLog.hash === log.hash);
  }

  public async filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]> {
    const allLogs = await this.getLogs();
    return allLogs.filter((log) =>
      Object.entries(criteria).every(
        ([key, value]) => log[key as keyof LogEntry] === value
      )
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
