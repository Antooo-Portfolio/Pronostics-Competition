require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
app.set('trust proxy', 1); // Indispensable pour Render (ou tout proxy) avec express-rate-limit
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://antonyrodrigues.fr',
  'https://portfolio.antonyrodrigues.fr',
  process.env.CLIENT_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  },
});

app.set('io', io);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Trop de tentatives, réessaie dans 15 minutes.' }
});

app.use('/api/auth/login', limiter);
app.use('/api/auth/change-password', limiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/bonus', require('./routes/bonus'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/stats', require('./routes/stats'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

const deviceConnections = new Map();
const socketDeviceMap = new Map();
const deviceUserMap = new Map();

function broadcastOnline() {
  const users = [];
  let anonymousCount = 0;
  let adminDevicesCount = 0;

  for (const [deviceId, count] of deviceConnections.entries()) {
    const user = deviceUserMap.get(deviceId);
    if (user) {
      if (user.is_admin) {
        adminDevicesCount++;
      } else {
        users.push(user);
      }
    } else {
      anonymousCount++;
    }
  }

  const uniqueUsers = [];
  const seenIds = new Set();
  for (const u of users) {
    if (!seenIds.has(u.id)) {
      seenIds.add(u.id);
      uniqueUsers.push({ id: u.id, username: u.username, login: u.login });
    }
  }

  io.emit('online_users', {
    count: uniqueUsers.length + anonymousCount,
    users: uniqueUsers,
    anonymousCount: anonymousCount
  });
}

io.on('connection', socket => {
  const deviceId = socket.handshake.auth?.deviceId || socket.handshake.address;
  socketDeviceMap.set(socket.id, deviceId);

  const currentCount = deviceConnections.get(deviceId) || 0;
  deviceConnections.set(deviceId, currentCount + 1);

  broadcastOnline();
  console.log('🔌 Nouveau client connecté :', socket.id, 'Appareils uniques:', deviceConnections.size);

  socket.on('set_user', (userData) => {
    if (userData) {
      deviceUserMap.set(deviceId, userData);
    } else {
      deviceUserMap.delete(deviceId);
    }
    broadcastOnline();
  });

  socket.on('disconnect', () => {
    const dId = socketDeviceMap.get(socket.id);
    if (dId) {
      let count = deviceConnections.get(dId) || 0;
      count--;
      if (count <= 0) {
        deviceConnections.delete(dId);
        deviceUserMap.delete(dId);
      } else {
        deviceConnections.set(dId, count);
      }
      socketDeviceMap.delete(socket.id);
    }

    broadcastOnline();
    console.log('❌ Client déconnecté :', socket.id, 'Appareils uniques:', deviceConnections.size);
  });
});

const PORT = process.env.PORT || 3001;

// --- MISE À JOUR DU CALENDRIER (Maintenance) ---
async function updateFullCalendar() {
  try {
    console.log("🌍 [Mise à jour calendrier] Actualisation...");
    const response = await axios.get('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': process.env.API_KEY }
    });

    const apiMatches = response.data.matches;
    for (const match of apiMatches) {
      await db.query(`
        UPDATE matches 
        SET home_team = $1, away_team = $2, date = $3 
        WHERE id_api = $4
      `, [match.homeTeam?.name || 'À définir', match.awayTeam?.name || 'À définir', match.utcDate, match.id]);
    }
    console.log("✅ Calendrier global mis à jour !");
  } catch (err) {
    console.error("❌ Erreur calendrier :", err.message);
  }
}

// Mise à jour automatique du calendrier toutes les 2 heures
cron.schedule('0 */2 * * *', async () => {
  console.log("⏰ Exécution de la mise à jour périodique du calendrier (toutes les 2h)...");
  await updateFullCalendar();
});

// --- ROBOT LIVE (Auto-détection) ---
// --- 🤖 ROBOT LIVE FOOTBALL-DATA.ORG ---
cron.schedule('*/5 * * * * *', async () => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatDate = (d) => d.toISOString().split('T')[0];
    const dateFrom = formatDate(yesterday);
    const dateTo = formatDate(tomorrow);

    const response = await axios.get(`https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
      headers: { 'X-Auth-Token': process.env.API_KEY },
      timeout: 10000
    });

    const apiMatches = response.data.matches;
    if (!apiMatches) return;

    let aChange = false;
    let aScoreChanged = false;
    let unMatchEstFini = false;

    for (const apiMatch of apiMatches) {
      if (apiMatch.competition.code === 'WC' || apiMatch.competition.code === 'CL') {
        const hTeam = apiMatch.homeTeam?.name || 'À définir';
        const aTeam = apiMatch.awayTeam?.name || 'À définir';
        const status = apiMatch.status;

        // Stratégie 100% fiable pour récupérer le bon score du match (hors tirs au but)
        // 1. On prend le fullTime (et on déduit les pénos car l'API les inclut dedans)
        // 2. En fallback, on additionne regularTime + extraTime
        const hFull = apiMatch.score.fullTime?.home;
        const aFull = apiMatch.score.fullTime?.away;
        const hReg = apiMatch.score.regularTime?.home;
        const aReg = apiMatch.score.regularTime?.away;
        const hExtra = apiMatch.score.extraTime?.home;
        const aExtra = apiMatch.score.extraTime?.away;
        const pHome = apiMatch.score.penalties?.home ?? 0;
        const pAway = apiMatch.score.penalties?.away ?? 0;

        let hScore = null;
        let aScore = null;

        if (hFull !== undefined && hFull !== null) {
          hScore = hFull;
          aScore = aFull;

          // L'API football-data v4 inclut les tirs au but dans le fullTime
          // On vérifie la déduction des pénos (ex: mène à une égalité)
          if ((pHome > 0 || pAway > 0) && (hScore - pHome === aScore - pAway)) {
            hScore -= pHome;
            aScore -= pAway;
          }
        } else if (hReg !== undefined && hReg !== null) {
          hScore = hReg;
          aScore = aReg;
          if (hExtra !== undefined && hExtra !== null) {
            hScore += hExtra;
            aScore += aExtra;
          }
        }

        const checkResult = await db.query('SELECT id, score_home, score_away, stoppage_time_start, period_start_time, base_minute, minute, status FROM matches WHERE id_api = $1', [apiMatch.id]);
        let dbStoppageStart = checkResult.rowCount > 0 ? checkResult.rows[0].stoppage_time_start : null;
        let newStoppageStart = dbStoppageStart;

        let periodStartTime = checkResult.rowCount > 0 ? checkResult.rows[0].period_start_time : null;
        let baseMinute = checkResult.rowCount > 0 ? checkResult.rows[0].base_minute : 0;
        let lastMinuteStr = checkResult.rowCount > 0 ? checkResult.rows[0].minute : null;

        // 🕒 On capte la minute de jeu (si fournie ou calculée)
        let minuteStr = null;
        if (apiMatch.minute) {
          if (apiMatch.injuryTime && status === 'IN_PLAY') {
            if (!dbStoppageStart) {
              newStoppageStart = new Date();
              dbStoppageStart = newStoppageStart;
            }
            const elapsedMs = new Date() - new Date(dbStoppageStart);
            const elapsedMins = Math.floor(elapsedMs / 60000);
            // On cap l'incrément au maximum à (injuryTime + 2) au cas où le match ne se termine pas
            const increment = Math.min(elapsedMins, apiMatch.injuryTime + 2);
            const simulatedMinute = apiMatch.minute + increment;
            minuteStr = `${simulatedMinute}' (+${apiMatch.injuryTime}')`;
          } else {
            if (apiMatch.injuryTime) {
              minuteStr = `${apiMatch.minute}+${apiMatch.injuryTime}'`;
            } else {
              minuteStr = `${apiMatch.minute}'`;
            }
            newStoppageStart = null;
          }
        } else {
          // L'API ne fournit pas la minute, on la calcule avec notre propre chronomètre
          if (status === 'IN_PLAY') {
            if (!periodStartTime || lastMinuteStr === 'MT') {
              periodStartTime = new Date();
              if (lastMinuteStr === 'MT') {
                if (baseMinute === 0) baseMinute = 45;
                else if (baseMinute === 45) baseMinute = 90;
                else if (baseMinute === 90) baseMinute = 105;
              } else {
                baseMinute = 0;
              }
            }

            const elapsedMins = Math.floor((new Date() - new Date(periodStartTime)) / 60000);
            const currentMin = baseMinute + elapsedMins;

            if (baseMinute === 0 && currentMin > 45) {
              minuteStr = `45+${currentMin - 45}'`;
            } else if (baseMinute === 45 && currentMin > 90) {
              minuteStr = `90+${currentMin - 90}'`;
            } else if (baseMinute === 90 && currentMin > 105) {
              minuteStr = `105+${currentMin - 105}'`;
            } else if (baseMinute === 105 && currentMin > 120) {
              minuteStr = `120+${currentMin - 120}'`;
            } else {
              minuteStr = `${currentMin}'`;
            }
            newStoppageStart = null;
          } else if (status === 'PAUSED') {
            minuteStr = 'MT'; // Mi-temps
            periodStartTime = null;
            newStoppageStart = null;
          }
        }

        const isLive = ['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(status);
        const isFinished = status === 'FINISHED';
        let localStatus = isFinished ? 'finished' : (isLive ? 'live' : 'upcoming');

        // Empêcher un match de repasser de 'live' ou 'finished' à 'upcoming' si l'API vacille sur 'TIMED' ou 'SCHEDULED'
        if (localStatus === 'upcoming' && ['TIMED', 'SCHEDULED'].includes(apiMatch.status) && checkResult.rowCount > 0) {
          const dbStatus = checkResult.rows[0].status;
          if (dbStatus === 'live' || dbStatus === 'finished') {
            localStatus = dbStatus;
          }
        }

        // Si l'API renvoie null pour le score (pas encore mis à jour de leur côté), on garde celui en BDD
        if (hScore === null || aScore === null) {
          if (checkResult.rowCount > 0) {
            hScore = checkResult.rows[0].score_home;
            aScore = checkResult.rows[0].score_away;
          } else {
            hScore = 0;
            aScore = 0;
          }
        }

        // Si le match n'existe pas, on l'insère (avec la minute)
        if (checkResult.rowCount === 0) {
          await db.query(`
            INSERT INTO matches (id_api, home_team, away_team, date, status, score_home, score_away, group_name, minute, stoppage_time_start, period_start_time, base_minute) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [apiMatch.id, hTeam, aTeam, apiMatch.utcDate, localStatus, hScore, aScore, apiMatch.competition.name, minuteStr, newStoppageStart, periodStartTime, baseMinute]);

          aChange = true;
          aScoreChanged = true;
          console.log(`🆕 Nouveau match ajouté tout seul : ${hTeam} vs ${aTeam}`);
        }

        let hasScoreOrStatusChanged = false;
        if (checkResult.rowCount > 0) {
            const old = checkResult.rows[0];
            if (old.score_home !== hScore || old.score_away !== aScore || old.status !== localStatus) {
                hasScoreOrStatusChanged = true;
            }
        } else {
            hasScoreOrStatusChanged = true;
        }

        // On met à jour le score, le statut et la minute dans tous les cas pour forcer la synchronisation
        const result = await db.query(`
          UPDATE matches 
          SET score_home = $1, score_away = $2, status = $3, minute = $4, stoppage_time_start = $5, period_start_time = $6, base_minute = $7
          WHERE id_api = $8 
          AND (score_home != $9 OR score_away != $10 OR status != $11 OR minute IS DISTINCT FROM $12 OR stoppage_time_start IS DISTINCT FROM $13 OR period_start_time IS DISTINCT FROM $14 OR base_minute != $15)
          RETURNING *;
        `, [hScore, aScore, localStatus, minuteStr, newStoppageStart, periodStartTime, baseMinute, apiMatch.id, hScore, aScore, localStatus, minuteStr, newStoppageStart, periodStartTime, baseMinute]);

        if (result.rowCount > 0) {
          aChange = true;
          if (hasScoreOrStatusChanged) {
            aScoreChanged = true;
          }
          if (isFinished) unMatchEstFini = true;
          
          // Emettre l'événement pour CE match spécifique
          io.emit('match_updated', result.rows[0]);
        }
      }
    }

    if (unMatchEstFini) {
      console.log("⏱️ Match terminé détecté ! Programmation de la MAJ des buteurs et du calendrier dans 15 min...");
      setTimeout(async () => {
        console.log("🔄 Mise à jour des buteurs et du calendrier (15 min après le match)...");
        require('./routes/stats').clearCache();
        await updateFullCalendar();
        io.emit('score_updated'); // pour déclencher fetch global au cas où
        io.emit('leaderboard_updated');
      }, 15 * 60 * 1000); // 15 minutes en millisecondes
    }

    if (aChange) {
      if (aScoreChanged) {
        io.emit('leaderboard_updated');
      }
      console.log('✅ Base de données et site mis à jour !');
    }

  } catch (erreur) {
    console.error("❌ CRASH DU ROBOT :", erreur.response?.status || erreur.message);
  }
});

server.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur le port ${PORT}`);
}).on('error', (err) => {
  console.error('❌ Erreur démarrage serveur :', err);
  process.exit(1);
});
