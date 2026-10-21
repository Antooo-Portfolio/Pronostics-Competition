import {
  INITIAL_MATCHES,
  INITIAL_LEADERBOARD,
  INITIAL_DEMO_PREDICTIONS,
  INITIAL_BONUS_QUESTIONS,
  INITIAL_SCORERS,
  INITIAL_ASSISTS,
  INITIAL_CHAT_MESSAGES,
  DEMO_USERS
} from './demoData';
import { calcPts, getMultiplier } from './utils';

// Helper de persistance localStorage avec valeur par défaut
function getStored(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage error:', e);
  }
}

// Initialisation au premier chargement
export function initDemoStorage() {
  if (!localStorage.getItem('demo_initialized')) {
    setStored('demo_matches', INITIAL_MATCHES);
    setStored('demo_my_predictions', INITIAL_DEMO_PREDICTIONS);
    setStored('demo_bonus_questions', INITIAL_BONUS_QUESTIONS);
    setStored('demo_bonus_answers', { 1: 'France', 2: 'Kylian Mbappé', 3: '168' });
    setStored('demo_chat_messages', INITIAL_CHAT_MESSAGES);
    setStored('demo_assists', INITIAL_ASSISTS);
    setStored('demo_leaderboard', INITIAL_LEADERBOARD);

    // Pré-connecte par défaut en tant que Visiteur Démo
    if (!localStorage.getItem('user')) {
      setStored('user', DEMO_USERS.visiteur);
      localStorage.setItem('token', 'demo-token-jwt-visiteur');
    }

    localStorage.setItem('demo_initialized', 'true');
  }
}

// Assure l'initialisation
initDemoStorage();

// Simulation d'un bus d'événements pour le mock de Socket.io
class MockEventEmitter {
  constructor() {
    this.listeners = {};
  }
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  off(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== cb);
  }
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }
}

export const mockSocket = new MockEventEmitter();

// Fonctions API mockées
export const mockService = {
  // --- MATCHS ---
  getMatches: async () => {
    return getStored('demo_matches', INITIAL_MATCHES);
  },

  updateScore: async (id, score_home, score_away, status) => {
    const matches = getStored('demo_matches', INITIAL_MATCHES);
    const updated = matches.map(m => {
      if (m.id === id) {
        return { ...m, score_home, score_away, status };
      }
      return m;
    });
    setStored('demo_matches', updated);
    mockSocket.emit('match_updated', updated.find(m => m.id === id));
    mockSocket.emit('leaderboard_updated');
    return { ok: true };
  },

  getMatchApiStatus: async (id) => {
    const matches = getStored('demo_matches', INITIAL_MATCHES);
    const match = matches.find(m => m.id === id);
    return {
      status: match ? (match.status === 'finished' ? 'FINISHED' : match.status === 'live' ? 'IN_PLAY' : 'TIMED') : 'TIMED',
      score_home: match?.score_home ?? null,
      score_away: match?.score_away ?? null
    };
  },

  // --- PRONOSTICS ---
  getMyPredictions: async () => {
    const predsObj = getStored('demo_my_predictions', INITIAL_DEMO_PREDICTIONS);
    return Object.values(predsObj);
  },

  savePrediction: async (match_id, pred_home, pred_away) => {
    const predsObj = getStored('demo_my_predictions', INITIAL_DEMO_PREDICTIONS);
    predsObj[match_id] = { match_id, pred_home, pred_away };
    setStored('demo_my_predictions', predsObj);
    mockSocket.emit('leaderboard_updated');
    return { ok: true };
  },

  removePrediction: async (match_id) => {
    const predsObj = getStored('demo_my_predictions', INITIAL_DEMO_PREDICTIONS);
    delete predsObj[match_id];
    setStored('demo_my_predictions', predsObj);
    mockSocket.emit('leaderboard_updated');
    return { ok: true };
  },

  getLeaderboard: async () => {
    const baseBoard = getStored('demo_leaderboard', INITIAL_LEADERBOARD);
    const myPreds = getStored('demo_my_predictions', INITIAL_DEMO_PREDICTIONS);
    const matches = getStored('demo_matches', INITIAL_MATCHES);

    // Calcul dynamique des points du visiteur
    let totalPts = 0;
    let exactCount = 0;
    let diffCount = 0;
    let winnerCount = 0;

    matches.filter(m => m.status === 'finished').forEach(m => {
      const pred = myPreds[m.id];
      if (pred && pred.pred_home !== undefined && pred.pred_away !== undefined) {
        const pts = calcPts(pred.pred_home, pred.pred_away, m.score_home, m.score_away);
        const mult = getMultiplier(m.group_name);
        totalPts += (pts * mult);
        if (pts === 4) exactCount++;
        else if (pts === 3) diffCount++;
        else if (pts === 2) winnerCount++;
      }
    });

    const currentUser = getStored('user', DEMO_USERS.visiteur);

    const updatedBoard = baseBoard.map(u => {
      if (u.id === currentUser.id || u.is_demo_user) {
        return {
          ...u,
          id: currentUser.id,
          username: (currentUser.username && currentUser.username.trim() !== '') ? currentUser.username : 'Visiteur Démo (Vous)',
          login: currentUser.login || 'visiteur.demo',
          avatar: currentUser.avatar || '⚽',
          total: totalPts,
          exact_count: exactCount,
          diff_count: diffCount,
          winner_count: winnerCount
        };
      }
      return u;
    });

    // Tri par points décroissants
    updatedBoard.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.exact_count !== a.exact_count) return b.exact_count - a.exact_count;
      if (b.diff_count !== a.diff_count) return b.diff_count - a.diff_count;
      return b.winner_count - a.winner_count;
    });

    return updatedBoard;
  },

  getOthersPredictions: async (match_id) => {
    const matches = getStored('demo_matches', INITIAL_MATCHES);
    const match = matches.find(m => m.id === match_id);
    const sh = match?.score_home ?? 1;
    const sa = match?.score_away ?? 0;

    // Génère des pronos réalistes et variés pour la modale
    return [
      { id: 101, username: 'Sophie M.', login: 'sophie.m', avatar: '⭐', pred_home: sh, pred_away: sa },
      { id: 102, username: 'Thomas D.', login: 'thomas.d', avatar: '🔥', pred_home: sh > sa ? sh + 1 : sh, pred_away: sa },
      { id: 103, username: 'Alexandre B.', login: 'alexandre.b', avatar: '⚡', pred_home: sh, pred_away: sa > 0 ? sa - 1 : sa + 1 },
      { id: 104, username: 'Léa R.', login: 'lea.r', avatar: '⚽', pred_home: sa, pred_away: sh },
      { id: 105, username: 'Julien M.', login: 'julien.m', avatar: '🎯', pred_home: sh, pred_away: sa }
    ];
  },

  // --- QUESTIONS BONUS ---
  getBonus: async () => {
    const questions = getStored('demo_bonus_questions', INITIAL_BONUS_QUESTIONS);
    const myAnswers = getStored('demo_bonus_answers', {});
    return {
      questions,
      myAnswers,
      canPredict: true
    };
  },

  saveBonus: async (question_id, answer) => {
    const myAnswers = getStored('demo_bonus_answers', {});
    if (!answer) {
      delete myAnswers[question_id];
    } else {
      myAnswers[question_id] = answer;
    }
    setStored('demo_bonus_answers', myAnswers);
    return { ok: true };
  },

  resolveBonusAdmin: async (question_id, real_answer, status) => {
    const questions = getStored('demo_bonus_questions', INITIAL_BONUS_QUESTIONS);
    const updated = questions.map(q => q.id === question_id ? { ...q, real_answer, status } : q);
    setStored('demo_bonus_questions', updated);
    return { ok: true };
  },

  // --- CHAT DÉMO ---
  getChatMessages: async () => {
    const messages = getStored('demo_chat_messages', INITIAL_CHAT_MESSAGES);
    return { messages, unreadCount: 0 };
  },

  sendChatMessage: async (content) => {
    const messages = getStored('demo_chat_messages', INITIAL_CHAT_MESSAGES);
    const currentUser = getStored('user', DEMO_USERS.visiteur);

    const newMsg = {
      id: Date.now(),
      user_id: currentUser.id,
      username: currentUser.username || 'Visiteur Démo',
      avatar: currentUser.avatar || '⚽',
      content,
      created_at: new Date().toISOString(),
      reactions: []
    };

    messages.push(newMsg);
    setStored('demo_chat_messages', messages);
    mockSocket.emit('new_chat_message', newMsg);

    // Simulation d'une réponse spontanée d'un collègue après 1,2s pour animer la démo
    setTimeout(() => {
      const replies = [
        { username: 'Sophie M.', avatar: '⭐', content: 'Bien vu ! Hâte de voir le résultat sur le terrain ⚽' },
        { username: 'Alexandre B.', avatar: '⚡', content: "Je suis d'accord avec toi, ça va être très serré !" },
        { username: 'Thomas D.', avatar: '🔥', content: "Perso j'ai misé l'inverse, on verra qui prend les points ! 😉" }
      ];
      const bot = replies[Math.floor(Math.random() * replies.length)];
      const botMsg = {
        id: Date.now() + 1,
        user_id: 102,
        username: bot.username,
        avatar: bot.avatar,
        content: bot.content,
        created_at: new Date().toISOString(),
        reactions: []
      };
      const curMsgs = getStored('demo_chat_messages', INITIAL_CHAT_MESSAGES);
      curMsgs.push(botMsg);
      setStored('demo_chat_messages', curMsgs);
      mockSocket.emit('new_chat_message', botMsg);
    }, 1200);

    return newMsg;
  },

  reactToChatMessage: async (messageId, emoji) => {
    const messages = getStored('demo_chat_messages', INITIAL_CHAT_MESSAGES);
    const currentUser = getStored('user', DEMO_USERS.visiteur);
    const name = currentUser.username || 'Visiteur';

    const updated = messages.map(msg => {
      if (msg.id === messageId) {
        const reactions = msg.reactions || [];
        const existing = reactions.find(r => r.emoji === emoji);
        if (existing) {
          if (existing.users.includes(name)) {
            existing.users = existing.users.filter(u => u !== name);
            existing.count--;
          } else {
            existing.users.push(name);
            existing.count++;
          }
        } else {
          reactions.push({ emoji, count: 1, users: [name] });
        }
        return { ...msg, reactions: reactions.filter(r => r.count > 0) };
      }
      return msg;
    });

    setStored('demo_chat_messages', updated);
    const updatedMsg = updated.find(m => m.id === messageId);
    if (updatedMsg) {
      mockSocket.emit('chat_reaction_updated', { messageId, reactions: updatedMsg.reactions });
    }
    return { ok: true };
  },

  markChatAsRead: async () => {
    return { ok: true };
  },

  // --- STATS ---
  getScorers: async () => {
    return INITIAL_SCORERS;
  },

  getManualAssists: async () => {
    return getStored('demo_assists', INITIAL_ASSISTS);
  },

  saveManualAssist: async (player_name, team_name, assists) => {
    const list = getStored('demo_assists', INITIAL_ASSISTS);
    const item = { id: Date.now(), player_name, team_name, assists };
    list.push(item);
    list.sort((a, b) => b.assists - a.assists);
    setStored('demo_assists', list);
    return list;
  },

  deleteManualAssist: async (id) => {
    const list = getStored('demo_assists', INITIAL_ASSISTS);
    const filtered = list.filter(a => a.id !== id);
    setStored('demo_assists', filtered);
    return filtered;
  },

  // --- AUTHENTIFICATION DÉMO ---
  login: async (credentials) => {
    const loginStr = (credentials.login || credentials.username || '').toLowerCase();
    const isAdmin = loginStr.includes('admin');
    const user = isAdmin ? { ...DEMO_USERS.admin } : { ...DEMO_USERS.visiteur };
    if (!isAdmin && credentials.username) {
      user.username = credentials.username;
    }
    setStored('user', user);
    localStorage.setItem('token', 'demo-token-' + (isAdmin ? 'admin' : 'visiteur'));
    return { token: 'demo-token-' + (isAdmin ? 'admin' : 'visiteur'), user };
  },

  changePassword: async (payload) => {
    const currentUser = getStored('user', DEMO_USERS.visiteur);
    if (payload.username) currentUser.username = payload.username;
    setStored('user', currentUser);
    return { token: 'demo-token-jwt', user: currentUser };
  },

  adminCreateUser: async (payload) => {
    const board = getStored('demo_leaderboard', INITIAL_LEADERBOARD);
    const newUser = {
      id: Date.now(),
      username: payload.username || payload.login,
      login: payload.login,
      avatar: payload.avatar || '⚽',
      total: 0,
      exact_count: 0,
      diff_count: 0,
      winner_count: 0
    };
    board.push(newUser);
    setStored('demo_leaderboard', board);
    mockSocket.emit('leaderboard_updated');
    return { ok: true, user: newUser };
  },

  adminResetPassword: async () => {
    return { ok: true, message: 'Mot de passe réinitialisé (Mode Démo) !' };
  }
};
