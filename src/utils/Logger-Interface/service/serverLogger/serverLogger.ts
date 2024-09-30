import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ILogger, LogEntry } from '../clientLogger/clientLogger';

class ServerLogger implements ILogger 
{
  private static instance: ServerLogger;
  private sessionId: string;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private maxAgeInDays: number = 7;
  private listeners: Set<() => void> = new Set();
  private logFilePath: string;
  private logIndexPath: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.logFilePath = path.join(process.cwd(), 'server-logs.json');
    this.logIndexPath = path.join(process.cwd(), '');
    this.initServerStorage();
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
    try {
      await fs.access(this.logFilePath);
      await fs.access(this.logIndexPath);
    } catch (error) {
      await fs.writeFile(this.logFilePath, '[]');
      await fs.writeFile(this.logIndexPath, '{}');
    }
    await this.loadLogsFromFile();
  }

  private async loadLogsFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.logFilePath, 'utf8');
      this.logs = JSON.parse(data);
    } catch (error) {
      console.error('Error loading logs from file:', error);
      this.logs = [];
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
      context: 'server',
      sessionId: this.sessionId,
      metadata,
      hash: this.generateLogHash(level, message, details, metadata),
    };

    if (await this.isDuplicateLog(logEntry)) {
      return;
    }

    this.logs.push(logEntry);
    await this.saveLogs();
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

  private async saveLogs(): Promise<void> {
    try {
      await fs.writeFile(this.logFilePath, JSON.stringify(this.logs, null, 2));
      const logIndex = await this.getLogIndex();
      await fs.writeFile(this.logIndexPath, JSON.stringify(logIndex, null, 2));
    } catch (error) {
      console.error('Error saving logs to file:', error);
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

  public async getLogs(): Promise<LogEntry[]> {
    await this.loadLogsFromFile();
    return this.logs;
  }

  public async clearLogs(): Promise<void> {
    this.logs = [];
    await this.saveLogs();
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
    const logIndex = await this.getLogIndex();
    return !!logIndex[log.hash];
  }

  private async getLogIndex(): Promise<Record<string, boolean>> {
    try {
      const data = await fs.readFile(this.logIndexPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading log index:', error);
      return {};
    }
  }

  public async filterLogs(criteria: Partial<LogEntry>): Promise<LogEntry[]> {
    await this.loadLogsFromFile();
    return this.logs.filter(log =>
      Object.entries(criteria).every(([key, value]) => log[key as keyof LogEntry] === value)
    );
  }

  private async limitLogs(): Promise<void> {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(this.logs.length - this.maxLogs);
      await this.saveLogs();
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const now = new Date();
    const oldestAllowedDate = new Date(now.getTime() - this.maxAgeInDays * 24 * 60 * 60 * 1000);
    this.logs = this.logs.filter(log => new Date(log.timestamp) > oldestAllowedDate);
    await this.saveLogs();
  }
}

export { ServerLogger };
export type { LogEntry, ILogger };
