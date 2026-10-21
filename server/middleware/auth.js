const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès non autorisé : Token manquant ou mal formaté.' });
  }
  
  try {
    const token = header.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Accès non autorisé : Token vide.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérification en base de données (sécurité en cas de suppression ou changement de MDP)
    const result = await db.query('SELECT password FROM users WHERE id = $1', [decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Compte introuvable ou supprimé.' });
    }
    
    // On compare la signature du mot de passe pour forcer la déconnexion si le MDP a changé
    if (!decoded.pwHash || result.rows[0].password.slice(-10) !== decoded.pwHash) {
      return res.status(401).json({ error: 'Session invalide ou mot de passe modifié. Veuillez vous reconnecter.' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Votre session a expiré. Veuillez vous reconnecter.' });
    }
    return res.status(401).json({ error: 'Accès non autorisé : Token invalide.' });
  }
};