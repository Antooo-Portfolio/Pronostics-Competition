const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const router = express.Router();

// On va récupérer la date du premier match dynamiquement depuis la BDD

// GET /api/bonus - Récupérer les questions et les réponses du joueur
router.get('/', async (req, res) => {
  try {
    const questionsObj = await db.query('SELECT * FROM bonus_questions ORDER BY id ASC');
    
    // Si connecté on récupère ses réponses, sinon tableau vide
    let predMap = {};
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      try {
        const token = header.split(' ')[1];
        const user = jwt.verify(token, process.env.JWT_SECRET);
        const predsObj = await db.query('SELECT * FROM bonus_predictions WHERE user_id = $1', [user.id]);
        predsObj.rows.forEach(p => { predMap[p.question_id] = p.predicted_answer; });
      } catch { /* token invalide, on ignore */ }
    }

    // Date limite : le premier match
    const firstMatchRes = await db.query('SELECT MIN(date) as first_match_date FROM matches');
    let dateLimite = new Date(process.env.TOURNAMENT_START_DATE || '2026-06-11T21:00:00Z');
    if (firstMatchRes.rows[0] && firstMatchRes.rows[0].first_match_date) {
      dateLimite = new Date(firstMatchRes.rows[0].first_match_date);
    }

    res.json({
      questions: questionsObj.rows,
      myAnswers: predMap,
      canPredict: new Date() < dateLimite
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/bonus - Sauvegarder ou modifier une réponse
router.post('/', auth, async (req, res) => {
  try {
    // Date limite : le premier match
    const firstMatchRes = await db.query('SELECT MIN(date) as first_match_date FROM matches');
    let dateLimite = new Date(process.env.TOURNAMENT_START_DATE || '2026-06-11T21:00:00Z');
    if (firstMatchRes.rows[0] && firstMatchRes.rows[0].first_match_date) {
      dateLimite = new Date(firstMatchRes.rows[0].first_match_date);
    }

    if (new Date() >= dateLimite) {
      return res.status(400).json({ error: "Trop tard ! La compétition a commencé." });
    }

    const { question_id, answer } = req.body;
    if (answer === undefined || answer === null || answer.toString().trim() === '') {
      await db.query(`DELETE FROM bonus_predictions WHERE user_id = $1 AND question_id = $2`, [req.user.id, question_id]);
      return res.json({ ok: true });
    }

    // Le fameux UPSERT de PostgreSQL pour créer ou mettre à jour
    await db.query(`
      INSERT INTO bonus_predictions (user_id, question_id, predicted_answer)
      VALUES ($1, $2, $3)
      ON CONFLICT(user_id, question_id) DO UPDATE SET predicted_answer = $4
    `, [req.user.id, question_id, answer.toString().trim(), answer.toString().trim()]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT /api/bonus/admin/resolve - Administrateur définit la réponse d'un bonus
router.put('/admin/resolve', auth, async (req, res) => {
  try {
    if (req.user.is_admin !== 1) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    
    const { question_id, real_answer, status } = req.body;
    
    if (!question_id) return res.status(400).json({ error: "Question manquante" });

    await db.query(
      `UPDATE bonus_questions SET real_answer = $1, status = $2 WHERE id = $3`,
      [real_answer || null, status || 'pending', question_id]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;