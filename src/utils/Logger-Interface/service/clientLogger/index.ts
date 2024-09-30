
import { ClientLogger, LogEntry, ILogger } from './clientLogger';


let logger: ILogger;


if (typeof window !== 'undefined') 
{
    // On est côté client
    logger = ClientLogger.getInstance();

} 


export { logger };
export type { LogEntry, ILogger };
