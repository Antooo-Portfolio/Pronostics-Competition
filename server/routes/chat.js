const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// 1. Récupérer les 50 derniers messages et le nombre de messages non lus
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer les 50 derniers messages (triés par date décroissante pour le LIMIT, puis inversés pour l'affichage chronologique)
    const messagesResult = await db.query(`
      SELECT m.id, m.content, m.created_at, u.id as user_id, u.username, u.login, u.avatar
      FROM chat_messages m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.id DESC
      LIMIT 50
    `);
    
    // Inverser pour avoir le plus ancien en premier dans l'affichage
    const messages = messagesResult.rows.reverse();

    if (messages.length > 0) {
      const messageIds = messages.map(m => m.id);
      const reactionsResult = await db.query(`
        SELECT r.message_id, r.emoji, r.user_id, u.username, u.login
        FROM chat_reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.message_id = ANY($1::int[])
      `, [messageIds]);
      
      const reactionsByMessage = {};
      for (const row of reactionsResult.rows) {
        if (!reactionsByMessage[row.message_id]) {
          reactionsByMessage[row.message_id] = {};
        }
        if (!reactionsByMessage[row.message_id][row.emoji]) {
          reactionsByMessage[row.message_id][row.emoji] = [];
        }
        reactionsByMessage[row.message_id][row.emoji].push({
          id: row.user_id,
          name: (row.username && row.username !== 'NULL' && row.username.trim() !== '') ? row.username : row.login
        });
      }

      for (const m of messages) {
        m.reactions = reactionsByMessage[m.id] || {};
      }
    } else {
      for (const m of messages) {
        m.reactions = {};
      }
    }

    // Récupérer l'ID du dernier message lu
    const readStatusResult = await db.query(`
      SELECT last_read_message_id FROM chat_read_status WHERE user_id = $1
    `, [userId]);

    const lastReadId = readStatusResult.rows.length > 0 ? readStatusResult.rows[0].last_read_message_id : 0;

    // Calculer le nombre de messages non lus (par rapport au dernier ID global de la base)
    const unreadResult = await db.query(`
      SELECT COUNT(*) as unread_count FROM chat_messages WHERE id > $1
    `, [lastReadId]);

    const unreadCount = parseInt(unreadResult.rows[0].unread_count, 10);

    res.json({ messages, unreadCount });
  } catch (err) {
    console.error("Erreur récupération chat :", err.message);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// 2. Envoyer un nouveau message
router.post('/message', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Message vide.' });
    }

    // Insérer le message
    const insertResult = await db.query(`
      INSERT INTO chat_messages (user_id, content)
      VALUES ($1, $2)
      RETURNING id, created_at
    `, [userId, content.trim()]);

    const newMsg = insertResult.rows[0];

    // Marquer ce message comme lu pour l'expéditeur immédiatement
    await db.query(`
      INSERT INTO chat_read_status (user_id, last_read_message_id) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) 
      DO UPDATE SET last_read_message_id = EXCLUDED.last_read_message_id
    `, [userId, newMsg.id]);

    const messageToSend = {
      id: newMsg.id,
      content: content.trim(),
      created_at: newMsg.created_at,
      user_id: userId,
      username: req.user.username,
      login: req.user.login,
      avatar: req.user.avatar
    };

    // Diffuser à tous les connectés via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('new_chat_message', messageToSend);
    }

    res.json({ success: true, message: messageToSend });
  } catch (err) {
    console.error("Erreur envoi message chat :", err.message);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// 3. Marquer les messages comme lus (en fournissant le lastMessageId)
router.post('/read', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lastMessageId } = req.body;

    if (!lastMessageId) {
       return res.status(400).json({ error: 'lastMessageId requis.' });
    }

    await db.query(`
      INSERT INTO chat_read_status (user_id, last_read_message_id) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) 
      DO UPDATE SET last_read_message_id = GREATEST(chat_read_status.last_read_message_id, EXCLUDED.last_read_message_id)
    `, [userId, lastMessageId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur marquage lu :", err.message);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// 4. Ajouter / retirer une réaction
router.post('/message/:id/react', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id, 10);
    const { emoji } = req.body;

    if (!messageId || !emoji) {
      return res.status(400).json({ error: 'messageId et emoji requis.' });
    }

    // Vérifier si la réaction existe
    const existing = await db.query(`
      SELECT id FROM chat_reactions 
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
    `, [messageId, userId, emoji]);

    if (existing.rows.length > 0) {
      // Supprimer la réaction (toggle off)
      await db.query(`DELETE FROM chat_reactions WHERE id = $1`, [existing.rows[0].id]);
    } else {
      // Ajouter la réaction
      await db.query(`
        INSERT INTO chat_reactions (message_id, user_id, emoji) 
        VALUES ($1, $2, $3)
      `, [messageId, userId, emoji]);
    }

    // Récupérer toutes les réactions à jour pour ce message
    const allReactionsResult = await db.query(`
      SELECT r.emoji, r.user_id, u.username, u.login 
      FROM chat_reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.message_id = $1
    `, [messageId]);

    const reactions = {};
    for (const row of allReactionsResult.rows) {
      if (!reactions[row.emoji]) {
        reactions[row.emoji] = [];
      }
      reactions[row.emoji].push({
        id: row.user_id,
        name: (row.username && row.username !== 'NULL' && row.username.trim() !== '') ? row.username : row.login
      });
    }

    // Diffuser à tous les connectés
    const io = req.app.get('io');
    if (io) {
      io.emit('chat_reaction_updated', { messageId, reactions });
    }

    res.json({ success: true, reactions });
  } catch (err) {
    console.error("Erreur toggle reaction :", err.message);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;
