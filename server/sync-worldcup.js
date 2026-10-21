require('dotenv').config();
const axios = require('axios');
const db = require('./db');

async function syncCalendar() {
  try {
    console.log("🌍 Récupération du calendrier de la Coupe du Monde...");

    const response = await axios.get('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': process.env.API_KEY }
    });

    const matches = response.data.matches;

    if (!matches || matches.length === 0) {
      console.log("⚠️ Aucun match trouvé pour la Coupe du Monde sur l'API.");
      return;
    }

    let count = 0;

    // On utilise une boucle for...of pour respecter l'asynchrone de PostgreSQL
    for (const match of matches) {
      const hTeam = match.homeTeam?.name || 'À définir';
      const aTeam = match.awayTeam?.name || 'À définir';
      const id_api = match.id;
      const date = match.utcDate;

      let status = 'upcoming';
      if (['IN_PLAY', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(match.status)) status = 'live';
      if (match.status === 'FINISHED') status = 'finished';

      let nomGroupe = match.group || match.stage || 'Phase finale';
      if (nomGroupe === 'LAST_16') nomGroupe = 'Huitièmes de finale';
      if (nomGroupe === 'QUARTER_FINALS') nomGroupe = 'Quarts de finale';
      if (nomGroupe === 'SEMI_FINALS') nomGroupe = 'Demi-finales';
      if (nomGroupe === 'FINAL') nomGroupe = 'Finale';
      if (nomGroupe === 'THIRD_PLACE') nomGroupe = 'Petite finale';
      if (nomGroupe.includes('GROUP_')) nomGroupe = nomGroupe.replace('GROUP_', 'Groupe ');

      const stadium = match.venue || '';

      // Utilisation de db.query à la place de db.prepare
      await db.query(`
        INSERT INTO matches (id_api, home_team, away_team, date, status, score_home, score_away, group_name, stadium) 
        VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7)
        ON CONFLICT(id_api) 
        DO UPDATE SET 
          date = EXCLUDED.date, 
          status = CASE 
            WHEN EXCLUDED.status = 'upcoming' AND matches.status IN ('live', 'finished') THEN matches.status 
            ELSE EXCLUDED.status 
          END, 
          home_team = EXCLUDED.home_team, 
          away_team = EXCLUDED.away_team,
          group_name = EXCLUDED.group_name,
          stadium = EXCLUDED.stadium
      `, [id_api, hTeam, aTeam, date, status, nomGroupe, stadium]);

      count++;
    }

    console.log(`✅ Succès : ${count} matchs synchronisés avec la base de données Supabase !`);

  } catch (erreur) {
    console.error("❌ Erreur de synchronisation :", erreur.response?.data || erreur.message);
  }
}

// Lancement immédiat de la fonction au démarrage
syncCalendar();

// 🔥 MODIFICATION : On relance la synchronisation automatiquement toutes les 2 heures (7200000 millisecondes)
setInterval(syncCalendar, 7200000);

// On exporte la fonction au cas où tu voudrais la lancer depuis index.js plus tard
module.exports = syncCalendar;