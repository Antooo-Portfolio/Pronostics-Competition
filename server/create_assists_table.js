require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manual_assists (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(100) NOT NULL,
        team_name VARCHAR(100),
        assists INT DEFAULT 0
      );
    `);
    console.log("✅ Table manual_assists créée avec succès.");
  } catch (err) {
    console.error("❌ Erreur lors de la création de la table :", err);
  } finally {
    pool.end();
  }
}

createTable();
