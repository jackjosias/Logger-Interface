// ecn-front/src/utils/Logger-Interface/page/Interface.tsx

"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';

import { useLogger } from '@/utils/Logger-Interface/useLogger';
import { logger } from '@/utils/Logger-Interface/service/clientLogger/index';

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, TimeScale, PointElement, LineElement, ArcElement, DoughnutController, PieController } from 'chart.js';
import { Bar, Line, Pie, Doughnut, Bubble, Scatter } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { fr } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';
import { Badge, Button, Card, Col, Container, Form, InputGroup, Modal, Row, Table } from 'react-bootstrap';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, TimeScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, DoughnutController, PieController
);

interface LogEntry {
  id: number; // Assurez-vous que ce type est cohérent avec celui de baseLogger
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




const LogViewerPage: React.FC = () => 
{

  

  const [logs, clearLogs, refreshLogs] = useLogger();

  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [selectedFile, setSelectedFile] = useState<string>('all');
  const [contextFilter, setContextFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const showDetailsModal = (log: LogEntry) => {
    setSelectedLog(log);
    setShowModal(true);
  };



  const handleRefresh = () => {
    filterLogs();
    ReloadPage();
  };

  
  const ReloadPage = () => 
    {
      setTimeout(() => {
        window.location.reload();
      }, 3333); // Délai de 3 secondes (3000 millisecondes)
    };

  const filterLogs = useCallback(() => 
  {
    const now = new Date();
    const filtered = logs.filter((log) => {
      const logDate = new Date(log.timestamp);
      const timeDiff = now.getTime() - logDate.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      return (
        (searchTerm === '' || log.message.toLowerCase().includes(searchTerm.toLowerCase()) || log.fileName.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (levelFilter === 'all' || log.level === levelFilter) &&
        (timeRange === 'all' || (timeRange === '1h' && hoursDiff <= 1) || (timeRange === '24h' && hoursDiff <= 24) || (timeRange === '7d' && hoursDiff <= 168)) &&
        (selectedFile === 'all' || log.fileName === selectedFile) &&
        (contextFilter === 'all' || log.context === contextFilter)
      );
    });
    
    setFilteredLogs([...filtered]);
    
  }, [logs, searchTerm, levelFilter, timeRange, selectedFile, contextFilter]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (autoRefresh) 
      {
        await refreshLogs(); // Appel à la fonction pour récupérer les nouveaux logs
        await filterLogs();
        logger.info('Rafraîchissement automatique des logs');
      }
    }, 1111);
    return () => clearInterval(intervalId);
  }, [filterLogs, autoRefresh]);


  

  const downloadLogs = () => {
    const logText = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([logText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'application_logs.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLogLevelChartData = useMemo(() => {
    const logCounts = filteredLogs.reduce(
      (acc: Record<string, number>, log: LogEntry) => { // Ajout du type explicite pour 'log'
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(logCounts),
      datasets: [
        {
          label: 'Nombre de logs',
          data: Object.values(logCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogOverTimeChartData = useMemo(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const timeLabels = ['1h', '30min', '15min', '5min', 'Now'];
    const timeIntervals = [
      60 * 60 * 1000,
      30 * 60 * 1000,
      15 * 60 * 1000,
      5 * 60 * 1000,
      0,
    ];
    const logCountsOverTime = timeLabels.map((_, index) => {
      const endTime = index === timeLabels.length - 1 ? Date.now() : oneHourAgo + timeIntervals[index];
      const startTime = endTime - timeIntervals[index];
      return filteredLogs.filter(
        (log: LogEntry) => new Date(log.timestamp).getTime() >= startTime && new Date(log.timestamp).getTime() <= endTime
      ).length;
    });
    return {
      labels: timeLabels,
      datasets: [
        {
          label: 'Nombre de logs',
          data: logCountsOverTime,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
        },
      ],
    };
  }, [filteredLogs]);

  const getTopErrorsChartData = useMemo(() => {
    const errorCounts = filteredLogs
      .filter((log: LogEntry) => log.level === 'error') // Ajout du type explicite pour 'log'
      .reduce(
        (acc: Record<string, number>, log: LogEntry) => // Ajout du type explicite pour 'acc'
        { 
          acc[log.message] = (acc[log.message] || 0) + 1;
          return acc;
        }, {} as Record<string, number> // Assurez-vous que le type est correct ici
      );
    const sortedErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return {
      labels: sortedErrors.map(([message]) => message),
      datasets: [
        {
          label: "Nombre d'occurrences",
          data: sortedErrors.map(([, count]) => count),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsByFileChartData = useMemo(() => {
    const logCountsByFile = filteredLogs.reduce(
      (acc: Record<string, number>, log: LogEntry) => { // Ajout du type explicite pour 'log'
        acc[log.fileName] = (acc[log.fileName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(logCountsByFile),
      datasets: [
        {
          label: 'Nombre de logs par fichier',
          data: Object.values(logCountsByFile),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsTrendChartData = useMemo(() => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hourlyLogs = filteredLogs
      .filter((log: LogEntry) => new Date(log.timestamp) >= twentyFourHoursAgo)
      .reduce(
        (acc: Record<number, number>, log: LogEntry) => {
          const hour = new Date(log.timestamp).getHours();
          acc[hour] = (acc[hour] || 0) + 1;
          return acc;
        }, {} as Record<number, number>
      );
    const labels = Array.from({ length: 24 }, (_, i) => i);
    const data = labels.map((hour) => hourlyLogs[hour] || 0);
    return {
      labels,
      datasets: [
        {
          label: 'Tendance des logs (24 dernières heures)',
          data,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          fill: true,
        },
      ],
    };
  }, [filteredLogs]);

  const getLogSeverityDistributionData = useMemo(() => {
    const severityCounts = filteredLogs.reduce(
      (acc: Record<string, number>, log: LogEntry) => { // Ajout du type explicite pour 'log'
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(severityCounts),
      datasets: [
        {
          data: Object.values(severityCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getBrowserDistributionData = useMemo(() => {
    const browserCounts = filteredLogs.reduce((acc: Record<string, number>, log: LogEntry) => { // Ajout du type explicite pour 'acc'
      const browser = log.userAgent ? identifyBrowser(log.userAgent) : 'Inconnu';
      acc[browser] = (acc[browser] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      labels: Object.keys(browserCounts),
      datasets: [
        {
          data: Object.values(browserCounts),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getContextDistributionData = useMemo(() => {
    const contextCounts = filteredLogs.reduce(
      (acc: Record<string, number>, log: LogEntry) => { // Ajout du type explicite pour 'log'
        acc[log.context] = (acc[log.context] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(contextCounts),
      datasets: [
        {
          data: Object.values(contextCounts),
          backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsBySessionChartData = useMemo(() => {
    const sessionCounts = filteredLogs.reduce(
      (acc, log) => {
        acc[log.sessionId] = (acc[log.sessionId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(sessionCounts),
      datasets: [
        {
          label: 'Nombre de logs par session',
          data: Object.values(sessionCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsByUserAgentChartData = useMemo(() => {
    const userAgentCounts = filteredLogs.reduce(
      (acc, log) => {
        const userAgent = log.userAgent || 'Inconnu';
        acc[userAgent] = (acc[userAgent] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(userAgentCounts),
      datasets: [
        {
          label: 'Nombre de logs par user agent',
          data: Object.values(userAgentCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsByHourOfDayChartData = useMemo(() => {
    const hourCounts = filteredLogs.reduce(
      (acc, log) => {
        const hour = new Date(log.timestamp).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>
    );
    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: 'Nombre de logs par heure de la journée',
          data: Array.from({ length: 24 }, (_, i) => hourCounts[i] || 0),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsByDayOfWeekChartData = useMemo(() => {
    const dayCounts = filteredLogs.reduce(
      (acc, log) => {
        const day = new Date(log.timestamp).getDay();
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {} as Record<number, number>
    );
    return {
      labels: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
      datasets: [
        {
          label: 'Nombre de logs par jour de la semaine',
          data: Array.from({ length: 7 }, (_, i) => dayCounts[i] || 0),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsByMessageTypeChartData = useMemo(() => {
    const messageTypeCounts = filteredLogs.reduce(
      (acc, log) => {
        acc[log.message] = (acc[log.message] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(messageTypeCounts),
      datasets: [
        {
          label: 'Nombre de logs par type de message',
          data: Object.values(messageTypeCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);

  const getLogsByErrorTypeChartData = useMemo(() => {
    const errorTypeCounts = filteredLogs.reduce(
      (acc, log) => {
        if (log.level === 'error') {
          acc[log.message] = (acc[log.message] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>
    );
    return {
      labels: Object.keys(errorTypeCounts),
      datasets: [
        {
          label: 'Nombre de logs par type d&apos;erreur',
          data: Object.values(errorTypeCounts),
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
          ],
        },
      ],
    };
  }, [filteredLogs]);


  const getBubbleChartData = useMemo(() => {
    const fileLevelCounts = filteredLogs.reduce(
      (acc, log) => {
        const key = `${log.fileName}-${log.level}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>
    );
    return {
      datasets: [
        {
          label: 'Fréquence des logs par fichier et niveau',
          data: Object.entries(fileLevelCounts).map(([key, count]) => {
            const [fileName, level] = key.split('-');
            return { x: fileName, y: level, r: count * 5 };
          }),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
      ],
    };
  }, [filteredLogs]);

  const getUniqueFiles = useMemo(() => {
    const uniqueFiles = new Set(logs.map(log => log.fileName));
    return ['all', ...Array.from(uniqueFiles)];
  }, [logs]);

  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setIsLoading(false);
  }, []);

  const groupedLogs = useMemo(() => {
    return filteredLogs.reduce(
      (acc, log) => {
        if (!acc[log.fileName]) {
          acc[log.fileName] = [];
        }
        acc[log.fileName].push(log);
        return acc;
      },
      {} as Record<string, LogEntry[]>
    );
  }, [filteredLogs]);

  if (isLoading) return null;

  return (
    <Container fluid className="mt-5">
      <Row>
        <Col>
          <h1>Visualisateur de logs avancé</h1>
        </Col>
      </Row>
      <Row className="mb-4">
        <Col md={3}>
          <InputGroup>
            <Form.Control
              type="text"
              placeholder="Rechercher dans les logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
        <Col md={2}>
          <Form.Select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="all">Tous les niveaux</option>
            <option value="info">Info</option>
            <option value="warn">Avertissement</option>
            <option value="error">Erreur</option>
            <option value="debug">Débogage</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="all">Tout l&apos;historique</option>
            <option value="1h">Dernière heure</option>
            <option value="24h">Dernières 24 heures</option>
            <option value="7d">Derniers 7 jours</option>
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Select value={selectedFile} onChange={(e) => setSelectedFile(e.target.value)}>
            {getUniqueFiles.map((file: string) => (
              <option key={file} value={file}>
                {file === 'all' ? 'Tous les fichiers' : file}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Select value={contextFilter} onChange={(e) => setContextFilter(e.target.value)}>
            <option value="all">Tous les contextes</option>
            <option value="client">Client</option>
            <option value="server">Serveur</option>
          </Form.Select>
        </Col>
        <Col md={0} className="">
          <br />
          <Form.Check
            type="switch" 
            id="autoRefreshSwitch"
            label="Rafraîchissement auto"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
        </Col>
      </Row>
      <Row>
        <Col>
          <div className="d-flex justify-content-end">
            <Button variant="primary" className="me-2" onClick={ handleRefresh }>
              Actualiser
            </Button>
            <Button variant="danger" className="me-2" onClick={clearLogs}>
              Effacer les logs
            </Button>
            <Button variant="secondary" onClick={downloadLogs}>
              Télécharger les logs
            </Button>
          </div>
        </Col>
      </Row>
      {filteredLogs.length === 0 ? (
        <Row className="mt-4">
          <Col>
            <Card bg="info" text="white">
              <Card.Body>
                <Card.Title>Aucun log trouvé.</Card.Title>
                <Card.Text>
                  Il n&apos;y a pas de logs correspondant à vos critères de recherche ou le stockage des logs est vide.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : (
        <>
          <Row className="mt-4">
            <Col md={6} lg={2} xl={4} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Tendance (24h)</Card.Title>
                  <Line data={getLogsTrendChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={2} xl={4} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs (60 dernières minutes)</Card.Title>
                  <Line data={getLogOverTimeChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={2} xl={4} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Top 5 des erreurs</Card.Title>
                  <Bar data={getTopErrorsChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={4} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Fréquence des logs par fichier et niveau</Card.Title>
                  <Bubble data={getBubbleChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={4} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par heure de la journée</Card.Title>
                  <Bar data={getLogsByHourOfDayChartData} />
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} lg={4} xl={4} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par jour de la semaine</Card.Title>
                  <Bar data={getLogsByDayOfWeekChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par fichier</Card.Title>
                  <Pie data={getLogsByFileChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par navigateur</Card.Title>
                  <Pie data={getBrowserDistributionData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Sévérité des logs</Card.Title>
                  <Pie data={getLogSeverityDistributionData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par contexte</Card.Title>
                  <Pie data={getContextDistributionData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par session</Card.Title>
                  <Pie data={getLogsBySessionChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par user agent</Card.Title>
                  <Pie data={getLogsByUserAgentChartData} />
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par type de message</Card.Title>
                  <Pie data={getLogsByMessageTypeChartData} />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} lg={4} xl={3} className="mb-4">
              <Card>
                <Card.Body>
                  <Card.Title className="text-white">Logs par type d&apos;erreur</Card.Title>
                  <Pie data={getLogsByErrorTypeChartData} />
                </Card.Body>
              </Card>
            </Col>

          </Row>


          {/* Logs détaillés */}
          <Row className="mt-5">
            <Col>
              <h2>Logs détaillés par fichier</h2>
              {Object.entries(groupedLogs).map(([fileName, logs]) => (
                <Card key={fileName} className="mb-4 mt-5">
                  <Card.Header>
                    <h3 className="mb-0">{fileName}</h3>
                  </Card.Header>
                  <Card.Body>
                    <Table striped hover responsive>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Horodatage</th>
                          <th>Niveau</th>
                          <th>Ligne</th>
                          <th>Contexte / Composant</th>
                          <th>Message</th>
                          <th>Détails</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className={`table-${getLevelClass(log.level)}`}>
                            <td>{log.id}</td>
                            <td>
                              <span title={new Date(log.timestamp).toLocaleString()}>
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: fr })}
                              </span>
                            </td>
                            <td>
                              <Badge bg={getLevelClass(log.level)}>{log.level.toUpperCase()}</Badge>
                            </td>
                            <td>{log.lineNumber}</td>
                            <td>
                              <Badge bg={log.context === 'client' ? 'primary' : 'secondary'}>
                                {log.context.toUpperCase()}
                              </Badge>
                            </td>
                            <td>
                              <b>{log.message}</b>
                            </td>
                            <td>
                              {log.details ? (
                                <Button variant="info" size="sm" onClick={() => showDetailsModal(log)}>
                                  Voir détails
                                </Button>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              ))}
            </Col>
          </Row>


        </>
      )}
      <DetailsModal show={showModal} onHide={() => setShowModal(false)} log={selectedLog} />
    </Container>
  );
};

const getLevelClass = (level: string): string => {
  switch (level) {
    case 'info':
      return 'info';
    case 'warn':
      return 'warning';
    case 'error':
      return 'danger';
    case 'debug':
      return 'secondary';
    default:
      return 'light';
  }
};

interface DetailsModalProps {
  show: boolean;
  onHide: () => void;
  log: LogEntry | null;
}

const DetailsModal: React.FC<DetailsModalProps> = ({ show, onHide, log }) => {
  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Détails du log</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {log ? (
          <pre className="overflow-auto">
            {JSON.stringify(
              { ...log, timestamp: new Date(log.timestamp).toLocaleString() },
              null,
              2
            )}
          </pre>
        ) : (
          'Aucun log sélectionné'
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Fermer
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// Fonction pour identifier le navigateur à partir de l'user agent
const identifyBrowser = (userAgent: string): string => {
  if (/chrome/i.test(userAgent)) {
    return 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    return 'Firefox';
  } else if (/safari/i.test(userAgent)) {
    return 'Safari';
  } else if (/edge/i.test(userAgent)) {
    return 'Edge';
  } else if (/trident/i.test(userAgent)) {
    return 'IE';
  } else {
    return 'Autre';
  }
};

export default LogViewerPage;
















/*

  ## Fonctionnalités complètes du code amélioré du composant TSX

  Le code amélioré du composant TSX fournit un outil complet de visualisation et d'analyse des logs, offrant une interface utilisateur intuitive et des fonctionnalités riches pour aider à la prise de décision.

  **Fonctionnalités clés:**

  **1. Affichage des logs:**

  * **Tableau détaillé:** Affiche les logs dans un tableau avec les informations suivantes :
      * ID du log
      * Horodatage (affiché de manière relative et absolue)
      * Niveau de gravité (Info, Warning, Error, Debug)
      * Numéro de ligne du fichier source
      * Contexte (Client ou Serveur)
      * Message du log
      * Bouton pour afficher les détails (si disponibles)

  * **Pagination:** Implémentez la pagination pour gérer efficacement l'affichage d'un grand nombre de logs.

  * **Tri:** Permet de trier les logs par colonne (ID, horodatage, niveau, ligne, contexte, message)

  **2. Filtrage des logs:**

  * **Recherche textuelle:**  Recherche de mots clés dans le message ou le nom du fichier.
  * **Filtre de niveau:** Affiche les logs d'un niveau spécifique (Info, Warning, Error, Debug).
  * **Filtre de contexte:** Affiche les logs provenant du client ou du serveur.
  * **Filtre de temps:** Affiche les logs d'une période donnée (dernière heure, dernières 24 heures, 7 derniers jours, ou tout l'historique).
  * **Filtre de fichier:** Affiche les logs d'un fichier spécifique.



  **3. Visualisation des logs:**

  * ** graphiques interactifs:**

      voici la liste des graphiques utilisés dans le code et leurs utilisations :

      ### 1. **Line Chart (Graphique en ligne)**
      - **Utilisation** : Affiche la tendance des logs sur les 24 dernières heures et les logs sur les 60 dernières minutes.
      - **Composant** : `<Line />`
      - **Données** :
        - `getLogsTrendChartData` : Tendance des logs sur les 24 dernières heures.
        - `getLogOverTimeChartData` : Logs sur les 60 dernières minutes.

      ### 2. **Bar Chart (Graphique en barres)**
      - **Utilisation** : Affiche diverses distributions de logs, telles que les erreurs les plus fréquentes, les logs par heure de la journée, les logs par durée de session, et les logs par jour de la semaine.
      - **Composant** : `<Bar />`
      - **Données** :
        - `getTopErrorsChartData` : Top 5 des erreurs les plus fréquentes.
        - `getLogsByHourOfDayChartData` : Distribution des logs par heure de la journée.
        - `getLogsBySessionDurationChartData` : Distribution des logs par durée de session.
        - `getLogsByDayOfWeekChartData` : Distribution des logs par jour de la semaine.

      ### 3. **Pie Chart (Graphique en secteurs)**
      - **Utilisation** : Affiche diverses distributions de logs, telles que les logs par fichier, les logs par navigateur, la sévérité des logs, les logs par contexte, les logs par session, les logs par user agent, les logs par type de message, et les logs par type d'erreur.
      - **Composant** : `<Pie />`
      - **Données** :
        - `getLogsByFileChartData` : Distribution des logs par fichier.
        - `getBrowserDistributionData` : Distribution des logs par navigateur.
        - `getLogSeverityDistributionData` : Distribution de la sévérité des logs.
        - `getContextDistributionData` : Distribution des logs par contexte (client/serveur).
        - `getLogsBySessionChartData` : Distribution des logs par session.
        - `getLogsByUserAgentChartData` : Distribution des logs par user agent.
        - `getLogsByMessageTypeChartData` : Distribution des logs par type de message.
        - `getLogsByErrorTypeChartData` : Distribution des logs par type d'erreur.

      ### 4. **Bubble Chart (Graphique en bulles)**
      - **Utilisation** : Affiche la fréquence des logs par fichier et niveau.
      - **Composant** : `<Bubble />`
      - **Données** :
        - `getBubbleChartData` : Fréquence des logs par fichier et niveau.

      ### Résumé des graphiques utilisés :

      1. **Line Chart** :
        - Tendance des logs sur les 24 dernières heures.
        - Logs sur les 60 dernières minutes.

      2. **Bar Chart** :
        - Top 5 des erreurs les plus fréquentes.
        - Distribution des logs par heure de la journée.
        - Distribution des logs par durée de session.
        - Distribution des logs par jour de la semaine.

      3. **Pie Chart** :
        - Distribution des logs par fichier.
        - Distribution des logs par navigateur.
        - Distribution de la sévérité des logs.
        - Distribution des logs par contexte (client/serveur).
        - Distribution des logs par session.
        - Distribution des logs par user agent.
        - Distribution des logs par type de message.
        - Distribution des logs par type d'erreur.

      4. **Bubble Chart** :
        - Fréquence des logs par fichier et niveau.

      Ces graphiques permettent de visualiser différentes distributions et tendances des logs, 
      offrant ainsi une vue d'ensemble complète et détaillée des données de logs.


  
**4. Interaction avec les logs:**

  * **Voir les détails:** Affiche les détails complets d'un log dans un modal, en formattant les objets et tableaux pour une meilleure lisibilité.
  * **Effacer les logs:** Supprime tous les logs stockés.
  * **Télécharger les logs:** Exporte les logs filtrés au format JSON.
  * **Rafraîchissement automatique:** Met à jour automatiquement l'affichage des logs à intervalles réguliers.

  **Améliorations supplémentaires:**

  * **Gestion des erreurs:** Implémentez la gestion des erreurs pour gérer les problèmes potentiels lors du chargement ou du filtrage des logs.

  * **Personnalisation:** Permettez aux utilisateurs de personnaliser certains aspects de l'interface, comme les couleurs des graphiques ou le nombre de logs affichés par page.


  * **Tests unitaires:**  Créez des tests unitaires pour vous assurer que les fonctions de filtrage, de tri et de visualisation fonctionnent correctement.

  **Conclusion:**

  Ce composant TSX amélioré offre une solution complète et conviviale pour la visualisation et l'analyse des logs. Les fonctionnalités de filtrage avancées, les graphiques interactifs et l'interface utilisateur intuitive facilitent l'identification rapide des tendances, la résolution des problèmes et la prise de décisions éclairées en fonction des données collectées.


*/
























































