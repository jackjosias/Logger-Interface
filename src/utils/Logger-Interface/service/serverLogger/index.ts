

import { ServerLogger, LogEntry, ILogger } from './serverLogger';


let logger: ILogger;


if (typeof window === 'undefined')  
{
    // On est côté serveur
    logger = ServerLogger.getInstance();

} 

export { logger };
export type { LogEntry, ILogger };
