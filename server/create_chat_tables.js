require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table chat_messages créée.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_read_status (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        last_read_message_id INT DEFAULT 0
      );
    `);
    console.log("✅ Table chat_read_status créée.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_reactions (
        id SERIAL PRIMARY KEY,
        message_id INT REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        emoji VARCHAR(10) NOT NULL,
        UNIQUE(message_id, user_id, emoji)
      );
    `);
    console.log("✅ Table chat_reactions créée.");

  } catch (err) {
    console.error("❌ Erreur lors de la création des tables :", err);
  } finally {
    pool.end();
  }
}

createTables();
