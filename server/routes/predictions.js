const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function getMultiplier(groupName) {
  if (!groupName) return 1;
  const name = groupName.toLowerCase();
  if (name.includes('groupe')) {
    return 1;
  }
  if (name.includes('seizième') || name.includes('last_32') || name.includes('huitième')) {
    return 2;
  }
  if (name.includes('quart') || name.includes('demi') || name.includes('petite')) {
    return 3;
  }
  if (name.includes('finale')) {
    return 5;
  }
  return 1;
}

// Calcul des points
function calcPoints(predHome, predAway, scoreHome, scoreAway) {
  // 1. Score exact
  if (predHome === scoreHome && predAway === scoreAway) return 4;

  // Différences de buts
  const diffP = predHome - predAway;
  const diffS = scoreHome - scoreAway;

  // Vainqueur (H = Home, A = Away, D = Draw/Nul)
  const predWinner = predHome > predAway ? 'H' : predHome < predAway ? 'A' : 'D';
  const realWinner = scoreHome > scoreAway ? 'H' : scoreHome < scoreAway ? 'A' : 'D';

  // 2. Bon vainqueur (ou bon nul)
  if (predWinner === realWinner) {
    // 3. Différence de buts exacte
    if (diffP === diffS) {
      return 3;
    }
    // 4. Juste le bon vainqueur
    return 2;
  }

  // Mauvais pronostic
  return 0;
}

// GET /api/predictions/mine — mes pronostics
router.get('/mine', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM predictions WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/predictions — poser ou modifier un pronostic
router.post('/', auth, async (req, res) => {
  try {
    const { match_id, pred_home, pred_away } = req.body;

    const home = parseInt(pred_home, 10);
    const away = parseInt(pred_away, 10);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
      return res.status(400).json({ error: 'Score invalide. Les tricheurs sont punis !' });
    }

    // Vérifier si le match existe
    const matchResult = await db.query('SELECT * FROM matches WHERE id = $1', [match_id]);
    const match = matchResult.rows[0];
    if (!match) return res.status(404).json({ error: 'Match introuvable' });

    const matchDateTime = new Date(match.date);
    const maintenant = new Date();
    const isMatchStarted = match.status === 'live' || match.status === 'finished';

    if (maintenant >= matchDateTime || isMatchStarted) {
      return res.status(400).json({ error: 'Trop tard ! Le match est sur le point de commencer ou a déjà commencé.' });
    }

    // INSERT or UPDATE (Syntaxe PostgreSQL pour le conflit)
    await db.query(`
      INSERT INTO predictions (user_id, match_id, pred_home, pred_away)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(user_id, match_id) DO UPDATE SET pred_home = $5, pred_away = $6
    `, [req.user.id, match_id, home, away, home, away]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/predictions/leaderboard — classement de tous les joueurs
router.get('/leaderboard', async (req, res) => {
  try {
    const usersResult = await db.query('SELECT id, username, login, avatar FROM users WHERE is_admin = 0');
    const users = usersResult.rows;

    const matchesResult = await db.query("SELECT * FROM matches WHERE status IN ('finished', 'live')");
    const finishedMatches = matchesResult.rows;

    const allPredsResult = await db.query('SELECT * FROM predictions');
    const allPreds = allPredsResult.rows;

    // Récupération des questions terminées et des réponses bonus
    const bonusQuestions = await db.query("SELECT * FROM bonus_questions WHERE status = 'finished' AND real_answer IS NOT NULL");
    const allBonusPreds = await db.query("SELECT * FROM bonus_predictions");

    // Calculer les gagnants des questions 'number'
    const numberWinners = {};
    bonusQuestions.rows.forEach(bq => {
      const isNumberQuestion = bq.type === 'number' || (bq.question && bq.question.toLowerCase().includes('nombre'));
      if (isNumberQuestion) {
        const realAnswer = parseInt(bq.real_answer);
        if (!isNaN(realAnswer)) {
          let winners = [];
          allBonusPreds.rows.filter(bp => bp.question_id === bq.id).forEach(bp => {
            const predVal = parseInt(bp.predicted_answer);
            if (!isNaN(predVal) && predVal === realAnswer) {
              winners.push(bp.user_id);
            }
          });
          numberWinners[bq.id] = winners;
        }
      }
    });

    const leaderboard = users.map(u => {
      const preds = allPreds.filter(p => p.user_id === u.id);

      const predMap = {};
      preds.forEach(p => { predMap[p.match_id] = p; });

      // 🔥 MODIFICATION ICI : On prépare nos compteurs détaillés
      let total = 0, vainqueur = 0, difference = 0, exact = 0;

      finishedMatches.forEach(m => {
        const p = predMap[m.id];
        if (!p) return;

        const mult = getMultiplier(m.group_name);
        const pts = calcPoints(p.pred_home, p.pred_away, m.score_home, m.score_away);

        total += pts * mult;

        if (pts === 4) {
          exact++;
        } else if (pts === 3) {
          difference++;
        } else if (pts === 2) {
          vainqueur++;
        }
      });

      // Ajout des points bonus
      bonusQuestions.rows.forEach(bq => {
        const userBonusProno = allBonusPreds.rows.find(bp => bp.user_id === u.id && bp.question_id === bq.id);
        const isNumberQuestion = bq.type === 'number' || (bq.question && bq.question.toLowerCase().includes('nombre'));

        if (isNumberQuestion) {
          if (numberWinners[bq.id] && numberWinners[bq.id].includes(u.id)) {
            total += bq.points;
          }
        } else {
          // Vérification souple pour le texte
          if (userBonusProno && bq.real_answer.toLowerCase().includes(userBonusProno.predicted_answer.toLowerCase())) {
            total += bq.points;
          }
        }
      });

      // 🔥 MODIFICATION ICI : On renvoie vainqueur, difference et exact au Front-end
      return { ...u, total, vainqueur, difference, exact, played: finishedMatches.length };
    });

    leaderboard.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.exact !== a.exact) return b.exact - a.exact;
      if (b.difference !== a.difference) return b.difference - a.difference;
      if (b.vainqueur !== a.vainqueur) return b.vainqueur - a.vainqueur;
      const nameA = (a.username && a.username !== 'NULL' && a.username.trim() !== '') ? a.username.toLowerCase() : a.login.toLowerCase();
      const nameB = (b.username && b.username !== 'NULL' && b.username.trim() !== '') ? b.username.toLowerCase() : b.login.toLowerCase();
      return nameA.localeCompare(nameB);
    });
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Supprimer un pronostic
router.delete('/:match_id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const matchId = req.params.match_id;

    const matchResult = await db.query('SELECT date, status FROM matches WHERE id = $1', [matchId]);
    const match = matchResult.rows[0];

    if (!match) {
      return res.status(404).json({ error: "Match introuvable" });
    }

    const matchDateTime = new Date(match.date);
    const maintenant = new Date();
    const isMatchStarted = match.status === 'live' || match.status === 'finished';

    if (maintenant >= matchDateTime || isMatchStarted) {
      return res.status(400).json({ error: "Trop tard ! Le match a déjà commencé." });
    }

    await db.query('DELETE FROM predictions WHERE user_id = $1 AND match_id = $2', [userId, matchId]);
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictions/:match_id/others — voir les pronostics des autres
router.get('/:match_id/others', auth, async (req, res) => {
  try {
    const matchId = req.params.match_id;

    const matchResult = await db.query('SELECT status FROM matches WHERE id = $1', [matchId]);
    const match = matchResult.rows[0];

    if (!match) {
      return res.status(404).json({ error: "Match introuvable" });
    }

    if (match.status !== 'finished' && match.status !== 'live') {
      return res.status(403).json({ error: "Les pronostics des autres joueurs ne sont visibles qu'une fois le match commencé." });
    }

    const predsResult = await db.query(`
      SELECT p.pred_home, p.pred_away, u.username, u.login, u.avatar
      FROM predictions p
      JOIN users u ON p.user_id = u.id
      WHERE p.match_id = $1 AND u.is_admin = 0
    `, [matchId]);

    res.json(predsResult.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;