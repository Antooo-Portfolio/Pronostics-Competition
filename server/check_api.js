require('dotenv').config();
const axios = require('axios');

async function checkApi() {
  try {
    console.log("⏳ Interrogation de l'API football-data.org en cours...\n");
    const response = await axios.get('https://api.football-data.org/v4/competitions/WC/matches', {
      headers: { 'X-Auth-Token': process.env.API_KEY }
    });

    const matches = response.data.matches;
    
    // On ne garde que les matchs d'aujourd'hui et demain pour que ce soit lisible
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentMatches = matches.filter(m => new Date(m.utcDate) >= yesterday);

    console.log("📊 STATUTS BRUTS DE L'API POUR LES MATCHS ACTUELS :\n");
    
    recentMatches.slice(0, 10).forEach(m => {
      const home = m.homeTeam?.name || 'À définir';
      const away = m.awayTeam?.name || 'À définir';
      
      // On convertit l'heure UTC en heure locale pour la lecture
      const dateLocale = new Date(m.utcDate).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
      
      console.log(`➡️ ${home} vs ${away}`);
      console.log(`   Date  : ${dateLocale}`);
      console.log(`   Statut: ${m.status}`);
      if (m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined) {
         console.log(`   Score : ${m.score.fullTime.home} - ${m.score.fullTime.away}`);
      }
      console.log('-----------------------------------');
    });

  } catch (error) {
    console.error("❌ Erreur lors de l'appel à l'API :", error.message);
  }
}

checkApi();
