/*

  Voici une analyse des fonctionnalités du Code :

    1-  Singleton Pattern : Utilisation du pattern Singleton pour garantir une instance unique du logger.
    2-  Logging multiplateforme : Fonctionne côté client et serveur.
    3-  Niveaux de log : Supporte info, warn, error, et debug.
    4-  Stockage local : Sauvegarde et chargement des logs dans le localStorage côté client.
    5-  Limitation des logs : Limite le nombre de logs stockés.
    6-  Rotation des logs basée sur le temps : Supprime les logs plus anciens qu'un certain nombre de jours.
    7-  Metadata personnalisée : Permet d'ajouter des métadonnées aux logs.
    8-  Contexte client/serveur : Identifie si le log provient du client ou du serveur.
    9-  SessionId : Génère un identifiant de session unique pour chaque instance du logger.
    10- UserAgent : Capture l'user agent pour les logs côté client.
    11- Déduplication : Évite les doublons de logs basés sur une clé unique.
    12- Capture du fichier et de la ligne : Identifie le fichier et la ligne d'où provient le log.
    13- Listeners : Permet d'ajouter des écouteurs pour réagir aux changements de logs.
    14- Hook React : Fournit un hook useLogger pour une utilisation facile dans les composants React.
    15- Filtrage des logs : Permet de filtrer les logs selon des critères spécifiques.
    16- Configuration dynamique : Permet de modifier le nombre max de logs et la durée de rétention.
    17- Reactualisation des logs.
*/







/*

import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  fileName: string;
  lineNumber: number;
  message: string;
  details?: any;
  key?: string;
  context: 'client' | 'server';
  sessionId: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

class UniversalLogger
{


  private static instance: UniversalLogger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 100;
  private maxAgeInDays: number = 7;
  private storageKey: string = 'Universal_Logger';
  private listeners: Set<() => void> = new Set();
  private isServer: boolean;
  private sessionId: string;

  private constructor() {
    this.isServer = typeof window === 'undefined';
    this.sessionId = this.generateSessionId();
    if (!this.isServer) {
      this.loadLogsFromStorage();
      this.cleanupOldLogs();
    }
  }

  public static getInstance(): UniversalLogger {
    if (!UniversalLogger.instance) {
      UniversalLogger.instance = new UniversalLogger();
    }
    return UniversalLogger.instance;
  }

  private generateSessionId(): string {
    return uuidv4();
  }

  public info(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('info', message, details, metadata);
  }

  public warn(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('warn', message, details, metadata);
  }

  public error(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('error', message, details, metadata);
  }

  public debug(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('debug', message, details, metadata);
  }



  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): void {
    const key = `${level}_${message}_${JSON.stringify(details)}`;
    const existingLog = this.logs.find(log => log.key === key);
    if (!existingLog)
    {
      const fileName = this.getCallerFile();
      const logEntry: LogEntry = {
        id: this.logs.length + 1,
        timestamp: new Date().toISOString(),
        level,
        fileName,
        lineNumber: this.getLineNumber(),
        message,
        details,
        key,
        context: this.isServer ? 'server' : 'client',
        sessionId: this.sessionId,
        userAgent: this.isServer ? undefined : navigator.userAgent,
        metadata
      };

      this.logs.push(logEntry);
      this.saveLogsToStorage();
      this.limitLogs();
      this.notifyListeners();

      if (this.isServer) {
        console.log(`[${level.toUpperCase()}] ${message}`, details);
      }
    }
  }


  private getCallerFile(): string
  {
    const err = new Error();
    if (err.stack) {
      const stackLines = err.stack.split('\n');
      const callerLine = stackLines[3];
      const match = callerLine.match(/(?:at\s+)?(.+?):\d+:\d+/);
      if (match) {
        return match[1].split('/').pop() ?? 'unknown';
      }
    }
    return 'unknown';
  }


  private getLineNumber(): number
  {
    const err = new Error();
    const stack = err.stack;
    if (stack) {
      const stackLines = stack.split('\n');
      const callerLine = stackLines[3];
      const match = callerLine.match(/:(\d+):\d+/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }


  private loadLogsFromStorage(): void {
    if (!this.isServer) {
      const storedLogs = localStorage.getItem(this.storageKey);
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    }
  }


  private saveLogsToStorage(): void {
    if (!this.isServer) {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    }
  }


  private limitLogs(): void {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(this.logs.length - this.maxLogs);
      this.saveLogsToStorage();
    }
  }


  private cleanupOldLogs(): void {
    const now = new Date();
    this.logs = this.logs.filter(log => {
      const logDate = new Date(log.timestamp);
      const diffTime = Math.abs(now.getTime() - logDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= this.maxAgeInDays;
    });
    this.saveLogsToStorage();
  }


  public getLogs(): LogEntry[] {
    return this.logs;
  }

  
  public clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
    this.notifyListeners();
  }


  public setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
  }


  public setMaxAgeInDays(maxAgeInDays: number): void {
    this.maxAgeInDays = maxAgeInDays;
    this.cleanupOldLogs();
  }


  public addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  public filterLogs(criteria: Partial<LogEntry>): LogEntry[] {
    return this.logs.filter(log => 
      Object.entries(criteria).every(([key, value]) => 
        log[key as keyof LogEntry] === value
      )
    );
  }
}

export const logger = UniversalLogger.getInstance();


export function useLogger(): [LogEntry[], () => void, () => void, (criteria: Partial<LogEntry>) => LogEntry[]] 
{
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const removeListener = logger.addListener(() => forceUpdate({}));
    return () => removeListener();
  }, []);

  const refreshLogs = useCallback(() => 
  {     // Fonction pour recharger les logs

    logger.getLogs();

    const updatedLogs = logger.getLogs(); // Remplacez par votre logique pour recharger les logs
    setLogs(updatedLogs);
  }, []);

  return [
    logs,
    () => logger.clearLogs(),
    refreshLogs,
    (criteria: Partial<LogEntry>) => logger.filterLogs(criteria)
  ];
}

export type { LogEntry };

*/
























































import { v4 as uuidv4 } from 'uuid';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  fileName: string;
  lineNumber: number;
  message: string;
  details?: any;
  key?: string;
  context: 'client' | 'server';
  sessionId: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

class UniversalLogger {
  private static instance: UniversalLogger;
  private logs: LogEntry[] = [];
  private maxLogs: number = 100;
  private maxAgeInDays: number = 7;
  private storageKey: string = 'Universal_Logger';
  private listeners: Set<() => void> = new Set();
  private isServer: boolean;
  private sessionId: string;

  private constructor() {
    this.isServer = typeof window === 'undefined';
    this.sessionId = this.generateSessionId();
    if (!this.isServer) {
      this.loadLogsFromStorage();
      this.cleanupOldLogs();
    }
  }

  public static getInstance(): UniversalLogger {
    if (!UniversalLogger.instance) {
      UniversalLogger.instance = new UniversalLogger();
    }
    return UniversalLogger.instance;
  }

  private generateSessionId(): string {
    return uuidv4();
  }

  public info(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('info', message, details, metadata);
  }

  public warn(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('warn', message, details, metadata);
  }

  public error(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('error', message, details, metadata);
  }

  public debug(message: string, details?: any, metadata?: Record<string, any>): void {
    this.log('debug', message, details, metadata);
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): void {
    const key = `${level}_${message}_${JSON.stringify(details)}`;
    const existingLog = this.logs.find(log => log.key === key);
    if (!existingLog) {
      const fileName = this.getCallerFile();
      const logEntry: LogEntry = {
        id: this.logs.length + 1,
        timestamp: new Date().toISOString(),
        level,
        fileName,
        lineNumber: this.getLineNumber(),
        message,
        details,
        key,
        context: this.isServer ? 'server' : 'client',
        sessionId: this.sessionId,
        userAgent: this.isServer ? undefined : typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        metadata
      };
      this.logs.push(logEntry);
      this.saveLogsToStorage();
      this.limitLogs();
      this.notifyListeners();
      if (this.isServer) {
        console.log(`[${level.toUpperCase()}] ${message}`, details);
      }
    }
  }

  private getCallerFile(): string {
    const err = new Error();
    if (err.stack) {
      const stackLines = err.stack.split('\n');
      const callerLine = stackLines[3];
      const match = callerLine.match(/(?:at\s+)?(.+?):\d+:\d+/);
      if (match) {
        return match[1].split('/').pop() ?? 'unknown';
      }
    }
    return 'unknown';
  }

  private getLineNumber(): number {
    const err = new Error();
    const stack = err.stack;
    if (stack) {
      const stackLines = stack.split('\n');
      const callerLine = stackLines[3];
      const match = callerLine.match(/:(\d+):\d+/);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  private loadLogsFromStorage(): void {
    if (!this.isServer && typeof localStorage !== 'undefined') {
      const storedLogs = localStorage.getItem(this.storageKey);
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    }
  }

  private saveLogsToStorage(): void {
    if (!this.isServer && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, JSON.stringify(this.logs));
    }
  }

  private limitLogs(): void {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(this.logs.length - this.maxLogs);
      this.saveLogsToStorage();
    }
  }

  private cleanupOldLogs(): void {
    const now = new Date();
    this.logs = this.logs.filter(log => {
      const logDate = new Date(log.timestamp);
      const diffTime = Math.abs(now.getTime() - logDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= this.maxAgeInDays;
    });
    this.saveLogsToStorage();
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
    this.notifyListeners();
  }

  public setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
  }

  public setMaxAgeInDays(maxAgeInDays: number): void {
    this.maxAgeInDays = maxAgeInDays;
    this.cleanupOldLogs();
  }

  public addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  public filterLogs(criteria: Partial<LogEntry>): LogEntry[] {
    return this.logs.filter(log => 
      Object.entries(criteria).every(([key, value]) => 
        log[key as keyof LogEntry] === value
      )
    );
  }
}

export const logger = UniversalLogger.getInstance();






















/*  EXAMPLES ET CAS D'UTILISATION



    Ces exemples montrent différentes façons d'utiliser le logger dans divers scénarios :

    Log simple : Juste un message.
    Log avec détails : Message + objet de détails.
    Log d'erreur : Capture d'une exception avec stack trace.
    Log de débogage : Message + détails + métadonnées.
    Log avec contexte : Information sur une action spécifique.
    Log de performance : Mesure du temps d'exécution.
    Log d'interaction utilisateur : Capture d'un événement UI.
    Log d'opération de base de données : Détails sur une requête.
    Log système : Information sur une mise à jour.
    Log de sécurité : Alerte sur une tentative d'accès non autorisé.



    Dans chaque exemple, vous pouvez voir comment le logger est utilisé avec différentes combinaisons de messages, détails et métadonnées. La structure générale est :

     - logger.[niveau]('message', { détails }, { métadonnées });

      - Le niveau peut être info, warn, error, ou debug.
      - Le message est une chaîne de caractères décrivant l'événement.
      - Les détails sont un objet contenant des informations spécifiques à l'événement.
      - Les métadonnées sont un objet optionnel contenant des informations contextuelles supplémentaires.









      // Exemple 1 : Log d'information simple
      logger.info('Utilisateur connecté');

      // Exemple 2 : Log d'avertissement avec détails
      logger.warn('Tentative de connexion échouée', { username: 'john_doe', attempts: 3 });

      // Exemple 3 : Log d'erreur avec stack trace
      try {
        throw new Error('Erreur inattendue');
      } catch (error) {
        logger.error('Une erreur est survenue', { error: error.message, stack: error.stack });
      }

      // Exemple 4 : Log de débogage avec métadonnées
      logger.debug('Début du processus de paiement', { orderID: '12345' }, { userID: 'user_789', paymentMethod: 'carte' });

      // Exemple 5 : Log d'information avec contexte spécifique
      logger.info('Nouvelle commande créée',
        { orderDetails: { id: 'order_123', total: 99.99 } },
        { customerSegment: 'premium', source: 'mobile_app' }
      );

      // Exemple 6 : Log de performance
      const startTime = performance.now();
      // ... code à mesurer ...
      const endTime = performance.now();
      logger.info('Performance de la fonction',
        { executionTime: endTime - startTime },
        { functionName: 'processData', dataSize: '1MB' }
      );

      // Exemple 7 : Log d'un événement utilisateur
      logger.info('Clic sur le bouton d\'achat',
        { buttonID: 'buy-now-123' },
        { pageURL: window.location.href, timestamp: new Date().toISOString() }
      );

      // Exemple 8 : Log d'une opération de base de données
      logger.debug('Requête à la base de données',
        { query: 'SELECT * FROM users WHERE active = true', resultCount: 150 },
        { dbName: 'userDB', queryTime: '50ms' }
      );

      // Exemple 9 : Log d'une action du système
      logger.info('Mise à jour du système effectuée',
        { version: '2.1.0', updateComponents: ['core', 'ui', 'api'] },
        { adminUser: 'system_admin', updateDuration: '5m 30s' }
      );

      // Exemple 10 : Log d'un événement de sécurité
      logger.warn('Tentative d\'accès non autorisé détectée',
        { targetResource: '/admin/users', ipAddress: '192.168.1.100' },
        { securityLevel: 'high', actionTaken: 'ip_blocked' }
      );


*/