# Logger-Interface for REACT.JS and NEXT.JS PROJECTS 💯


### Cet UTILITAIRE [Logger-Interface] est en Réalité un composant TSX amélioré offrant une solution complète et conviviale pour la visualisation et l'analyse des logs. Les fonctionnalités de filtrage avancées, les graphiques interactifs et l'interface utilisateur intuitive facilitent l'identification rapide des tendances, la résolution des problèmes et la prise de décisions éclairées en fonction des données collectées. Pour une GESTION COMPLETE DES LOGS.


## Auteur

Ce composant a été créé par [`Jack-Josias`] 👨🏽‍💻.


## Licence

Cette interface est sous la licence MIT, permettant une utilisation libre tout en préservant les droits d'auteur de l'auteur.


## QUELQUES CAPTURES D'ECRAN DU GESTIONNAIRE [Logger-Interface]:

![Image1 CAPTURES D'ECRAN DU GESTIONNAIRE Logger-Interface ](https://raw.githubusercontent.com/jackjosias/Logger-Interface/refs/heads/main/log-interface1.png)


![Image2 CAPTURES D'ECRAN DU GESTIONNAIRE Logger-Interface ](https://raw.githubusercontent.com/jackjosias/Logger-Interface/refs/heads/main/log-interface2.png)


![Image3 CAPTURES D'ECRAN DU GESTIONNAIRE Logger-Interface ](https://raw.githubusercontent.com/jackjosias/Logger-Interface/refs/heads/main/log-interface3.png)


![Image4 CAPTURES D'ECRAN DU GESTIONNAIRE Logger-Interface ](https://raw.githubusercontent.com/jackjosias/Logger-Interface/refs/heads/main/log-interface4.png)



### ARBORESCENCE DE DOSSIER FAIT EN NEXT.JS (14.2.13) 

```
Project
    └───src\
        ├───app\
        │   ├───api\
        │   │   └───server-logs\
        │   │       └───route.ts     
        │   │
        │   └───logger\
        │       └───page.tsx        
        │
        │   
        └───utils\
            └───Logger-Interface\
                  ├───old-logger-version\  
                  │        
                  ├───page\
                  │     └───Interface.tsx
                  │
                  ├───service\
                  │     ├───clientLogger\
                  │     │     ├───clientLogger.ts
                  │     │     └───index.ts
                  │     │
                  │     └───serverLogger\
                  │           ├───serverLogger.ts
                  │           └───index.ts
                  │
                  └───useLogger.ts
```


### EXPLICATION DE L'ARBORESCENCE DE DOSSIER DU [Logger-Interface].

```
   👉🏽 *** src\app\api\server-logs\route.ts ***

            ☑️ Ce code implémente une API pour gérer les logs du serveur dans une application Next.js. Il fournit deux routes :

                  - GET /api/server-logs : Récupère tous les logs du serveur.
                  
                  - DELETE /api/server-logs : Supprime tous les logs du serveur.

                  - Le code utilise l'injection de dépendances pour le logger, ce qui le rend plus testable et maintenable. Il gère également les erreurs de manière appropriée et utilise les promesses pour les opérations asynchrones.

            ☑️ Ce que le développeur Jack-Josias pensait en voulant creer ce code :

                  Jack-Josias voulait créer une API simple et efficace pour gérer les logs du serveur. Il a choisi d'utiliser Next.js pour sa facilité d'utilisation et ses performances. Il a également mis l'accent sur la  lisibilité  et la maintenabilité du code en utilisant l'injection de dépendances et une gestion des erreurs appropriée.  Il imaginait probablement que cette API serait utilisée par une application web ou mobile pour surveiller et gérer les logs du serveur.
                  


   👉🏽 *** src\app\logger\page.tsx ***

            ☑️ Ce code est le composant principal d'une page Next.js qui affiche une interface de journalisation (logger). Son but est de présenter les logs à l'utilisateur. L'utilité principale est de centraliser l'affichage des logs, ce qui facilite le debugging et le suivi de l'application.


            ☑️ Le composant page est responsable uniquement de la présentation. La logique de récupération et de formatage des logs est probablement gérée dans le composant Logger_Interface. Ceci permet une meilleure séparation des préoccupations et facilite la maintenance du code.
                 
                 - Répertoire pages: Les fichiers dans ce répertoire définissent les routes de l'application.

                 - Composants: Next.js encourage l'utilisation de composants pour organiser le code et réutiliser les éléments d'interface utilisateur.

                 - Importation de composants: L'utilisation de chemins relatifs avec @/ est une bonne pratique pour simplifier les imports et rendre le code plus lisible.
            

            ☑️ Pensées du développeur (Jack-Josias) pensait en voulant creer ce code:

                  Jack-Josias a probablement créé ce code pour simplifier l'importation de la page de visualisation des logs de l'application. Il a vraisemblablement voulu créer une interface centralisée pour faciliter le débogage et le suivi des événements.
                  
            
            ☑️ Utilité : EN realité ce code appele et affiche seuelement l'Interface du Logger contenu dans le repertoire *** src\utils\Logger-Interface\page\Interface.tsx *** afin de separer les responsabilite et le rendre plus modulaire.


   👉🏽 *** src\utils\Logger-Interface\page\Interface.tsx ***
   
            ☑️ But : Ce composant Next.js fournit une interface utilisateur interactive pour visualiser et analyser les journaux d'application. Il permet de filtrer, trier et afficher les journaux dans un tableau, ainsi que de visualiser les données des journaux à l'aide de divers graphiques.
 
            ☑️ Utilité : Ce composant est utile pour le débogage, la surveillance des performances et l'analyse des erreurs dans une application. Il permet aux développeurs d'identifier rapidement les problèmes et de comprendre le comportement de l'application.


            ☑️ Lacunes et améliorations possibles :
               *  - Pagination pour gérer un grand nombre de journaux.
               *  - Amélioration de la gestion des erreurs pour une meilleure expérience utilisateur.
               *  - Ajout de plus de types de graphiques pour une analyse plus approfondie.
               *  - Optimisation des performances pour les très grands ensembles de données.
               *  - Internationalisation pour prendre en charge plusieurs langues.
               

            ☑️ Ce à quoi le développeur Jack-Josias pensait en voulant creer ce code:
               *  - Créer un outil complet et convivial pour visualiser et analyser les journaux.
               *  - Fournir une interface claire et intuitive pour faciliter le débogage et la surveillance.
               *  - Intégrer des graphiques interactifs pour une meilleure compréhension des données.
               *  - Permettre aux utilisateurs de filtrer et de trier les journaux selon différents critères.
               

            ☑️ Dans le contexte de ce composant, on pourrait envisager son application de la manière suivante :

               - Entités : Ce sont les objets métier de votre application, par exemple les objets `LogEntry`. Ils représentent les concepts clés et ne dépendent d'aucune couche externe.
               - Cas d'utilisation : Ce sont les actions que les utilisateurs peuvent effectuer dans l'application, comme `filterLogs`, `downloadLogs` ou `clearLogs`. Ils interagissent avec les entités et les passerelles.
               - Passerelles (Gateways) : Elles permettent d'accéder aux données externes, comme la fonction `useLogger` qui récupère les journaux.
               - Présentateurs : Ils formattent les données pour l'affichage dans l'interface utilisateur. Ici, les fonctions `getLogOverTimeChartData` et autres fonctions similaires agissent comme des présentateurs.
               - Interface utilisateur : C'est la partie visible de l'application. Le JSX dans ce composant représente l'interface utilisateur.


   👉🏽 *** src\utils\Logger-Interface\service\clientLogger\clientLogger.ts ***
   
            ☑️ Ce code implémente un système de journalisation universel (cote client en regroupant s'il y'en a les LOGS 'Server' egalement par appel API pour intrroger les logs server) pour une application Next.js. Il utilise IndexedDB pour stocker les logs côté client et une API pour les logs côté serveur.

            
            ☑️ **Fonctionnement:**

                  1. **Initialisation:**  Lors de l'initialisation, le `ClientLogger` crée une base de données IndexedDB nommée "UniversalLoggerDB" s'il n'en existe pas déjà. Il crée également un magasin d'objets "logs" avec des index pour optimiser les recherches par timestamp, clé et hash.

                  2. **Enregistrement des logs:**  Les méthodes `log`, `info`, `warn`, `error` et `debug` permettent d'enregistrer des logs avec différents niveaux de gravité.  Chaque log est enregistré dans IndexedDB (si disponible) et dans un tableau en mémoire. Un hash unique est généré pour chaque log afin d'éviter les doublons.  Avant l'enregistrement d'un nouveau log, on vérifie s'il existe déjà via son hash. Si oui, on ne l'enregistre pas.

                  3. **Récupération des logs:**  La méthode `getLogs` permet de récupérer tous les logs, en combinant les logs client (depuis IndexedDB) et les logs serveur (depuis l'API). Les logs sont triés par timestamp du plus récent au plus ancien.

                  4. **Suppression des logs:**  La méthode `clearLogs` permet de supprimer tous les logs client (IndexedDB) et serveur (via une requête `DELETE` à l'API).

                  5. **Limite et nettoyage des logs:**  Le code implémente une logique pour limiter le nombre de logs stockés (en mémoire et dans IndexedDB) via `maxLogs` et pour supprimer les logs plus anciens que `maxAgeInDays`. Ce nettoyage est effectué dans la méthode `cleanupOldLogs` lors de l'initialisation et dans la méthode `limitLogs` après chaque ajout de log.

                  6. **Écouteurs d'événements:**  La méthode `addListener` permet d'ajouter des écouteurs qui seront notifiés à chaque fois qu'un log est ajouté.



               ☑️ **Pensées du développeur (Jack-Josias):**

                     Le développeur a probablement voulu créer un système de journalisation robuste et performant, capable de gérer un grand volume de logs et de faciliter le débogage des applications Next.js. L'utilisation d'IndexedDB permet de stocker les logs côté client même hors ligne, tandis que l'API serveur permet de centraliser les logs et de les analyser plus facilement. L'accent a été mis sur la performance (index, limitation du nombre de logs) et l'évolutivité (architecture client/serveur).


               ☑️ **Impact du code:**

                     **Positif:**

                     * **Débogage facilité:**  Les logs permettent de suivre l'exécution du code et d'identifier les erreurs plus facilement.
                     
                     * **Analyse des données:**  Les logs peuvent être utilisés pour analyser le comportement des utilisateurs et améliorer l'application.
                     
                     * **Surveillance:**  Les logs permettent de surveiller l'état de l'application et de détecter les problèmes en temps réel.



   👉🏽 *** src\utils\Logger-Interface\service\clientLogger\index.ts ***
                  

```






#### Pour analyser les dépendances et les commandes `npm` nécessaires pour LANCER le [Logger-Interface], voici un résumé des dépendances utilisées


#### Dépendances à installer :

**Pour l'interface utilisateur (front-end):**

1. **React et ReactDOM:**
   - `npm install react react-dom@latest`
   - Fournit le framework React pour construire l'interface utilisateur.

2. **Chart.js:**
   - `npm install chart.js@latest`
   - Bibliothèque JavaScript pour créer des graphiques interactifs.

3. **react-chartjs-2:**
   - `npm install react-chartjs-2@latest`
   - Permet d'intégrer facilement Chart.js dans des applications React.

4. **date-fns:**
   - `npm install date-fns@latest`
   - Bibliothèque pour la manipulation des dates et heures en JavaScript.

5. **react-bootstrap:**
   - `npm install react-bootstrap@latest`
   - Fournit des composants Bootstrap stylisés pour React.

6. **chartjs-adapter-date-fns:**
   - `npm install chartjs-adapter-date-fns@latest`
   - Adaptateur pour utiliser date-fns avec Chart.js.

7. **uuid:**
   - `npm install uuid@latest`
   - Génère des identifiants uniques universels (UUID).

**Pour le stockage local (IndexedDB):**

8. **idb:**
   - `npm install idb@latest`
   - Bibliothèque pour interagir avec IndexedDB, une base de données locale dans le navigateur.

**Pour la gestion des fichiers (Node.js):**

9. **fs:**
   - `npm install fs@latest`
   - Module Node.js pour interagir avec le système de fichiers.

10. **path:**
    - `npm install path@latest`
    - Module Node.js pour travailler avec les chemins de fichiers.

**Autres commandes:**

11. **Mise à jour de npm:**
    - `npm install -g npm@latest`
    - Met à jour npm vers la dernière version.

12. **Mise à jour des dépendances:**
    - `npm update --legacy-peer-deps`
    - Met à jour les dépendances du projet.

13. **Audit de sécurité:**
    - `npm audit`
    - Vérifie les dépendances pour détecter les vulnérabilités de sécurité.

**Remarques:**

* L'option `--save` (ou `-S`) ajoute les dépendances à la section `dependencies` du fichier `package.json`.
* L'option `--legacy-peer-deps` peut être nécessaire pour résoudre les conflits de dépendances.
* Vous pouvez combiner plusieurs commandes d'installation en une seule ligne, comme indiqué dans les exemples de votre liste initiale.



## Commandes [npm] pour installer DIRECTEMENT les dépendances utile pour lancer le [Logger-Interface]

    1 -> npm install -g npm@latest

    2 -> npm install react react-dom@latest chart.js@latest react-chartjs-2@latest date-fns@latest react-bootstrap@latest  uuid@latest chartjs-adapter-date-fns@latest --save  --legacy-peer-deps

    3 -> npm install idb@latest uuid@latest fs@latest path@latest --save  --legacy-peer-deps

    4 -> npm update --legacy-peer-deps

    5 -> npm audit