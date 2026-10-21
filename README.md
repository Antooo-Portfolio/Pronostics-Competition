# 🏆 Coupe du Monde 2026 — Plateforme de Pronostics & Compétition

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-WebSockets-010101?logo=socket.io&logoColor=white)](https://socket.io/)

> **Application web moderne de pronostics sportifs conçue à l'origine pour animer une compétition interne en entreprise lors de la Coupe du Monde.**  
> Cette version est une **version de démonstration publique et anonymisée** (sans données d'entreprise ni données personnelles), déployable de manière 100 % autonome.

🔗 **Démo en ligne disponible sur mon Portfolio :**  
👉 **[portfolio.antonyrodrigues.fr/Pronostics-Competition](https://portfolio.antonyrodrigues.fr/Pronostics-Competition)**

---

## 🌟 Fonctionnalités Clés

### 1. 🔮 Système de Pronostics Dynamique
* Saisie et modification des pronostics sur l'ensemble des matchs officiels de la Coupe du Monde 2026.
* Calcul automatisé des points selon un barème équitable et compétitif :
  * **+4 pts** : Score exact
  * **+3 pts** : Bonne différence de buts
  * **+2 pts** : Bon vainqueur (ou bon match nul)
  * **0 pt** : Mauvais pronostic
* Multiplicateurs de points selon l'importance des phases finales (Groupes x1, Huitièmes x2, Quarts/Demis x3, Finale x5).
* Possibilité d'inspecter les pronostics des autres joueurs une fois les matchs démarrés ou terminés.

### 2. 📊 Compétition, Groupes & Bracket interactif
* **Classement des groupes (A à L)** : calculé en temps réel à partir des résultats (Matchs joués, Victoires, Nuls, Défaites, Buts pour, Buts contre, Différence de buts, Points).
* **Tableau des phases finales (Brackets)** : visualisation complète des seizièmes de finale jusqu'à la grande finale.
* **Statistiques du tournoi** : total des buts inscrits, moyenne par match, meilleurs buteurs et meilleurs passeurs.
* **Historique par équipe** : fiche détaillée retraçant les confrontations et résultats de chaque nation.

### 3. 🏆 Leaderboard & Gamification
* Classement général dynamique avec gestion rigoureuse des critères de départage :
  1. Total de points
  2. Nombre de scores exacts
  3. Nombre de bonnes différences de buts
  4. Nombre de bons vainqueurs
* Questions bonus d'avant-tournoi (Vainqueur final, Meilleur buteur, Nombre de buts total, Équipe surprise).

### 4. 💬 Messagerie d'Ambiance en Direct (Chat)
* Espace de discussion interactif permettant aux participants d'échanger sur les matchs.
* Réactions avec émojis (👍, ❤️, 😂, 😮, 😢).
* En mode démo, simulation de réponses et d'interactions pour une expérience vivante.

### 5. ⚙️ Espace d'Administration
* Mise à jour des scores en direct (À venir, En direct, Terminé).
* Résolution des questions bonus.
* Gestion manuelle des passeurs décisifs.
* Switch rapide en un clic entre **Mode Visiteur** et **Mode Administrateur** pour tester toutes les fonctionnalités sans restriction.

---

## 🏗️ Architecture Technique

Le projet a été pensé pour fonctionner dans deux configurations distinctes :

### Mode A : Démo Autonome « Zero-Server » *(Actif par défaut sur OVHcloud)*
* **Frontend** : React 18, Vite, Vanilla CSS avec design system sombre et doré (Glassmorphism & animations micro-interactives).
* **Stockage local** : Moteur `mockService.js` simulant l'ensemble de la base de données et des événements WebSockets directement dans le `localStorage` du visiteur.
* **Avantages** : Zéro coût d'infrastructure, zéro maintenance de base de données, 100 % de disponibilité et chargement ultra-rapide (< 100 ms).
* **Hébergement** : Compatible avec n'importe quel hébergement statique (Apache OVHcloud, Nginx, GitHub Pages, Netlify).

### Mode B : Architecture Fullstack Entreprise *(Code source disponible dans `server/`)*
* **Backend** : Node.js, Express, Socket.io (synchronisation bidirectionnelle en temps réel).
* **Base de données** : PostgreSQL (initialement hébergée sur Supabase), requêtes SQL optimisées avec pools de connexions `pg`.
* **Sécurité & Auth** : Authentification JWT, hachage des mots de passe `bcryptjs`, limitation de débit `express-rate-limit`.
* **Intégration API** : Synchronisation automatique des calendriers et scores officiels via l'API `football-data.org`.

---

## 📁 Structure du Projet

```text
├── client/                     # Application Frontend React (Vite)
│   ├── public/
│   │   ├── .htaccess           # Configuration Apache pour hébergement OVH
│   │   ├── logo.png            # Logo de la compétition
│   │   └── ...
│   ├── src/
│   │   ├── components/         # Composants réutilisables (MatchCard, Chat, Bracket, UI)
│   │   ├── api.js              # Couche d'abstraction API (Backend réel ou Mock)
│   │   ├── demoData.js         # Données d'exemple anonymisées (Matchs 2026, Leaderboard)
│   │   ├── mockService.js      # Moteur de simulation autonome (localStorage)
│   │   ├── constants.js        # Équipes et effectifs de joueurs
│   │   ├── utils.js            # Algorithmes de calcul des points et drapeaux
│   │   ├── styles.js           # Design tokens et palettes de couleurs
│   │   └── App.jsx             # Composant racine
│   ├── package.json
│   └── vite.config.js          # Configuration Vite avec sous-chemin (/Pronostics-Competition/)
│
├── server/                     # Serveur Backend (Node.js / Express / Socket.io)
│   ├── routes/                 # Endpoints REST (auth, matches, predictions, bonus, chat, stats)
│   ├── middleware/             # Middleware de validation JWT
│   ├── db.js                   # Connexion PostgreSQL (pg Pool)
│   ├── sync-worldcup.js        # Script de synchronisation automatique avec football-data.org
│   ├── index.js                # Point d'entrée du serveur Express & WebSockets
│   └── package.json
│
├── matches.json                # Données brutes du calendrier officiel Coupe du Monde 2026
├── .gitignore                  # Fichiers et dossiers exclus du contrôle de version
└── README.md                   # Documentation du projet
```

---

## 🚀 Démarrage en Local

### 1. Cloner le projet
```bash
git clone https://github.com/VOTRE_PSEUDO/worldcup-predictions-demo.git
cd worldcup-predictions-demo
```

### 2. Lancer le Frontend (Mode Démo)
```bash
cd client
npm install
npm run dev
```
Ouvrez votre navigateur à l'adresse indiquée (ex: `http://localhost:5173/Pronostics-Competition/`). L'application est immédiatement fonctionnelle sans aucune dépendance externe.

### 3. (Optionnel) Lancer avec le Backend réel
1. Rendez-vous dans le dossier `server/` :
   ```bash
   cd server
   npm install
   ```
2. Créez un fichier `.env` basé sur `.env.example` :
   ```env
   PORT=3001
   DATABASE_URL=postgresql://votre_utilisateur:votre_mdp@localhost:5432/worldcup_db
   JWT_SECRET=votre_cle_jwt_secrete
   ```
3. Démarrez le serveur :
   ```bash
   npm run dev
   ```
4. Dans `client/.env`, configurez l'adresse de votre API :
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_DEMO_MODE=false
   ```

---

## 📦 Déploiement sur OVH Cloud (Sous-dossier de Portfolio)

1. **Générer le bundle de production :**
   ```bash
   cd client
   npm run build
   ```
2. **Transférer les fichiers sur votre espace OVH (FTP / FileZilla) :**
   - Connectez-vous à votre hébergement mutualisé OVH.
   - Rendez-vous dans le répertoire racine de votre sous-domaine `portfolio.antonyrodrigues.fr` (souvent `www/portfolio` ou `portfolio`).
   - Créez le dossier `Pronostics-Competition/`.
   - Copiez l'intégralité du contenu généré dans `client/dist/` (y compris le fichier `.htaccess` et le dossier `assets/`) dans ce répertoire.
3. **Accédez à l'application :**
   👉 `https://portfolio.antonyrodrigues.fr/Pronostics-Competition/`

---

## 👤 Auteur & Contact

**Antony Rodrigues**
* Portfolio : [portfolio.antonyrodrigues.fr](https://portfolio.antonyrodrigues.fr)
* Domaine : [antonyrodrigues.fr](https://antonyrodrigues.fr)
