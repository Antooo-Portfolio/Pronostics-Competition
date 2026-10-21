import { mockService } from './mockService';

// Mode Démo par défaut si aucune URL d'API n'est spécifiée (idéal pour portfolio OVH)
export const IS_DEMO_MODE = !import.meta.env.VITE_API_URL || import.meta.env.VITE_DEMO_MODE === 'true';

const API_URL = import.meta.env.VITE_API_URL || '';
const BASE = `${API_URL}/api`;

// Dictionnaire de traduction universel
export const TRANSLATE_COUNTRY = {
  "Algeria": "Algérie", "Germany": "Allemagne", "England": "Angleterre",
  "Saudi Arabia": "Arabie Saoudite", "Argentina": "Argentine", "Australia": "Australie",
  "Austria": "Autriche", "Belgium": "Belgique", "Bosnia-Herzegovina": "Bosnie-Herzégovine",
  "Brazil": "Brésil", "Canada": "Canada", "Cape Verde Islands": "Cap-Vert",
  "Colombia": "Colombie", "South Korea": "Corée du Sud", "Ivory Coast": "Côte d'Ivoire",
  "Croatia": "Croatie", "Curacao": "Curaçao", "Spain": "Espagne", "Egypt": "Égypte",
  "Ecuador": "Équateur", "Scotland": "Écosse", "France": "France", "Ghana": "Ghana",
  "Haiti": "Haïti", "Iran": "Iran", "Iraq": "Irak", "Italy": "Italie", "Japan": "Japon",
  "Jordan": "Jordanie", "Mexico": "Mexique", "Morocco": "Maroc", "Norway": "Norvège",
  "New Zealand": "Nouvelle-Zélande", "Uzbekistan": "Ouzbékistan", "Panama": "Panama",
  "Paraguay": "Paraguay", "Netherlands": "Pays-Bas", "Portugal": "Portugal",
  "Qatar": "Qatar", "Congo DR": "RD Congo", "Switzerland": "Suisse", "Sweden": "Suède",
  "Czechia": "Tchéquie", "Tunisia": "Tunisie", "Uruguay": "Uruguay",
  "United States": "États-Unis", "South Africa": "Afrique du Sud", "Senegal": "Sénégal",
  "Turkey": "Turquie"
};

// Fonction pour traduire un match automatiquement
export function translateMatch(m) {
  return {
    ...m,
    home_team: TRANSLATE_COUNTRY[m.home_team] || m.home_team,
    away_team: TRANSLATE_COUNTRY[m.away_team] || m.away_team,
    minute: m.minute
  };
}

// Récupère le token JWT stocké
function getToken() {
  return localStorage.getItem('token');
}

// Requête HTTP générique (utilisée en mode Fullstack avec backend réel)
async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json();

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }

  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

export const api = {
  // Auth
  register: (username, password, avatar) =>
    IS_DEMO_MODE ? mockService.login({ username, password }) :
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, avatar }) }),

  login: async (credentials) => {
    if (IS_DEMO_MODE) return mockService.login(credentials);
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  changePassword: async (payload) => {
    if (IS_DEMO_MODE) return mockService.changePassword(payload);
    const res = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  adminCreateUser: async (payload) => {
    if (IS_DEMO_MODE) return mockService.adminCreateUser(payload);
    const res = await fetch(`${API_URL}/api/auth/admin/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  adminResetPassword: async (targetUserId, newTempPassword) => {
    if (IS_DEMO_MODE) return mockService.adminResetPassword(targetUserId, newTempPassword);
    const res = await fetch(`${API_URL}/api/auth/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ target_user_id: targetUserId, new_temp_password: newTempPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  // Matchs
  getMatches: async () => {
    if (IS_DEMO_MODE) {
      const data = await mockService.getMatches();
      return data.map(translateMatch);
    }
    const data = await request('/matches');
    return data.map(translateMatch);
  },

  updateScore: (id, score_home, score_away, status) =>
    IS_DEMO_MODE ? mockService.updateScore(id, score_home, score_away, status) :
    request(`/matches/${id}/score`, { method: 'PATCH', body: JSON.stringify({ score_home, score_away, status }) }),

  getMatchApiStatus: (id) =>
    IS_DEMO_MODE ? mockService.getMatchApiStatus(id) :
    request(`/matches/${id}/api-status`),

  // Pronostics
  getMyPredictions: () =>
    IS_DEMO_MODE ? mockService.getMyPredictions() :
    request('/predictions/mine'),

  savePrediction: (match_id, pred_home, pred_away) =>
    IS_DEMO_MODE ? mockService.savePrediction(match_id, pred_home, pred_away) :
    request('/predictions', { method: 'POST', body: JSON.stringify({ match_id, pred_home, pred_away }) }),

  removePrediction: (match_id) =>
    IS_DEMO_MODE ? mockService.removePrediction(match_id) :
    request(`/predictions/${match_id}`, { method: 'DELETE' }),

  getLeaderboard: () =>
    IS_DEMO_MODE ? mockService.getLeaderboard() :
    request('/predictions/leaderboard'),

  getOthersPredictions: (match_id) =>
    IS_DEMO_MODE ? mockService.getOthersPredictions(match_id) :
    request(`/predictions/${match_id}/others`),

  // Bonus
  getBonus: () =>
    IS_DEMO_MODE ? mockService.getBonus() :
    request('/bonus'),

  saveBonus: (question_id, answer) =>
    IS_DEMO_MODE ? mockService.saveBonus(question_id, answer) :
    request('/bonus', { method: 'POST', body: JSON.stringify({ question_id, answer }) }),

  resolveBonusAdmin: (question_id, real_answer, status) =>
    IS_DEMO_MODE ? mockService.resolveBonusAdmin(question_id, real_answer, status) :
    request('/bonus/admin/resolve', { method: 'PUT', body: JSON.stringify({ question_id, real_answer, status }) }),

  // Chat
  getChatMessages: () =>
    IS_DEMO_MODE ? mockService.getChatMessages() :
    request('/chat'),

  sendChatMessage: (content) =>
    IS_DEMO_MODE ? mockService.sendChatMessage(content) :
    request('/chat/message', { method: 'POST', body: JSON.stringify({ content }) }),

  reactToChatMessage: (messageId, emoji) =>
    IS_DEMO_MODE ? mockService.reactToChatMessage(messageId, emoji) :
    request(`/chat/message/${messageId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) }),

  markChatAsRead: (lastMessageId) =>
    IS_DEMO_MODE ? mockService.markChatAsRead(lastMessageId) :
    request('/chat/read', { method: 'POST', body: JSON.stringify({ lastMessageId }) }),

  // Stats
  getScorers: () =>
    IS_DEMO_MODE ? mockService.getScorers() :
    request('/stats/scorers'),

  // Passeurs (Manuel)
  getManualAssists: () =>
    IS_DEMO_MODE ? mockService.getManualAssists() :
    request('/stats/assists'),

  saveManualAssist: (player_name, team_name, assists) =>
    IS_DEMO_MODE ? mockService.saveManualAssist(player_name, team_name, assists) :
    request('/stats/assists', { method: 'POST', body: JSON.stringify({ player_name, team_name, assists }) }),

  deleteManualAssist: (id) =>
    IS_DEMO_MODE ? mockService.deleteManualAssist(id) :
    request(`/stats/assists/${id}`, { method: 'DELETE' }),
};