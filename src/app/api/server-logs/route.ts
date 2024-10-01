// src/app/api/server-logs/route.ts

// Importation des modules nécessaires de Next.js pour gérer les requêtes et les réponses.
import { NextRequest, NextResponse } from 'next/server';
// Importation du module 'path' pour manipuler les chemins de fichiers.
import path from 'path';
// Importation du module 'fs/promises' pour les opérations asynchrones sur les fichiers.
import fs from 'fs/promises'; 
// Importation de l'interface ILogger depuis un fichier local. Cette interface définit la structure d'un logger.
import { ILogger } from '@/utils/Logger-Interface/service/serverLogger/index'; 
// Importation de la classe ServerLogger depuis un fichier local. Cette classe est une implémentation concrète de l'interface ILogger.
import { ServerLogger } from '@/utils/Logger-Interface/service/serverLogger/serverLogger'; 


// Interface pour définir la structure d'une réponse d'erreur en JSON.
interface ErrorResponse {
    // Propriété 'error' de type string contenant le message d'erreur.
    error: string;
}

// Fonction gérant les requêtes GET à cette route. Elle retourne une promesse de NextResponse contenant soit un tableau d'entrées de log, soit un objet ErrorResponse.
export async function GET(req: NextRequest): Promise<NextResponse<any[] | ErrorResponse>> {
    try { // Bloc try...catch pour gérer les erreurs potentielles.
        // Obtention d'une instance du logger en utilisant le pattern Singleton via la méthode getInstance() de la classe ServerLogger.
        // L'injection de dépendances est utilisée ici, ce qui permet de facilement remplacer l'implémentation du logger si nécessaire.
        const serverLogger: ILogger = ServerLogger.getInstance(); 
        
        // Appel de la méthode getLogs() du logger pour récupérer les logs. Cette méthode retourne une promesse.
        const logs = await serverLogger.getLogs();

        // Renvoie d'une réponse JSON contenant les logs et un code de statut 200 (OK).
        return NextResponse.json(logs, { status: 200 });

    } catch (error: any) { // Capture de toute erreur survenue dans le bloc try.
        // Affichage de l'erreur dans la console pour le débogage.
        console.error('Erreur lors de la récupération des logs du serveur :', error);
        // Renvoie d'une réponse JSON contenant un message d'erreur et un code de statut 500 (Erreur interne du serveur).
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}

// Fonction gérant les requêtes DELETE à cette route. Elle retourne une promesse de NextResponse contenant soit un message de succès, soit un objet ErrorResponse.
export async function DELETE(req: NextRequest) : Promise<NextResponse< { message: string } | ErrorResponse >> {
    try { // Bloc try...catch pour gérer les erreurs potentielles.
         // Obtention d'une instance du logger en utilisant le pattern Singleton via la méthode getInstance() de la classe ServerLogger.
        const serverLogger: ILogger = ServerLogger.getInstance(); 

        // Appel de la méthode clearLogs() du logger pour supprimer tous les logs. Cette méthode retourne une promesse.
        await serverLogger.clearLogs();

        // Construction du chemin du fichier de logs en utilisant le répertoire de travail actuel et le nom du fichier 'server-logs.json'.
        const logFilePath = path.join(process.cwd(), 'server-logs.json');

        try { // Bloc try...catch imbriqué pour gérer spécifiquement les erreurs lors de la suppression du fichier.
            // Suppression du fichier de logs.
            await fs.unlink(logFilePath);
        } catch(error: any) { // Capture de toute erreur survenue lors de la suppression du fichier.
             // Vérification si l'erreur est due au fait que le fichier n'existe pas (code d'erreur 'ENOENT').
            if (error.code === 'ENOENT') {
                // Affichage d'un avertissement dans la console si le fichier n'existe pas.
                console.warn('Le fichier de logs n\'existe pas.');
            } else { 
                 // Relance de l'erreur pour les autres types d'erreurs.
                throw error; 
            }
        }
        // Renvoie d'une réponse JSON contenant un message de succès et un code de statut 200 (OK).
        return NextResponse.json({ message: 'Les logs ont été effacés avec succès.' }, { status: 200 });

    } catch (error: any) { // Capture de toute erreur survenue dans le bloc try principal.
        // Affichage de l'erreur dans la console pour le débogage.
        console.error('Erreur lors de l\'effacement des logs :', error);
        // Renvoie d'une réponse JSON contenant un message d'erreur et un code de statut 500 (Erreur interne du serveur).
        return NextResponse.json({ error: 'Une erreur est survenue lors de l\'effacement des logs.' }, { status: 500 });
    }
}















/*
Commentaire général :

Ce code implémente une API pour gérer les logs du serveur dans une application Next.js. Il fournit deux routes :

- GET /api/server-logs : Récupère tous les logs du serveur.
- DELETE /api/server-logs : Supprime tous les logs du serveur.

Le code utilise l'injection de dépendances pour le logger, ce qui le rend plus testable et maintenable. Il gère également les erreurs de manière appropriée et utilise les promesses pour les opérations asynchrones.


Lacunes et améliorations possibles :

-  Gestion des logs plus avancée :  Actuellement, le code supprime tous les logs. Il pourrait être amélioré pour gérer des logs plus spécifiques (par date, type, etc.) ou pour implémenter une rotation des logs.
-  Sécurité :  Des mesures de sécurité supplémentaires pourraient être ajoutées, comme la restriction de l'accès à l'API DELETE.
-  Tests unitaires :  Des tests unitaires devraient être écrits pour garantir le bon fonctionnement du code.
-  Documentation :  La documentation pourrait être améliorée pour expliquer plus en détail l'utilisation de l'API.

Ce que le développeur Jack-Josias pensait :

Jack-Josias voulait créer une API simple et efficace pour gérer les logs du serveur. Il a choisi d'utiliser Next.js pour sa facilité d'utilisation et ses performances. Il a également mis l'accent sur la  lisibilité  et la maintenabilité du code en utilisant l'injection de dépendances et une gestion des erreurs appropriée.  Il imaginait probablement que cette API serait utilisée par une application web ou mobile pour surveiller et gérer les logs du serveur.

Impact du code :

Positif :
    - Facilite la gestion des logs du serveur.
    - Améliore la maintenabilité du code.
    - Permet de surveiller l'activité du serveur.

Négatif :
    -  Risque de sécurité si l'API DELETE n'est pas correctement sécurisée.
    -  Perte de données si les logs sont supprimés par erreur.


Cas d'utilisation en 2024 :

- Surveillance des performances du serveur.
- Débogage des erreurs d'application.
- Audit de sécurité.
- Analyse de l'utilisation de l'application.
- Collecte de données pour l'apprentissage automatique.
- Surveillance des erreurs et des exceptions.
- Suivi des événements importants.
- Enregistrement des actions des utilisateurs.
- Analyse des tendances d'utilisation.



Points sur Next.js :

- Next.js : Framework React pour le développement d'applications web. Il offre des fonctionnalités telles que le rendu côté serveur, le routage et une meilleure optimisation pour les moteurs de recherche.  Le fichier `route.ts` dans le dossier `app` est un fichier API route handler, une nouveauté dans Next.js 13, qui permet de créer des API facilement.  
- Bonnes pratiques Next.js :  L'utilisation des API routes est une bonne pratique pour créer des API dans Next.js. Cela permet de garder le code de l'API séparé du code de l'interface utilisateur et de  simplifier  le développement.

*/