

























import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ILogger, LogEntry } from '../clientLogger/clientLogger';

class ServerLogger implements ILogger {
  private static instance: ServerLogger;
  private sessionId: string;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private maxAgeInDays: number = 7;
  private listeners: Set<() => void> = new Set();
  private logFilePath: string;
  private logIndexPath: string;
  private writeQueue: Promise<void> = Promise.resolve();
  private initialized: boolean = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.logFilePath = path.join(process.cwd(), 'server-logs.json');
    this.logIndexPath = path.join(process.cwd(), 'server-logs-index.json');
  }

  public static getInstance(): ServerLogger {
    if (!ServerLogger.instance) {
      ServerLogger.instance = new ServerLogger();
    }
    return ServerLogger.instance;
  }

  private generateSessionId(): string {
    return uuidv4();
  }

  private async initServerStorage(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.access(this.logFilePath);
      await fs.access(this.logIndexPath);
    } catch (error) {
      await fs.writeFile(this.logFilePath, '[]');
      await fs.writeFile(this.logIndexPath, '{}');
    }
    await this.loadLogsFromFile();
    await this.cleanupOldLogs();
    this.initialized = true;
  }

  private async loadLogsFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.logFilePath, 'utf8');
      this.logs = JSON.parse(data);
    } catch (error) {
      console.error('Erreur lors du chargement des journaux depuis le fichier :', error);
      this.logs = [];
    }
  }

  public async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    await this.initServerStorage();
    const logEntry: LogEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      level,
      fileName: this.getCallerFile(),
      lineNumber: this.getLineNumber(),
      message,
      details,
      key: `${level}_${message}_${JSON.stringify(details)}`,
      context: 'server',
      sessionId: this.sessionId,
      metadata,
      hash: this.generateLogHash(level, message, details, metadata),
    };

    if (await this.isDuplicateLog(logEntry)) {
      return;
    }

    this.logs.push(logEntry);
    await this.enqueueSaveLogs();
    await this.limitLogs();
    this.notifyListeners();
  }

  public async info(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    return this.log('info', message, details, metadata);
  }

  public async warn(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    return this.log('warn', message, details, metadata);
  }

  public async error(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    return this.log('error', message, details, metadata);
  }

  public async debug(message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    return this.log('debug', message, details, metadata);
  }

  private async enqueueSaveLogs(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fs.writeFile(this.logFilePath, JSON.stringify(this.logs, null, 2));
        const logIndex = await this.getLogIndex();
        await fs.writeFile(this.logIndexPath, JSON.stringify(logIndex, null, 2));
      } catch (error) {
        console.error('Erreur lors de l\'enregistrement des journaux dans le fichier :', error);
      }
    });
    await this.writeQueue;
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



  public async getLogs(): Promise<LogEntry[]> {
    await this.initServerStorage();
    return this.logs;
  }

  public async clearLogs(): Promise<void> {
    this.logs = [];
    await this.enqueueSaveLogs();
    this.notifyListeners();
  }

  public addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  private generateLogHash(level: string, message: string, details?: any, metadata?: Record<string, any>): string {
    const content = `${level}:${message}:${JSON.stringify(details)}:${JSON.stringify(metadata)}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private async isDuplicateLog(log: LogEntry): Promise<boolean> {
    const logIndex = await this.getLogIndex();
    return !!logIndex[log.hash];
  }

  private async getLogIndex(): Promise<Record<string, boolean>> {
    try {
      const data = await fs.readFile(this.logIndexPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'index des journaux :', error);
      return {};
    }
  }

  public async filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]> {
    await this.initServerStorage();
    return this.logs.filter(log => 
      Object.entries(criteria).every(([key, value]) => 
        log[key as keyof LogEntry] === value
      )
    );
  }

  private async limitLogs(): Promise<void> {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(this.logs.length - this.maxLogs);
      await this.enqueueSaveLogs();
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const now = new Date();
    const oldestAllowedDate = new Date(now.getTime() - this.maxAgeInDays * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => new Date(log.timestamp) > oldestAllowedDate);
    await this.enqueueSaveLogs();
  }

  public configure(options: { maxLogs?: number; maxAgeInDays?: number }): void {
    if (options.maxLogs !== undefined) this.maxLogs = options.maxLogs;
    if (options.maxAgeInDays !== undefined) this.maxAgeInDays = options.maxAgeInDays;
  }

  public async rotateLogs(): Promise<void> {
    const now = new Date();
    const backupFileName = `server-logs-${now.toISOString().replace(/:/g, '-')}.json`;
    const backupPath = path.join(process.cwd(), backupFileName);
    await fs.copyFile(this.logFilePath, backupPath);
    await this.clearLogs();
  }
}

export { ServerLogger };
export type { LogEntry, ILogger };










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



