import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

interface LoggerDB extends DBSchema {
  logs: {
    key: number;
    value: LogEntry;
    indexes: { 'by-timestamp': string; 'by-key': string; 'by-hash': string };
  };
}

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
  hash: string;
}

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
    if (typeof window !== 'undefined') {
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
      this.db = await openDB<LoggerDB>('UniversalLoggerDB', 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
          if (oldVersion < 1) {
            const store = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
            store.createIndex('by-timestamp', 'timestamp');
            store.createIndex('by-key', 'key');
          }
          if (oldVersion < 2) {
            const store = transaction.objectStore('logs');
            store.createIndex('by-hash', 'hash', { unique: true });
          }
        },
      });
      this.dbInitialized = true;
      await this.loadLogsFromStorage();
      await this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      this.dbInitialized = false;
    }
  }

  public async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, details?: any, metadata?: Record<string, any>): Promise<void> {
    const logEntry: LogEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      level,
      fileName: this.getCallerFile(),
      lineNumber: this.getLineNumber(),
      message,
      details,
      key: `${level}_${message}_${JSON.stringify(details)}`,
      context: 'client',
      sessionId: this.sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
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

  public async getLogs(): Promise<LogEntry[]> 
  {
    const clientLogs = await this.getClientLogs();
    const serverLogs = await this.getServerLogs();
  
    // Fusionner les logs client et serveur dans un seul tableau sans mélanger les propriétés
    const allLogs: LogEntry[] = [];
    clientLogs.forEach(log => allLogs.push({ ...log, context: 'client' }));
    serverLogs.forEach(log => allLogs.push({ ...log, context: 'server' }));
  
    // Trier les logs par timestamp
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
    return allLogs;
  }
  

  private async getClientLogs(): Promise<LogEntry[]> {
    if (this.db && this.dbInitialized) {
      try {
        return await this.db.getAll('logs');
      } catch (error) {
        console.error('Error fetching logs from IndexedDB:', error);
        return this.logs;
      }
    }
    return this.logs;
  }

  private async getServerLogs(): Promise<LogEntry[]> {
    try {
      const response = await fetch('/api/server-logs');
      if (!response.ok) {
        // throw new Error('Failed to fetch server logs');
      }
      return await response.json();
    } catch (error) {
      // console.error('Error fetching server logs:', error);
      return [];
    }
  }


  private async clearServerAllLogs(): Promise<void> {
    try {
      const response = await fetch('/api/server-logs', 
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', },
      });
  
      if (!response.ok) {
        // throw new Error('Échec de la suppression des logs');
      }
  
      const result = await response.json();
      console.log(result.message); // Affiche le message de confirmation
  
    } catch (error) {
      // console.error('Erreur lors de la suppression des logs:', error);
    }
  }

  

  private async saveLogToIndexedDB(logEntry: LogEntry): Promise<void> {
    if (this.db && this.dbInitialized) {
      try {
        await this.db.add('logs', logEntry);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'ConstraintError') {
          console.warn('Duplicate log entry detected, skipping:', logEntry);
        } else {
          console.error('Error saving log to IndexedDB:', error);
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

  private async loadLogsFromStorage(): Promise<void> {
    if (this.db && this.dbInitialized) {
      try {
        this.logs = await this.db.getAll('logs');
      } catch (error) {
        console.error('Error loading logs from IndexedDB:', error);
      }
    }
  }

  private async limitLogs(): Promise<void> {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(this.logs.length - this.maxLogs);
      if (this.db && this.dbInitialized) {
        try {
          const tx = this.db.transaction('logs', 'readwrite');
          const store = tx.objectStore('logs');
          const keys = await store.getAllKeys();
          for (let i = 0; i < keys.length - this.maxLogs; i++) {
            await store.delete(keys[i]);
          }
          await tx.done;
        } catch (error) {
          console.error('Error limiting logs in IndexedDB:', error);
        }
      }
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const now = new Date();
    const oldestAllowedDate = new Date(now.getTime() - this.maxAgeInDays * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => new Date(log.timestamp) > oldestAllowedDate);
    if (this.db && this.dbInitialized) {
      try {
        const tx = this.db.transaction('logs', 'readwrite');
        const store = tx.objectStore('logs');
        const index = store.index('by-timestamp');
        const range = IDBKeyRange.upperBound(oldestAllowedDate.toISOString());
        let cursor = await index.openCursor(range);
        while (cursor) {
          await cursor.delete();
          cursor = await cursor.continue();
        }
        await tx.done;
      } catch (error) {
        console.error('Error cleaning up old logs in IndexedDB:', error);
      }
    }
  }

  public async clearLogs(): Promise<void> {
    if (this.db && this.dbInitialized) {
      try {

        await this.db.clear('logs');
        await this.clearServerAllLogs();

      } catch (error) {
        console.error('Error clearing logs from IndexedDB:', error);
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
    this.listeners.forEach(listener => listener());
  }

  private generateLogHash(level: string, message: string, details?: any, metadata?: Record<string, any>): string {
    const content = `${level}:${message}:${JSON.stringify(details)}:${JSON.stringify(metadata)}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private async isDuplicateLog(log: LogEntry): Promise<boolean> {
    if (this.db && this.dbInitialized) {
      try {
        const existingLog = await this.db.getFromIndex('logs', 'by-hash', log.hash);
        return !!existingLog;
      } catch (error) {
        console.error('Error checking for duplicate log:', error);
        return false;
      }
    }
    return this.logs.some(existingLog => existingLog.hash === log.hash);
  }

  public async filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]> {
    const allLogs = await this.getLogs();
    return allLogs.filter(log =>
      Object.entries(criteria).every(([key, value]) => log[key as keyof LogEntry] === value)
    );
  }
}

export { ClientLogger };
export type { LogEntry };