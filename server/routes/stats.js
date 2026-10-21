const express = require('express');
const axios = require('axios');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

let cachedScorers = null;
let lastFetch = 0;

router.get('/scorers', async (req, res) => {
  try {
    // Cache permanent, vidé manuellement à la fin d'un match
    if (cachedScorers) {
      return res.json(cachedScorers);
    }
    const response = await axios.get('https://api.football-data.org/v4/competitions/WC/scorers?limit=100', {
      headers: { 'X-Auth-Token': process.env.API_KEY },
      timeout: 5000
    });
    cachedScorers = response.data.scorers;
    res.json(cachedScorers);
  } catch (err) {
    console.error("Erreur stats scorers:", err.message);
    if (cachedScorers) {
        return res.json(cachedScorers);
    }
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.clearCache = () => {
  cachedScorers = null;
};

// --- GET Manual Assists ---
router.get('/assists', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM manual_assists ORDER BY assists DESC, player_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur GET assists:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- POST Manual Assist (Admin) ---
router.post('/assists', authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: "Accès refusé" });
    const { player_name, team_name, assists } = req.body;
    
    const exist = await db.query('SELECT id FROM manual_assists WHERE player_name = $1', [player_name]);
    if (exist.rowCount > 0) {
      await db.query('UPDATE manual_assists SET team_name = $1, assists = $2 WHERE player_name = $3', [team_name, assists, player_name]);
    } else {
      await db.query('INSERT INTO manual_assists (player_name, team_name, assists) VALUES ($1, $2, $3)', [player_name, team_name, assists]);
    }
    const result = await db.query('SELECT * FROM manual_assists ORDER BY assists DESC, player_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur POST assists:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- DELETE Manual Assist (Admin) ---
router.delete('/assists/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user.is_admin) return res.status(403).json({ error: "Accès refusé" });
    await db.query('DELETE FROM manual_assists WHERE id = $1', [req.params.id]);
    const result = await db.query('SELECT * FROM manual_assists ORDER BY assists DESC, player_name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur DELETE assists:", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
