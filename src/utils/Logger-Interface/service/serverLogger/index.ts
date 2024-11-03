import { ServerLogger, LogEntry, ILogger } from "./serverLogger";

let logger: ILogger;

if (typeof window === "undefined") 
{
  // On est côté serveur
  logger = ServerLogger.getInstance();
} 
else 
{
  throw new Error("Le logger ne peut être utilisé que côté serveur.");
}

export { logger };
export type { LogEntry, ILogger };
