const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db'); 
const auth = require('../middleware/auth'); 

const isPasswordStrong = (pwd) => {
  if (!pwd) return false;
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd);
};

const router = express.Router();

// 1. POST /api/auth/login (Connexion Entreprise uniquement par Login prénom.nom)
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
    }

    const result = await db.query('SELECT * FROM users WHERE LOWER(login) = LOWER($1)', [login.trim()]);
    const row = result.rows[0];
    
    if (!row) return res.status(400).json({ error: 'Identifiants incorrects.' });

    const ok = await bcrypt.compare(password, row.password);
    if (!ok) return res.status(400).json({ error: 'Identifiants incorrects.' });

    // Si MDP provisoire, on renvoie le login et le username pour la page suivante
    if (row.must_change_password) {
      return res.json({ 
        requirePasswordChange: true, 
        username: row.username, 
        login: row.login, 
        message: "Vous devez changer votre mot de passe provisoire."
      });
    }

    const user = { 
      id: row.id, 
      username: row.username, 
      login: row.login,
      avatar: row.avatar, 
      is_admin: row.is_admin 
    };
    
    const token = jwt.sign({ ...user, pwHash: row.password.slice(-10) }, process.env.JWT_SECRET, { expiresIn: '365d' });

    res.json({ token, user });
  } catch (err) {
    console.error("Erreur connexion :", err.message);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// 2. POST /api/auth/change-password (Universel, basé sur le login pour l'entreprise)
router.post('/change-password', async (req, res) => {
  try {
    const { login, oldPassword, newPassword } = req.body;
    
    if (!login) {
       return res.status(400).json({ error: 'Identifiant manquant.' });
    }

    if (!isPasswordStrong(newPassword)) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 minuscule et 1 caractère spécial.' });
    }

    const result = await db.query('SELECT * FROM users WHERE LOWER(login) = LOWER($1)', [login.trim()]);
    const row = result.rows[0];
    
    if (!row) return res.status(400).json({ error: 'Utilisateur introuvable.' });

    const ok = await bcrypt.compare(oldPassword, row.password);
    if (!ok) return res.status(400).json({ error: 'Ancien mot de passe incorrect.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1, must_change_password = FALSE WHERE id = $2', [hash, row.id]);

    const user = { 
      id: row.id, 
      username: row.username, 
      login: row.login, 
      avatar: row.avatar, 
      is_admin: row.is_admin 
    };
    
    const token = jwt.sign({ ...user, pwHash: hash.slice(-10) }, process.env.JWT_SECRET, { expiresIn: '365d' });

    res.json({ token, user });
  } catch (err) {
    console.error("Erreur changement de MDP :", err.message);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ----------------------------------------------------------------------
// 🛡️ ROUTES RÉSERVÉES À L'ADMINISTRATEUR
// ----------------------------------------------------------------------

const isValidLogin = (str) => {
  const parts = str.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const charRegex = /^[a-zA-Z0-9àâäéèêëîïôöùûüçæœÀÂÄÉÈÊËÎÏÔÖÙÛÜÇÆŒ_-]+$/;
  return charRegex.test(parts[0]) && charRegex.test(parts[1]);
};

// 3. POST /api/auth/admin/create-user (Création de compte 100% Entreprise)
router.post('/admin/create-user', auth, async (req, res) => {
  try {
    if (req.user.is_admin !== 1) return res.status(403).json({ error: 'Accès refusé. Réservé aux administrateurs.' });

    const { username, login, password, avatar } = req.body;

    if (!login || login.trim() === '') {
      return res.status(400).json({ error: "L'identifiant est obligatoire." });
    }

    const finalLogin = login.trim();
    if (!isValidLogin(finalLogin)) {
      return res.status(400).json({ error: "L'identifiant doit être sous la forme prénom.nom (ex: jean.dupont)." });
    }

    if (!isPasswordStrong(password)) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 minuscule et 1 caractère spécial.' });
    }

    // Le pseudo est optionnel, on sécurise sa longueur maximale si fourni
    const finalUsername = (username && username.trim().length >= 3) ? username.trim().substring(0, 50) : null;
    const finalAvatar = avatar || '⚽';

    // Vérifier les doublons
    let existsQuery = 'SELECT id FROM users WHERE LOWER(login) = LOWER($1)';
    let queryParams = [finalLogin];

    if (finalUsername) {
      existsQuery = 'SELECT id FROM users WHERE LOWER(login) = LOWER($1) OR LOWER(username) = LOWER($2)';
      queryParams = [finalLogin, finalUsername];
    }

    const exists = await db.query(existsQuery, queryParams);
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Cet identifiant ou pseudo est déjà utilisé.' });

    const hash = await bcrypt.hash(password, 10);
    
    await db.query(
      'INSERT INTO users (username, login, password, avatar, must_change_password) VALUES ($1, $2, $3, $4, TRUE)',
      [finalUsername, finalLogin, hash, finalAvatar]
    );

    res.json({ success: true, message: 'Compte collaborateur créé avec succès.' });
  } catch (err) {
    console.error("Erreur création utilisateur :", err.message);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la création.' });
  }
});

// 4. POST /api/auth/admin/reset-password 
router.post('/admin/reset-password', auth, async (req, res) => {
  try {
    if (req.user.is_admin !== 1) return res.status(403).json({ error: 'Accès refusé. Réservé aux administrateurs.' });

    const { target_user_id, new_temp_password } = req.body;
    
    if (!isPasswordStrong(new_temp_password)) {
      return res.status(400).json({ error: 'Le mot de passe temporaire doit contenir au moins 8 caractères, 1 majuscule, 1 minuscule et 1 caractère spécial.' });
    }

    const hash = await bcrypt.hash(new_temp_password, 10);
    
    await db.query('UPDATE users SET password = $1, must_change_password = TRUE WHERE id = $2', [hash, target_user_id]);

    res.json({ success: true, message: 'Le mot de passe a été réinitialisé avec succès.' });
  } catch (err) {
    console.error("Erreur réinitialisation MDP :", err.message);
    res.status(500).json({ error: 'Erreur interne du serveur lors de la réinitialisation.' });
  }
});

module.exports = router;