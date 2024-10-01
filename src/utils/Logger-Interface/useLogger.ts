/* USELOGGER IMPLEMENTATION FONCTIONNEL AVEC LE LOCAL-STORAGE 

// useLogger.ts
'use client';
import { useState, useEffect, useCallback } from 'react';
import { logger, LogEntry } from '@/utils/Logger-Interface/logger/logger-v1-OLD-with-LocalStorage';

export function useLogger(): [
  LogEntry[],
  () => Promise<void>,
  () => Promise<void>,
  (criteria: Partial<LogEntry>) => Promise<LogEntry[]>
] {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = useCallback(async () => {
    if (logger) {
      const fetchedLogs = await logger.getLogs();
      setLogs(fetchedLogs);
    }
  }, []);

  useEffect(() => {
    if (logger) {
      fetchLogs();
      const removeListener = logger.addListener(fetchLogs);
      return () => removeListener();
    }
  }, [fetchLogs]);

  return [
    logs,
    async () => {
      if (logger) {
        await logger.clearLogs();
        await fetchLogs();
      }
    },
    fetchLogs,
    async (criteria: Partial<LogEntry>) => {
      if (logger) {
        return await logger.filterLogs(criteria);
      }
      return [];
    }
  ];
}

*/














'use client';

import { useState, useEffect, useCallback } from 'react';
import { logger, LogEntry } from '@/utils/Logger-Interface/service/clientLogger/index';

export function useLogger(): [
  LogEntry[],
  () => Promise<void>,
  () => Promise<void>,
  (criteria: Partial<LogEntry>) => Promise<LogEntry[]>
] {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const fetchedLogs = await logger.getLogs();
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const removeListener = logger.addListener(fetchLogs);
    return () => removeListener();
  }, [fetchLogs]);

  const clearLogs = async () => {
    try {
      await logger.clearLogs();
      await fetchLogs();
    } catch (error) {
      console.error("Error clearing logs:", error);
    }
  };

  const filterLogs = async (criteria: Partial<LogEntry>) => {
    try {
      return await logger.filterLogs(criteria);
    } catch (error) {
      console.error("Error filtering logs:", error);
      return [];
    }
  };

  return [logs, clearLogs, fetchLogs, filterLogs];
}
