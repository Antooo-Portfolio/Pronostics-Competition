const { Pool } = require('pg');

// Connexion à Supabase via l'URL de la base de données fournie dans le fichier .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Le mode SSL est souvent requis par les bases de données cloud comme Supabase
  ssl: {
    rejectUnauthorized: false
  }
});

// Petit test automatique pour vérifier que la connexion réussit au démarrage
pool.connect()
  .then(() => console.log('✅ Connecté à la base de données PostgreSQL (Supabase) !'))
  .catch(err => console.error('❌ Erreur de connexion à la base de données :', err.stack));

// On exporte une méthode 'query' qui sera utilisée partout dans tes autres fichiers
module.exports = {
  query: (text, params) => pool.query(text, params),
};