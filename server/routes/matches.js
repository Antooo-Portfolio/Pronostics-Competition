const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Récupérer tous les matchs
router.get('/', async (req, res) => {
  try {
    // ⚠️ On utilise db.query avec un 'await'
    const result = await db.query('SELECT * FROM matches ORDER BY date ASC');

    // ⚠️ PostgreSQL stocke les résultats dans un tableau appelé 'rows'
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur lors de la récupération des matchs :", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// (Optionnel) Si tu as une route pour récupérer un match spécifique
router.get('/:id', async (req, res) => {
  try {
    // ⚠️ Le '?' de SQLite devient '$1' dans PostgreSQL
    const result = await db.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);

    // On prend le premier élément du tableau 'rows'
    const match = result.rows[0];

    if (!match) return res.status(404).json({ error: 'Match introuvable' });
    res.json(match);
  } catch (err) {
    console.error("Erreur récupération match :", err.message);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch('/:id/score', auth, async (req, res) => {
  try {
    if (req.user.is_admin !== 1)
      return res.status(403).json({ error: 'Accès refusé. Réservé aux administrateurs.' });

    const { score_home, score_away, status } = req.body;

    if (score_home === undefined || score_away === undefined || !status)
      return res.status(400).json({ error: 'Données manquantes.' });

    const result = await db.query(
      'UPDATE matches SET score_home = $1, score_away = $2, status = $3 WHERE id = $4 RETURNING *',
      [score_home, score_away, status, req.params.id]
    );

    const io = req.app.get('io');
    if (result.rowCount > 0) {
      io.emit('match_updated', result.rows[0]);
    }
    io.emit('leaderboard_updated');

    if (status === 'finished') {
      setTimeout(() => {
        console.log("🔄 Mise à jour des buteurs suite à modification admin (15 min après)...");
        require('./stats').clearCache();
        io.emit('score_updated');
      }, 15 * 60 * 1000);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Erreur mise à jour score :', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/:id/api-status', auth, async (req, res) => {
  try {
    if (req.user.is_admin !== 1) return res.status(403).json({ error: 'Accès refusé.' });

    const matchRes = await db.query('SELECT id_api FROM matches WHERE id = $1', [req.params.id]);
    if (matchRes.rowCount === 0) return res.status(404).json({ error: 'Match introuvable' });
    const id_api = matchRes.rows[0].id_api;

    const axios = require('axios');
    const apiRes = await axios.get(`https://api.football-data.org/v4/matches/${id_api}`, {
      headers: { 'X-Auth-Token': process.env.API_KEY },
      timeout: 5000 // Timeout de 5 secondes
    });

    res.json({
      status: apiRes.data.status,
      score_home: apiRes.data.score?.fullTime?.home ?? null,
      score_away: apiRes.data.score?.fullTime?.away ?? null
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: "L'API officielle met trop de temps à répondre (Timeout)." });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;