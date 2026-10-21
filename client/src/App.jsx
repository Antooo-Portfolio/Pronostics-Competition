import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { api, translateMatch, IS_DEMO_MODE } from './api';
import { mockSocket } from './mockService';
import { DEMO_USERS } from './demoData';
import Select from 'react-select';
import { S, btn, selectStyles } from './styles';
import { getFlagUrl, getGroupStandings, calcPts, ptsColor, ptsLabel, getMultiplier } from './utils';
import { TEAM_OPTIONS, PLAYER_OPTIONS, PLAYERS_BY_COUNTRY } from './constants';
import MatchCard from './components/MatchCard';
import MiniBracketCard from './components/MiniBracketCard';
import { Overlay, ModalBox, AuthInput, ScoreInput, GoldButton, TextBtn } from './components/ui';
import ChatComponent from './components/ChatComponent';

let socket;
if (IS_DEMO_MODE) {
  socket = mockSocket;
} else {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('deviceId', deviceId);
  }
  socket = io(import.meta.env.VITE_API_URL || '', {
    auth: { deviceId }
  });
}

const isPasswordStrong = (pwd) => {
  if (!pwd) return false;
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd);
};

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('user'));
      if (stored) return stored;
      if (IS_DEMO_MODE) {
        return DEMO_USERS.visiteur;
      }
      return null;
    } catch { return null; }
  });
  const [matches, setMatches] = useState([]);
  const [myPreds, setMyPreds] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [scorers, setScorers] = useState([]);
  const [manualAssists, setManualAssists] = useState([]);
  const [tab, setTab] = useState('predictions');
  const [tournamentSubTab, setTournamentSubTab] = useState('groups');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', avatar: '⚽' });
  const [authErr, setAuthErr] = useState('');
  const [predInput, setPredInput] = useState({ h: '', a: '' });
  const [filterType, setFilterType] = useState('all'); // all, groupes, phases
  const [filterSub, setFilterSub] = useState('all');
  const [filterStatus, setFilterStatus] = useState('upcoming_live'); // upcoming_live, finished
  const [loading, setLoading] = useState(true);
  const [adminScore, setAdminScore] = useState({ h: '', a: '' });
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [othersPredsData, setOthersPredsData] = useState({ match: null, preds: [] });
  const [teamHistoryData, setTeamHistoryData] = useState({ teamName: '', matches: [] });

  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef(null);
  const [onlineCount, setOnlineCount] = useState(IS_DEMO_MODE ? 6 : 1);
  const [onlineUsersList, setOnlineUsersList] = useState(IS_DEMO_MODE ? [
    { username: 'Sophie M.' }, { username: 'Thomas D.' }, { username: 'Alexandre B.' }
  ] : []);
  const [anonymousCount, setAnonymousCount] = useState(IS_DEMO_MODE ? 3 : 0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setShowNav(currentY < 60);
      setLastScrollY(currentY);
      setShowUserMenu(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const favicon = document.getElementById('favicon');
    const appleIcon = document.getElementById('apple-touch-icon');
    const iconUrl = `${import.meta.env.BASE_URL}logo.png`;

    if (favicon) {
      favicon.href = iconUrl;
      favicon.type = 'image/png';
    }

    if (appleIcon) {
      appleIcon.href = iconUrl;
    }
  }, []);

  const [bonusData, setBonusData] = useState({
    questions: [],
    myAnswers: {},
    canPredict: true
  });

  const [adminPanel, setAdminPanel] = useState({
    newLogin: '', newUsername: '', newPassword: '',
    resetUserId: '', resetPassword: '',
    msg: '', error: ''
  });

  const [adminAssistForm, setAdminAssistForm] = useState({
    player_name: '', team_name: '', assists: ''
  });

  async function handleSaveManualAssist() {
    try {
      setAdminPanel(prev => ({ ...prev, msg: '', error: '' }));
      if (!adminAssistForm.player_name || !adminAssistForm.team_name || adminAssistForm.assists === '') {
        throw new Error("Tous les champs sont requis.");
      }
      const data = await api.saveManualAssist(adminAssistForm.player_name, adminAssistForm.team_name, parseInt(adminAssistForm.assists));
      setManualAssists(data || []);
      setAdminAssistForm({ player_name: '', team_name: '', assists: '' });
      setAdminPanel(prev => ({ ...prev, msg: 'Passeur enregistré !' }));
    } catch (e) {
      setAdminPanel(prev => ({ ...prev, error: e.message }));
    }
  }

  async function handleDeleteManualAssist(id) {
    try {
      setAdminPanel(prev => ({ ...prev, msg: '', error: '' }));
      const data = await api.deleteManualAssist(id);
      setManualAssists(data || []);
      setAdminPanel(prev => ({ ...prev, msg: 'Passeur supprimé !' }));
    } catch (e) {
      setAdminPanel(prev => ({ ...prev, error: e.message }));
    }
  }

  async function handleAdminCreate() {
    try {
      setAdminPanel(prev => ({ ...prev, msg: '', error: '' }));
      if (!isPasswordStrong(adminPanel.newPassword)) throw new Error("Le mot de passe doit faire 8 caractères, 1 majuscule, 1 minuscule et 1 caractère spécial.");

      await api.adminCreateUser({
        login: adminPanel.newLogin,
        username: adminPanel.newUsername,
        password: adminPanel.newPassword,
        avatar: '⚽'
      });
      setAdminPanel(prev => ({ ...prev, msg: 'Compte créé avec succès !', newLogin: '', newUsername: '', newPassword: '' }));
      loadData();
    } catch (e) {
      setAdminPanel(prev => ({ ...prev, error: e.message }));
    }
  }

  async function handleAdminReset() {
    try {
      setAdminPanel(prev => ({ ...prev, msg: '', error: '' }));
      if (!adminPanel.resetUserId) throw new Error("Veuillez sélectionner un utilisateur.");
      if (!isPasswordStrong(adminPanel.resetPassword)) throw new Error("Le mot de passe doit faire 8 caractères, 1 majuscule, 1 minuscule et 1 caractère spécial.");

      await api.adminResetPassword(adminPanel.resetUserId, adminPanel.resetPassword);
      setAdminPanel(prev => ({ ...prev, msg: 'Mot de passe réinitialisé !', resetUserId: '', resetPassword: '' }));
    } catch (e) {
      setAdminPanel(prev => ({ ...prev, error: e.message }));
    }
  }

  const loadData = useCallback(async () => {
    try {
      const [ms, lb, sc, ma] = await Promise.all([
        api.getMatches(),
        api.getLeaderboard(),
        api.getScorers(),
        api.getManualAssists(),
      ]);
      setMatches(ms);
      setLeaderboard(lb);
      setScorers(sc || []);
      setManualAssists(ma || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadBonus = useCallback(async () => {
    try {
      const bd = await api.getBonus();
      if (bd) setBonusData({
        questions: bd.questions,
        myAnswers: bd.myAnswers,
        canPredict: bd.canPredict
      });
    } catch (e) { console.error(e); }
  }, []);

  const loadMyPreds = useCallback(async () => {
    if (!user) return;
    try {
      const preds = await api.getMyPredictions();
      const map = {};
      preds.forEach(p => { map[p.match_id] = p; });
      setMyPreds(map);
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadMyPreds(); }, [loadMyPreds]);
  useEffect(() => { loadBonus(); }, [loadBonus]);

  // Actualisation automatique lors du retour sur l'application (PWA / Mobile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

  useEffect(() => {
    const emitUser = () => {
      if (user) {
        socket.emit('set_user', { id: user.id, username: user.username, login: user.login, is_admin: user.is_admin });
      } else {
        socket.emit('set_user', null);
      }
    };

    emitUser();
    socket.on('connect', emitUser);

    return () => {
      socket.off('connect', emitUser);
    };
  }, [user]);

  useEffect(() => {
    socket.on('score_updated', () => {
      api.getMatches().then(setMatches).catch(console.error);
      api.getScorers().then(sc => setScorers(sc || [])).catch(console.error);
    });
    socket.on('match_updated', (updatedMatch) => {
      const translated = translateMatch(updatedMatch);
      setMatches(prev => prev.map(m => (m.id === translated.id || m.id_api === translated.id_api) ? { ...m, ...translated } : m));
    });
    socket.on('leaderboard_updated', () => {
      api.getLeaderboard().then(setLeaderboard).catch(console.error);
    });
    socket.on('online_users', (data) => {
      if (typeof data === 'number') {
        setOnlineCount(data);
      } else {
        setOnlineCount(data.count);
        setOnlineUsersList(data.users || []);
        setAnonymousCount(data.anonymousCount || 0);
      }
    });
    return () => {
      socket.off('score_updated');
      socket.off('leaderboard_updated');
      socket.off('online_users');
    };
  }, []);

  async function login() {
    try {
      const credentials = { login: form.username, password: form.password };
      const data = await api.login(credentials);

      if (data.requirePasswordChange) {
        setForm(f => ({
          ...f,
          tempPassword: form.password,
          newPassword: '',
          username: data.username,
          login: data.login
        }));
        setModal('change_password');
        setAuthErr('');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setModal(null);
      setAuthErr('');
      setForm({ username: '', password: '', avatar: '⚽' });
      loadData();
      loadBonus();
    } catch (e) { setAuthErr(e.message); }
  }

  async function submitNewPassword() {
    if (!isPasswordStrong(form.newPassword)) {
      setAuthErr("Le mot de passe doit faire 8 caractères, 1 majuscule, 1 minuscule et 1 caractère spécial.");
      return;
    }
    try {
      const payload = {
        oldPassword: form.tempPassword,
        newPassword: form.newPassword
      };
      if (form.username) payload.username = form.username;
      if (form.login) payload.login = form.login;

      const data = await api.changePassword(payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setModal(null);
      setAuthErr('');
      setForm({ username: '', password: '', avatar: '⚽' });
      loadData();
    } catch (e) { setAuthErr(e.message); }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setMyPreds({});
    setBonusData({ questions: [], myAnswers: {}, canPredict: false });
  }

  function openPred(m) {
    if (!user) { setModal('login'); return; }
    if (m.status !== 'upcoming') return;
    const ex = myPreds[m.id];
    setPredInput({ h: ex ? String(ex.pred_home) : '', a: ex ? String(ex.pred_away) : '' });
    setModal({ type: 'pred', match: m });
  }

  async function removePred(matchId) {
    try {
      await api.removePrediction(matchId);
      setMyPreds(prev => {
        const copy = { ...prev };
        delete copy[matchId];
        return copy;
      });
      setModal(null);
    } catch (e) { alert(e.message); }
  }

  async function savePred(matchId) {
    const h = parseInt(predInput.h), a = parseInt(predInput.a);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;
    try {
      await api.savePrediction(matchId, h, a);
      setMyPreds(prev => ({ ...prev, [matchId]: { match_id: matchId, pred_home: h, pred_away: a } }));
      setModal(null);
    } catch (e) { alert(e.message); }
  }

  async function updateScore(matchId, status) {
    const h = parseInt(adminScore.h), a = parseInt(adminScore.a);
    if (isNaN(h) || isNaN(a)) { alert('Entrez un score valide'); return; }
    try {
      await api.updateScore(matchId, h, a, status);
      setAdminScore({ h: '', a: '' });
      setModal(null);
    } catch (e) { alert(e.message); }
  }

  async function openOthersPreds(m) {
    if (!user) { setModal('login'); return; }
    if (m.status !== 'finished' && m.status !== 'live') return;
    try {
      const preds = await api.getOthersPredictions(m.id);
      preds.sort((a, b) => {
        const nameA = (a.username && a.username !== 'NULL' && a.username.trim() !== '') ? a.username.toLowerCase() : a.login.toLowerCase();
        const nameB = (b.username && b.username !== 'NULL' && b.username.trim() !== '') ? b.username.toLowerCase() : b.login.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setOthersPredsData({ match: m, preds });
      setModal('others_preds');
    } catch (e) {
      alert(e.message);
    }
  }

  function openTeamHistory(teamName) {
    if (teamName === 'À définir') return;
    const teamMatches = matches.filter(m => m.home_team === teamName || m.away_team === teamName);
    teamMatches.sort((a, b) => new Date(a.date) - new Date(b.date));
    setTeamHistoryData({ teamName, matches: teamMatches });
    setModal('team_history');
  }

  const filtered = matches.filter(m => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'upcoming_live') {
        if (m.status !== 'upcoming' && m.status !== 'live') return false;
      } else {
        if (m.status !== filterStatus) return false;
      }
    }
    if (filterType === 'all') return true;
    const isPoule = m.group_name && m.group_name.includes('Groupe');
    if (filterType === 'groupes') {
      if (filterSub === 'all') return isPoule;
      return m.group_name === filterSub;
    }
    if (filterType === 'phases') {
      if (filterSub === 'all') return !isPoule;
      return m.group_name === filterSub;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (filterStatus === 'finished') {
      return new Date(b.date) - new Date(a.date);
    }
    return new Date(a.date) - new Date(b.date);
  });

  const grouped = filtered.reduce((acc, m) => {
    const k = filterType === 'all'
      ? new Date(m.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      : m.group_name;

    if (!acc[k]) acc[k] = [];
    acc[k].push(m);
    return acc;
  }, {});

  const myRank = leaderboard.findIndex(x => x.id === user?.id) + 1;

  // Stats pour l'onglet Compétition
  const finishedMatchesCount = matches.filter(m => m.status === 'finished').length;
  const totalMatchesCount = matches.length || 104;
  const totalGoals = matches.reduce((acc, m) => acc + (m.status === 'finished' ? ((m.score_home || 0) + (m.score_away || 0)) : 0), 0);
  const avgGoals = finishedMatchesCount > 0 ? (totalGoals / finishedMatchesCount).toFixed(2) : '0.00';

  const topScorers = scorers.slice(0, 3);
  const topAssists = manualAssists.slice(0, 3);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.gold, fontSize: 18 }}>
      ⚽ Chargement...
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.text, fontFamily: 'system-ui,sans-serif' }}>

      {/* ── HEADER ÉLARGI ET CENTRÉ ── */}
      <div style={{
        borderBottom: `1px solid ${S.border}`,
        background: 'rgba(7,11,26,0.97)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transform: showNav ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.3s ease-in-out'
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 20px 0 20px', position: 'relative' }}>

          <div className="header-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>

            <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <img className="logo-img" src={`${import.meta.env.BASE_URL}logo.png`} alt="logo" />
              <div className="logo-text" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="title-main">Coupe du Monde</span>
                <span className="title-sub" style={{ fontWeight: 800 }}>2026</span>
              </div>

            </div>

            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                className="online-indicator"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: S.liveDim, padding: '6px 14px',
                  borderRadius: 20, border: `1px solid rgba(0,230,118,0.4)`, cursor: 'pointer', transition: 'all 0.2s',
                  outline: 'none'
                }}
                onClick={() => {
                  setModal('online_users');
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 230, 118, 0.2)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = S.liveDim; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.live, boxShadow: `0 0 8px ${S.live}`, animation: 'pulse 2s infinite', flexShrink: 0 }}></div>
                <span style={{ fontSize: 13, color: S.live, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {onlineCount} en ligne
                </span>
              </button>

              <div className="auth-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }} ref={menuRef}>
                <button
                  className="auth-btn"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${S.border}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                    borderRadius: 12, transition: 'all 0.2s', maxWidth: '100%'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  {user ? (
                    <>
                      <span className="auth-name" style={{ fontSize: 15, color: S.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(user.username && user.username.trim() !== '') ? user.username : user.login}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 15, color: S.text, fontWeight: 600 }}>Profil</span>
                    </>
                  )}
                </button>

                {showUserMenu && (
                  <div className="user-dropdown" style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 8,
                    background: '#0e1427',
                    border: `1px solid ${S.border}`, borderRadius: 12,
                    padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
                    minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.8)', zIndex: 200
                  }}>
                    {IS_DEMO_MODE && (
                      <div style={{ padding: '6px 10px', fontSize: 11, color: S.gold, fontWeight: 700, borderBottom: `1px solid ${S.border}`, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        ⚽ Version Démo Portfolio
                      </div>
                    )}
                    {user ? (
                      <>
                        {user.is_admin === 1 && (
                          <button onClick={() => {
                            setShowUserMenu(false);
                            setModal('adminPanel');
                            setAdminPanel(p => ({ ...p, msg: '', error: '' }));
                          }} style={btn({ padding: '10px 12px', fontSize: 13, background: 'rgba(255,70,70,0.1)', color: '#ff7070', borderColor: 'transparent', width: '100%', textAlign: 'left' })}>
                            ⚙️ Administration
                          </button>
                        )}
                        {IS_DEMO_MODE && user.is_admin !== 1 && (
                          <button onClick={async () => {
                            setShowUserMenu(false);
                            const res = await api.login({ login: 'admin.demo' });
                            setUser(res.user);
                            loadData();
                          }} style={btn({ padding: '10px 12px', fontSize: 12, background: 'rgba(255,70,70,0.12)', color: '#ff7070', borderColor: 'transparent', width: '100%', textAlign: 'left' })}>
                            👑 Passer en Admin Démo
                          </button>
                        )}
                        {IS_DEMO_MODE && user.is_admin === 1 && (
                          <button onClick={async () => {
                            setShowUserMenu(false);
                            const res = await api.login({ login: 'visiteur.demo' });
                            setUser(res.user);
                            loadData();
                          }} style={btn({ padding: '10px 12px', fontSize: 12, background: 'rgba(245,194,0,0.12)', color: S.gold, borderColor: 'transparent', width: '100%', textAlign: 'left' })}>
                            👤 Passer en Visiteur Démo
                          </button>
                        )}
                        {IS_DEMO_MODE && (
                          <button onClick={() => {
                            setShowUserMenu(false);
                            localStorage.clear();
                            window.location.reload();
                          }} style={btn({ padding: '10px 12px', fontSize: 12, color: S.muted, borderColor: 'transparent', width: '100%', textAlign: 'left' })}>
                            🔄 Réinitialiser la démo
                          </button>
                        )}
                        <button onClick={() => { setShowUserMenu(false); logout(); }} style={btn({ padding: '10px 12px', fontSize: 13, width: '100%', textAlign: 'left' })}>
                          🚪 Déconnexion
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setShowUserMenu(false); setModal('login'); setAuthErr(''); }} style={btn({ padding: '10px 12px', fontSize: 13, width: '100%', textAlign: 'left' })}>
                          🔑 Se connecter
                        </button>
                        {IS_DEMO_MODE && (
                          <button onClick={async () => {
                            setShowUserMenu(false);
                            const res = await api.login({ login: 'visiteur.demo' });
                            setUser(res.user);
                            loadData();
                          }} style={btn({ padding: '10px 12px', fontSize: 12, color: S.gold, background: S.goldDim, borderColor: 'transparent', width: '100%', textAlign: 'left' })}>
                            ⚽ Mode Visiteur Démo
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="nav-tabs">
            {[
              ['predictions', '🔮 PRONOSTICS'],
              ['tournament', '📊 COMPÉTITION'],
              ['leaderboard', '🏆 CLASSEMENT']
            ].map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontWeight: 600, letterSpacing: .5, transition: 'color .15s',
                color: tab === t ? S.gold : S.muted,
                borderBottom: tab === t ? `3px solid ${S.gold}` : '3px solid transparent',
              }}>{l}</button>
            ))}
          </div>

        </div>
      </div>

      {/* ── CONTENU PRINCIPAL ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', position: 'relative' }}>

        {/* ── 🔮 ONGLET PRÉDICTIONS ── */}
        {tab === 'predictions' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>



            {/* ── ZONE DES FILTRES + MASCOTTE DYNAMIQUE ── */}
            <div style={{ position: 'relative', marginBottom: 28 }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[['all', 'Tous'], ['groupes', 'Groupes'], ['phases', 'Phases finales']].map(([v, l]) => (
                    <button key={v} onClick={() => { setFilterType(v); setFilterSub('all'); }} style={{
                      padding: '8px 16px', borderRadius: 20, border: `1px solid ${S.border}`, fontSize: 13, fontWeight: 500,
                      background: filterType === v ? S.goldDim : 'transparent', color: filterType === v ? S.gold : S.muted
                    }}>{l}</button>
                  ))}
                </div>

                {filterType !== 'all' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(filterType === 'groupes' ? ['Groupe A', 'Groupe B', 'Groupe C', 'Groupe D', 'Groupe E', 'Groupe F', 'Groupe G', 'Groupe H', 'Groupe I', 'Groupe J', 'Groupe K', 'Groupe L'] : ['LAST_32', 'Huitièmes de finale', 'Quarts de finale', 'Demi-finales', 'Petite finale', 'Finale']).map(s => (
                      <button key={s} onClick={() => setFilterSub(s)} style={{
                        padding: '4px 12px', borderRadius: 6, border: `1px solid ${S.border}`, fontSize: 12,
                        background: filterSub === s ? S.goldDim : 'transparent', color: filterSub === s ? S.gold : S.muted
                      }}>
                        {s === 'LAST_32' ? 'Seizièmes' : s.replace('Groupe ', '')}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {[['upcoming_live', 'À venir / En direct'], ['finished', 'Terminés']].map(([v, l]) => (
                    <button key={v} className="chip" onClick={() => setFilterStatus(v)} style={{
                      padding: '6px 14px', borderRadius: 20, border: `1px solid ${S.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      background: filterStatus === v ? S.goldDim : 'transparent',
                      color: filterStatus === v ? S.gold : S.muted, transition: 'background .15s',
                    }}>{l}</button>
                  ))}
                </div>
              </div>

            </div>

            {Object.entries(grouped).map(([group, ms]) => (
              <div key={group} style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 2, color: S.gold }}>
                    {group.includes('Groupe') ? group.replace('Groupe ', 'GROUPE ') : (group === 'LAST_32' ? 'SEIZIÈMES DE FINALE' : group.toUpperCase())}
                  </span>
                  <div style={{ flex: 1, height: 1, background: S.border }} />
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {ms.map(m => (
                    <MatchCard key={m.id} m={m} myPred={myPreds[m.id]}
                      onPred={() => openPred(m)}
                      onViewOthers={() => openOthersPreds(m)}
                      onTeamClick={openTeamHistory}
                      onAdmin={user?.is_admin ? () => {
                        setAdminScore({ h: m.score_home ?? '', a: m.score_away ?? '' });
                        setModal({ type: 'admin', match: m });
                      } : null} />
                  ))}
                </div>
              </div>
            ))}

            <div style={{ background: S.card, borderRadius: 12, border: `1px solid ${S.gold}`, padding: 24, marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, color: S.gold, fontSize: 18 }}>🏆 Pronostics Bonus</h3>
                {!bonusData.canPredict && (
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.danger }}>
                    Pronostics clos.
                  </span>
                )}
              </div>

              <div className="bonus-grid">
                {bonusData.questions.map(q => {
                  const myAnswer = bonusData.myAnswers[q.id] || '';
                  return (
                    <div key={q.id} style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: `1px solid ${S.border}` }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: S.text }}>
                        {q.question} <span style={{ color: S.gold, fontSize: 12 }}>({q.points} pts)</span>
                      </div>

                      <div onClickCapture={(e) => {
                        if (!user) { e.stopPropagation(); setModal('login'); }
                      }}>
                        {q.type === 'number' || (q.question && q.question.toLowerCase().includes('nombre')) ? (
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              min="0"
                              value={myAnswer}
                              onChange={(e) => {
                                if (!user) return;
                                setBonusData(prev => ({ ...prev, myAnswers: { ...prev.myAnswers, [q.id]: e.target.value } }));
                              }}
                              onBlur={async (e) => {
                                if (!user) return;
                                await api.saveBonus(q.id, e.target.value);
                              }}
                              disabled={!bonusData.canPredict || !user}
                              placeholder="Ex: 172"
                              style={{ width: '100%', padding: '10px 30px 10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.05)', color: S.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                            />
                            {myAnswer && bonusData.canPredict && user && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setBonusData(prev => ({ ...prev, myAnswers: { ...prev.myAnswers, [q.id]: '' } }));
                                  await api.saveBonus(q.id, '');
                                }}
                                style={{
                                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                  background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: 20,
                                  padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                                title="Retirer le pronostic"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ) : (
                          <Select
                            options={q.type === 'team' ? TEAM_OPTIONS : PLAYER_OPTIONS}
                            value={myAnswer ? { value: myAnswer, label: myAnswer } : null}
                            onChange={async (selectedOption) => {
                              if (!user) return;
                              const val = selectedOption ? selectedOption.value : '';
                              setBonusData(prev => ({ ...prev, myAnswers: { ...prev.myAnswers, [q.id]: val } }));
                              await api.saveBonus(q.id, val);
                            }}
                            isDisabled={!bonusData.canPredict || !user}
                            placeholder={q.type === 'team' ? 'Recherchez une équipe...' : 'Recherchez un joueur...'}
                            isClearable
                            isSearchable
                            styles={selectStyles}
                            noOptionsMessage={() => "Aucun résultat"}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 📊 ONGLET TOURNOI ── */}
        {tab === 'tournament' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>
            {/* ── STATS COMPETITION ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ color: S.muted, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Matchs Terminés</div>
                <div style={{ color: S.text, fontSize: 28, fontWeight: 800 }}>{finishedMatchesCount} <span style={{ fontSize: 16, color: S.muted }}>/ {totalMatchesCount}</span></div>
              </div>
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ color: S.muted, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Buts Inscrits</div>
                <div style={{ color: S.gold, fontSize: 28, fontWeight: 800 }}>{totalGoals}</div>
              </div>
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <div style={{ color: S.muted, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Moy. Buts / Match</div>
                <div style={{ color: S.live, fontSize: 28, fontWeight: 800 }}>{avgGoals}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
              {/* Meilleurs Buteurs */}
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ color: S.gold, fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚽ Meilleurs Buteurs
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topScorers.length > 0 ? topScorers.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: i === 0 ? S.gold : S.muted, fontWeight: 700, width: 16 }}>{i + 1}.</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{s.player.name}</div>
                          <div style={{ fontSize: 11, color: S.muted }}>{s.team.name}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: S.text }}>{s.goals}</div>
                    </div>
                  )) : <div style={{ fontSize: 13, color: S.muted }}>Aucune donnée disponible</div>}
                </div>
              </div>

              {/* Meilleurs Passeurs */}
              <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ color: S.live, fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  👟 Meilleurs Passeurs
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topAssists.length > 0 ? topAssists.map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: i === 0 ? S.live : S.muted, fontWeight: 700, width: 16 }}>{i + 1}.</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{s.player_name}</div>
                          <div style={{ fontSize: 11, color: S.muted }}>{s.team_name}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: S.text }}>{s.assists}</div>
                    </div>
                  )) : <div style={{ fontSize: 13, color: S.muted }}>Données non disponibles pour le moment</div>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 28, borderBottom: `1px solid ${S.border}`, paddingBottom: 12 }}>
              <button onClick={() => setTournamentSubTab('groups')} style={{
                background: tournamentSubTab === 'groups' ? S.goldDim : 'transparent', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 6,
                fontSize: 14, fontWeight: 600, color: tournamentSubTab === 'groups' ? S.gold : S.muted,
              }}>📊 Classement des Groupes</button>
              <button onClick={() => setTournamentSubTab('brackets')} style={{
                background: tournamentSubTab === 'brackets' ? S.goldDim : 'transparent', border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: 6,
                fontSize: 14, fontWeight: 600, color: tournamentSubTab === 'brackets' ? S.gold : S.muted,
              }}>🏆 Phases Finales</button>
            </div>

            {tournamentSubTab === 'groups' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                {Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i)).map(letter => {
                  const groupName = `Groupe ${letter}`;
                  const standings = getGroupStandings(groupName, matches);
                  const groupMatches = matches.filter(m => m.group_name === groupName);

                  return (
                    <div key={groupName} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
                      <h3 style={{ margin: '0 0 16px 0', color: S.gold, fontSize: 16, borderBottom: `1px solid ${S.border}`, paddingBottom: 8 }}>
                        Groupe {letter}
                      </h3>

                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', color: S.muted, fontSize: 12, paddingBottom: 8 }}>Équipe</th>
                            <th style={{ color: S.muted, fontSize: 12, paddingBottom: 8 }}>J</th>
                            <th style={{ color: S.muted, fontSize: 12, paddingBottom: 8 }}>Pts</th>
                            <th style={{ color: S.muted, fontSize: 12, paddingBottom: 8 }}>Diff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((team, idx) => (
                            <tr key={team.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                              <td style={{ textAlign: 'left', fontSize: 14, padding: '8px 0', fontWeight: idx < 2 ? 600 : 400, color: idx < 2 ? S.text : S.muted }}>
                                <span style={{ marginRight: 8, color: idx < 2 ? S.live : S.muted, fontSize: 12 }}>{idx + 1}.</span>
                                <img src={getFlagUrl(team.name)} style={{ width: 18, marginRight: 8, verticalAlign: 'middle' }} alt="" />
                                {team.name}
                              </td>
                              <td style={{ textAlign: 'center', fontSize: 14, color: S.muted }}>{team.j}</td>
                              <td style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: idx < 2 ? S.gold : S.text }}>{team.pts}</td>
                              <td style={{ textAlign: 'center', fontSize: 14, color: team.diff > 0 ? S.live : team.diff < 0 ? S.danger : S.muted }}>
                                {team.diff > 0 ? `+${team.diff}` : team.diff}
                              </td>
                            </tr>
                          ))}
                          {standings.length === 0 && (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', color: S.muted, fontSize: 13, padding: 16 }}>Aucune équipe définie</td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      <div style={{ fontSize: 12, color: S.muted, marginBottom: 8, fontWeight: 600 }}>Matchs :</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {groupMatches.map(m => {
                          const dateObj = new Date(m.date);
                          const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                          const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}` }}>
                              <div style={{ fontSize: 12, flex: 1, display: 'flex', alignItems: 'center' }}>
                                <img src={getFlagUrl(m.home_team)} style={{ width: 16, marginRight: 6, flexShrink: 0 }} alt="" />
                                <span>{m.home_team}</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
                                <div style={{ fontSize: 9, color: S.muted, marginBottom: 2 }}>{dateStr} - {timeStr}</div>
                                <div style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', background: m.status === 'live' ? S.liveDim : S.border, color: m.status === 'live' ? S.live : S.text, borderRadius: 6, minWidth: 40, textAlign: 'center' }}>
                                  {m.score_home ?? '-'} - {m.score_away ?? '-'}
                                </div>
                              </div>
                              <div style={{ fontSize: 12, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', textAlign: 'right' }}>
                                <span>{m.away_team}</span>
                                <img src={getFlagUrl(m.away_team)} style={{ width: 16, marginLeft: 6, flexShrink: 0 }} alt="" />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tournamentSubTab === 'brackets' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '16px 0' }}>
                {[
                  { key: 'LAST_32', label: 'Seizièmes de finale' },
                  { key: 'Huitièmes de finale', label: 'Huitièmes de finale' },
                  { key: 'Quarts de finale', label: 'Quarts de finale' },
                  { key: 'Demi-finales', label: 'Demi-finales' },
                  { key: 'Petite finale', label: 'Petite finale' },
                  { key: 'Finale', label: 'Finale' }
                ].map((round, index) => {
                  const roundMatches = matches.filter(m => m.group_name === round.key);
                  if (roundMatches.length === 0) return null;

                  return (
                    <div key={round.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

                      <div style={{ fontWeight: 700, fontSize: 18, color: S.text, marginBottom: 20 }}>
                        {round.label}
                      </div>

                      <div style={{
                        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, maxWidth: '100%'
                      }}>
                        {roundMatches.map(m => (
                          <MiniBracketCard key={m.id} m={m} onViewOthers={() => openOthersPreds(m)} onAdmin={user?.is_admin ? () => {
                            setAdminScore({ h: m.score_home ?? '', a: m.score_away ?? '' });
                            setModal({ type: 'admin', match: m });
                          } : null} />
                        ))}
                      </div>

                      {index !== 5 && (
                        <div style={{ width: 2, height: 40, background: S.border, marginTop: 24 }}></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CLASSEMENT DES JOUEURS ── */}
        {tab === 'leaderboard' && (
          <div style={{ animation: 'fadeIn .3s ease' }}>

            {!user ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', background: S.card, borderRadius: 16, border: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 56, marginBottom: 20 }}>🔒</div>
                <h2 style={{ color: S.gold, margin: '0 0 12px 0', fontSize: 24 }}>Classement privé</h2>
                <p style={{ color: S.muted, marginBottom: 32, fontSize: 16 }}>Connectez-vous pour découvrir le classement général de la compétition.</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <button onClick={() => { setModal('login'); setAuthErr(''); }} style={btn({ padding: '12px 24px', fontSize: 15 })}>Se connecter</button>
                </div>
              </div>
            ) : (
              <>
                <div className="lb-header" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                  <span style={{ fontSize: 24 }}>🏆</span>
                  <h2 className="lb-title" style={{ margin: 0, fontSize: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>Classement général</h2>
                </div>

                {myRank > 0 && (
                  <div style={{
                    marginBottom: 24, padding: '16px 20px', background: 'linear-gradient(135deg, rgba(245,194,0,0.15) 0%, rgba(245,194,0,0.05) 100%)',
                    border: `1px solid ${S.gold}`, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16,
                    boxShadow: '0 4px 12px rgba(245,194,0,0.1)'
                  }}>
                    <div style={{ fontSize: 36 }}>⭐</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Votre position</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: S.text }}>
                        {myRank === 1 ? '1er' : myRank === 2 ? '2ème' : myRank === 3 ? '3ème' : `${myRank}ème`} <span style={{ fontSize: 14, fontWeight: 500, color: S.muted }}>sur {leaderboard.length}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontSize: 11, color: S.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Vos points</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: S.gold }}>{leaderboard[myRank - 1].total || 0}</div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 12 }}>
                  {leaderboard.map((u, i) => (
                    <div key={u.id} className="lb-row" style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
                      background: u.id === user?.id ? 'rgba(245,194,0,0.07)' : S.card,
                      border: `1px solid ${u.id === user?.id ? S.gold : S.border}`,
                      borderRadius: 16,
                    }}>
                      <div style={{ minWidth: 30, textAlign: 'center' }}>
                        {i === 0 ? <span style={{ fontSize: "1.5rem" }}>🥇</span>
                          : i === 1 ? <span style={{ fontSize: "1.5rem" }}>🥈</span>
                            : i === 2 ? <span style={{ fontSize: "1.5rem" }}>🥉</span>
                              : <span style={{ fontSize: 20, color: S.muted, fontWeight: 700 }}>#{i + 1}</span>}
                      </div>

                      {/* Partie Gauche : Pseudo + Petites Stats */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 16, color: u.id === user?.id ? S.gold : S.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(u.username && u.username !== 'NULL' && u.username.trim() !== '') ? u.username : u.login}
                          {u.id === user?.id && <span style={{ fontSize: 13, color: S.muted }}> (vous)</span>}
                        </div>

                        {/* 🔥 FIX : alignItems 'center' ajouté ici ! */}
                        <div className="lb-stats-container" style={{ display: 'flex', gap: '12px 20px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {[
                            ['Bon Vainqueur', u.vainqueur, '#00bfff'],
                            ['Bon Ecart', u.difference, S.live],
                            ['Bon Score', u.exact, S.gold]
                          ].map(([l, v, c]) => (
                            <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div className="lb-sub-label" style={{ fontSize: 9, color: S.muted, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{v || 0}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Partie Droite : Uniquement les Points */}
                      <div className="lb-points-container" style={{ textAlign: 'center', minWidth: 60 }}>
                        <div style={{ fontSize: 10, color: S.muted, textTransform: 'uppercase', letterSpacing: .5 }}>Points</div>
                        <div className="lb-points-value" style={{ fontSize: 32, fontWeight: 700, color: S.gold }}>{u.total || 0}</div>
                      </div>
                    </div>
                  ))}
                  {leaderboard.length === 0 && <div style={{ color: S.muted, textAlign: 'center', padding: 40, fontSize: 15 }}>Aucun joueur pour l'instant.</div>}
                </div>
                <div style={{ marginTop: 24, padding: '20px 24px', background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Système de points</div>
                  <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 14, color: S.muted }}>
                    <span><b style={{ color: S.gold }}>+4 pts</b> — Score exact</span>
                    <span><b style={{ color: S.live }}>+3 pts</b> — Bonne différence de buts</span>
                    <span><b style={{ color: '#00bfff' }}>+2 pts</b> — Bon vainqueur</span>
                    <span><b style={{ color: S.danger }}>0 pt</b> — Mauvais pronostic</span>
                  </div>
                  <div style={{ fontSize: 13, color: S.muted, marginTop: 12, borderTop: `1px solid ${S.border}`, paddingTop: 12 }}>
                    <i>Critères de départage en cas d'égalité :</i> 1. Points, 2. Nombre de scores exacts, 3. Nombre de bonnes différences, 4. Nombre de bons vainqueurs.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* ── MODALES ── */}
      {modal === 'login' && (
        <Overlay onClose={() => setModal(null)}>
          <ModalBox>

            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
              Se connecter
            </div>

            <div style={{ fontSize: 14, color: S.muted, marginBottom: 24 }}>
              Accédez à votre espace
            </div>

            <AuthInput
              type="text"
              placeholder="Identifiant (prénom.nom)"
              value={form.username}
              onChange={v => {
                const normalized = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\^¨`´]/g, "");
                setForm(f => ({ ...f, username: normalized }));
              }}
            />

            <AuthInput type="password" placeholder="Mot de passe" value={form.password}
              onChange={v => setForm(f => ({ ...f, password: v }))}
              onEnter={login} />

            {authErr && <div style={{ fontSize: 13, color: S.danger, marginBottom: 10 }}>{authErr}</div>}

            <GoldButton onClick={login}>
              Se connecter
            </GoldButton>

            {IS_DEMO_MODE && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: S.muted, textAlign: 'center' }}>
                  Accès rapide pour recruteurs & visiteurs :
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await api.login({ login: 'visiteur.demo' });
                    setUser(res.user);
                    setModal(null);
                    setAuthErr('');
                    loadData();
                  }}
                  style={btn({ padding: '12px', fontSize: 13, background: S.goldDim, color: S.gold, borderColor: 'transparent', width: '100%', fontWeight: 700 })}
                >
                  ⚽ Accéder en tant que Visiteur Démo
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await api.login({ login: 'admin.demo' });
                    setUser(res.user);
                    setModal(null);
                    setAuthErr('');
                    loadData();
                  }}
                  style={btn({ padding: '12px', fontSize: 13, background: 'rgba(255,70,70,0.15)', color: '#ff7070', borderColor: 'transparent', width: '100%', fontWeight: 700 })}
                >
                  👑 Tester en mode Administrateur Démo
                </button>
              </div>
            )}

          </ModalBox>
        </Overlay>
      )}

      {modal === 'change_password' && (
        <Overlay onClose={() => setModal('login')}>
          <ModalBox>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: S.gold }}>Sécurité</div>
            <div style={{ fontSize: 14, color: S.muted, marginBottom: 24 }}>
              Il s'agit d'un mot de passe provisoire. Veuillez en choisir un nouveau pour sécuriser votre compte.
            </div>

            <AuthInput
              type="password"
              placeholder="Nouveau mot de passe"
              value={form.newPassword || ''}
              onChange={v => setForm(f => ({ ...f, newPassword: v }))}
              onEnter={submitNewPassword}
            />

            {authErr && <div style={{ fontSize: 13, color: S.danger, marginBottom: 10 }}>{authErr}</div>}

            <GoldButton onClick={submitNewPassword}>Mettre à jour et me connecter</GoldButton>
          </ModalBox>
        </Overlay>
      )}

      {/* ── PANNEAU ADMIN ── */}
      {modal === 'adminPanel' && user?.is_admin === 1 && (
        <Overlay onClose={() => setModal(null)}>
          <ModalBox style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#ff7070' }}>⚙️ Administration</div>

            {/* 1. Création de compte */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, marginBottom: 20, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: S.text }}>➕ Créer un compte collaborateur</div>

              <AuthInput
                type="text"
                placeholder="Identifiant prénom.nom (Obligatoire)"
                value={adminPanel.newLogin}
                onChange={v => {
                  const normalized = v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\^¨`´]/g, "");
                  setAdminPanel(p => ({ ...p, newLogin: normalized }));
                }}
              />

              <AuthInput
                type="text"
                placeholder="Pseudo (Optionnel)"
                value={adminPanel.newUsername}
                onChange={v => setAdminPanel(p => ({ ...p, newUsername: v }))}
              />
              <AuthInput
                type="password"
                placeholder="Mot de passe provisoire"
                value={adminPanel.newPassword}
                onChange={v => setAdminPanel(p => ({ ...p, newPassword: v }))}
              />
              <GoldButton onClick={handleAdminCreate}>Créer et imposer ce mot de passe</GoldButton>
            </div>

            {/* 2. Réinitialisation de mot de passe */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: S.text }}>🔑 Réinitialiser un accès</div>

              <select
                value={adminPanel.resetUserId}
                onChange={e => setAdminPanel(p => ({ ...p, resetUserId: e.target.value }))}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.05)', color: S.text, fontSize: 14, marginBottom: 12, outline: 'none' }}
              >
                <option value="" style={{ background: S.bg, color: S.text }}>-- Sélectionner un utilisateur --</option>
                {leaderboard.map(u => (
                  <option key={u.id} value={u.id} style={{ background: S.bg, color: S.text }}>{(u.username && u.username.trim() !== '') ? u.username : u.login}</option>
                ))}
              </select>

              <AuthInput
                type="password"
                placeholder="Nouveau MDP provisoire"
                value={adminPanel.resetPassword}
                onChange={v => setAdminPanel(p => ({ ...p, resetPassword: v }))}
              />
              <button onClick={handleAdminReset} style={{ display: 'block', width: '100%', padding: 14, borderRadius: 10, border: 'none', background: 'rgba(255,70,70,0.2)', color: '#ff7070', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Forcer la réinitialisation
              </button>
            </div>

            {/* 3. Résolution des Bonus */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, border: `1px solid ${S.border}`, marginTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: S.text }}>🏆 Résolution des Pronostics Bonus</div>
              <div className="bonus-grid" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bonusData.questions.map(q => {
                  const adminAnswer = q.real_answer || '';
                  return (
                    <div key={q.id} style={{ padding: 12, border: `1px solid ${S.border}`, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: 13, color: S.text, marginBottom: 8, fontWeight: 500 }}>{q.question}</div>

                      {q.type === 'number' || (q.question && q.question.toLowerCase().includes('nombre')) ? (
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            min="0"
                            value={adminAnswer}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setBonusData(prev => ({
                                ...prev,
                                questions: prev.questions.map(bq => bq.id === q.id ? { ...bq, real_answer: newVal } : bq)
                              }));
                            }}
                            onBlur={async (e) => {
                              try {
                                setAdminPanel(p => ({ ...p, msg: '', error: '' }));
                                const val = e.target.value;
                                await api.resolveBonusAdmin(q.id, val, val ? 'finished' : 'pending');
                                setAdminPanel(p => ({ ...p, msg: 'Bonus mis à jour !' }));
                              } catch (err) {
                                setAdminPanel(p => ({ ...p, error: err.message }));
                              }
                            }}
                            placeholder="Nombre exact..."
                            style={{ width: '100%', padding: '10px 30px 10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.05)', color: S.text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                          />
                          {adminAnswer && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setBonusData(prev => ({
                                  ...prev,
                                  questions: prev.questions.map(bq => bq.id === q.id ? { ...bq, real_answer: '' } : bq)
                                }));
                                try {
                                  await api.resolveBonusAdmin(q.id, '', 'pending');
                                  setAdminPanel(p => ({ ...p, msg: 'Résultat retiré !' }));
                                } catch (err) {
                                  setAdminPanel(p => ({ ...p, error: err.message }));
                                }
                              }}
                              style={{
                                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: S.danger, cursor: 'pointer', fontSize: 20,
                                padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                              title="Retirer le résultat"
                            >
                              &times;
                            </button>
                          )}
                        </div>
                      ) : (
                        <Select
                          options={q.type === 'team' ? TEAM_OPTIONS : PLAYER_OPTIONS}
                          value={adminAnswer ? { value: adminAnswer, label: adminAnswer } : null}
                          onChange={async (selectedOption) => {
                            const val = selectedOption ? selectedOption.value : '';
                            setBonusData(prev => ({
                              ...prev,
                              questions: prev.questions.map(bq => bq.id === q.id ? { ...bq, real_answer: val } : bq)
                            }));
                            try {
                              setAdminPanel(p => ({ ...p, msg: '', error: '' }));
                              await api.resolveBonusAdmin(q.id, val, val ? 'finished' : 'pending');
                              setAdminPanel(p => ({ ...p, msg: val ? 'Bonus mis à jour !' : 'Résultat retiré !' }));
                            } catch (err) {
                              setAdminPanel(p => ({ ...p, error: err.message }));
                            }
                          }}
                          placeholder={q.type === 'team' ? 'Recherchez une équipe...' : 'Recherchez un joueur...'}
                          isClearable
                          isSearchable
                          styles={selectStyles}
                          noOptionsMessage={() => "Aucun résultat"}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Gestion des Passeurs */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, border: `1px solid ${S.border}`, marginTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: S.text }}>👟 Gestion des Passeurs</div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <Select
                    options={PLAYER_OPTIONS}
                    value={adminAssistForm.player_name ? { value: adminAssistForm.player_name, label: adminAssistForm.player_name } : null}
                    onChange={(selectedOption) => {
                      const val = selectedOption ? selectedOption.value : '';
                      let team = adminAssistForm.team_name;
                      if (val) {
                        for (const [country, players] of Object.entries(PLAYERS_BY_COUNTRY)) {
                          if (players.includes(val)) {
                            team = country;
                            break;
                          }
                        }
                      }
                      setAdminAssistForm(p => ({ ...p, player_name: val, team_name: team }));
                    }}
                    placeholder="Rechercher un joueur..."
                    isClearable
                    isSearchable
                    styles={{
                      ...selectStyles,
                      control: (base, state) => ({
                        ...selectStyles.control(base, state),
                        padding: '0px 0',
                        minHeight: '42px',
                        fontSize: 14,
                        borderRadius: 8
                      })
                    }}
                    noOptionsMessage={() => "Aucun résultat"}
                  />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <AuthInput
                    type="text"
                    placeholder="Équipe"
                    value={adminAssistForm.team_name}
                    onChange={v => setAdminAssistForm(p => ({ ...p, team_name: v }))}
                  />
                </div>
                <div style={{ width: '80px', flex: 'none' }}>
                  <AuthInput
                    type="number"
                    placeholder="Passes"
                    value={adminAssistForm.assists}
                    onChange={v => setAdminAssistForm(p => ({ ...p, assists: v }))}
                  />
                </div>
                <GoldButton onClick={handleSaveManualAssist} style={{ padding: '0 20px', flex: 'none', height: '42px', marginTop: 0, alignSelf: 'stretch' }}>
                  Enregistrer
                </GoldButton>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {manualAssists.map(ma => (
                  <div key={ma.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8, border: `1px solid ${S.border}` }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{ma.player_name}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{ma.team_name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: S.live }}>{ma.assists}</div>
                      <button onClick={() => handleDeleteManualAssist(ma.id)} style={{ background: 'transparent', border: 'none', color: S.danger, cursor: 'pointer', fontSize: 20 }}>
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
                {manualAssists.length === 0 && <div style={{ fontSize: 13, color: S.muted, textAlign: 'center' }}>Aucun passeur enregistré.</div>}
              </div>
            </div>

            {adminPanel.msg && <div style={{ fontSize: 14, color: S.live, marginTop: 20, textAlign: 'center', fontWeight: 600 }}>✅ {adminPanel.msg}</div>}
            {adminPanel.error && <div style={{ fontSize: 14, color: S.danger, marginTop: 20, textAlign: 'center', fontWeight: 600 }}>❌ {adminPanel.error}</div>}
          </ModalBox>
        </Overlay>
      )}

      {modal?.type === 'pred' && (
        <Overlay onClose={() => setModal(null)}>
          <ModalBox>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              {modal.match.group_name.includes('Groupe') ? modal.match.group_name.replace('Groupe ', 'GROUPE ') : (modal.match.group_name === 'LAST_32' ? 'SEIZIÈMES DE FINALE' : modal.match.group_name.toUpperCase())} · {new Date(modal.match.date).toLocaleDateString('fr-FR')} à {new Date(modal.match.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28, width: '100%' }}>
              <span style={{ fontSize: 16, fontWeight: 600, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {modal.match.home_team}
                <img src={getFlagUrl(modal.match.home_team)} style={{ marginLeft: 10, width: 28 }} alt={modal.match.home_team} />
              </span>
              <span style={{ fontSize: 20, color: S.muted, padding: '0 20px', fontWeight: 800 }}>vs</span>
              <span style={{ fontSize: 16, fontWeight: 600, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                <img src={getFlagUrl(modal.match.away_team)} style={{ marginRight: 10, width: 28 }} alt={modal.match.away_team} />
                {modal.match.away_team}
              </span>
            </div>

            <div style={{ fontSize: 14, color: S.muted, marginBottom: 12, textAlign: 'center' }}>Votre pronostic</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              <ScoreInput placeholder="0" value={predInput.h} onChange={v => setPredInput(p => ({ ...p, h: v }))} />
              <span style={{ fontSize: 26, color: S.muted }}>–</span>
              <ScoreInput placeholder="0" value={predInput.a} onChange={v => setPredInput(p => ({ ...p, a: v }))} />
            </div>
            <GoldButton onClick={() => savePred(modal.match.id)}>Confirmer</GoldButton>

            {myPreds[modal.match.id] && (
              <button onClick={() => removePred(modal.match.id)} style={{
                display: 'block', width: '100%', padding: 14, borderRadius: 10, marginTop: 12,
                border: `1px solid ${S.danger}`, background: 'transparent', color: S.danger,
                fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'background .15s'
              }}>
                Retirer mon pronostic
              </button>
            )}
          </ModalBox>
        </Overlay>
      )}

      {modal?.type === 'admin' && (
        <Overlay onClose={() => setModal(null)}>
          <ModalBox>
            <div style={{ fontSize: 16, color: '#ff7070', fontWeight: 700, marginBottom: 14 }}>⚙️ Mise à jour du score (Admin)</div>
            <div style={{ fontSize: 14, marginBottom: 20, color: S.muted }}>
              {modal.match.home_team} vs {modal.match.away_team}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
              <ScoreInput value={adminScore.h} onChange={v => setAdminScore(s => ({ ...s, h: v }))} />
              <span style={{ fontSize: 26, color: S.muted }}>–</span>
              <ScoreInput value={adminScore.a} onChange={v => setAdminScore(s => ({ ...s, a: v }))} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button
                onClick={() => updateScore(modal.match.id, 'upcoming')}
                style={btn({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: S.gold, borderColor: S.gold, padding: '10px' })}
              >
                <span>🕐</span>
                <span>A Venir</span>
              </button>

              <button
                onClick={() => updateScore(modal.match.id, 'live')}
                style={btn({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: S.live, borderColor: S.live, padding: '10px' })}
              >
                <span>🔴</span>
                <span>En direct</span>
              </button>

              <button
                onClick={() => updateScore(modal.match.id, 'finished')}
                style={btn({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: S.gold, borderColor: S.gold, padding: '10px' })}
              >
                <span>✅</span>
                <span>Terminé</span>
              </button>
            </div>

            <button
              onClick={async () => {
                try {
                  const data = await api.getMatchApiStatus(modal.match.id);
                  alert(`Statut officiel renvoyé par l'API : ${data.status}\nScore : ${data.score_home ?? '-'} - ${data.score_away ?? '-'}`);
                } catch (e) {
                  alert("Erreur: " + e.message);
                }
              }}
              style={{ ...btn({ padding: '12px', color: '#8ecae6', borderColor: 'transparent', background: 'rgba(142, 202, 230, 0.1)' }), width: '100%', marginTop: '10px' }}
            >
              📡 Interroger l'API pour ce match
            </button>
          </ModalBox>
        </Overlay>
      )}

      {modal === 'others_preds' && othersPredsData.match && (
        <Overlay onClose={() => setModal(null)}>
          <ModalBox style={{ padding: '24px 20px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: S.gold, textAlign: 'center' }}>
              Pronostics des joueurs
            </div>
            <div style={{ fontSize: 14, color: S.muted, marginBottom: 20, textAlign: 'center' }}>
              {othersPredsData.match.home_team} vs {othersPredsData.match.away_team} ({othersPredsData.match.score_home}-{othersPredsData.match.score_away})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {othersPredsData.preds.length === 0 ? (
                <div style={{ color: S.muted, textAlign: 'center', padding: 20 }}>Aucun pronostic pour ce match.</div>
              ) : (
                othersPredsData.preds.map((p, idx) => {
                  const pts = calcPts(p.pred_home, p.pred_away, othersPredsData.match.score_home, othersPredsData.match.score_away);
                  const color = ptsColor(pts);
                  const mult = getMultiplier(othersPredsData.match.group_name);
                  return (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.03)', padding: '12px 16px',
                      borderRadius: 12, border: `1px solid ${S.border}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 600, color: S.text, fontSize: 15 }}>
                          {(p.username && p.username !== 'NULL' && p.username.trim() !== '') ? p.username : p.login}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{p.pred_home} - {p.pred_away}</div>
                        <div style={{ fontSize: 12, color: color, fontWeight: 600 }}>{pts !== null ? ptsLabel(pts, mult) : '0'} pts</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button onClick={() => setModal(null)} style={{ ...btn({ padding: '10px 24px', fontSize: 14 }), background: 'transparent', border: `1px solid ${S.border}`, color: S.text }}>Fermer</button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {modal === 'online_users' && (
        <Overlay onClose={() => setModal(null)}>
          <ModalBox style={{ padding: '24px 20px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: S.gold, textAlign: 'center' }}>
              Utilisateurs en ligne
            </div>
            <div style={{ fontSize: 14, color: S.muted, marginBottom: 20, textAlign: 'center' }}>
              {onlineCount} connexion(s) au total
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {onlineUsersList.length === 0 ? (
                <div style={{ color: S.muted, textAlign: 'center', padding: 10 }}>Aucun joueur identifié en ligne.</div>
              ) : (
                onlineUsersList.map((u, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)', padding: '12px 16px',
                    borderRadius: 12, border: `1px solid ${S.border}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 600, color: S.text, fontSize: 15 }}>
                        {(u.username && u.username !== 'NULL' && u.username.trim() !== '') ? u.username : u.login}
                      </span>
                    </div>
                  </div>
                ))
              )}
              {anonymousCount > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.01)', padding: '12px 16px',
                  borderRadius: 12, border: `1px dashed ${S.border}`, color: S.muted
                }}>
                  + {anonymousCount} visiteur(s) anonyme(s)
                </div>
              )}
            </div>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button onClick={() => setModal(null)} style={{ ...btn({ padding: '10px 24px', fontSize: 14 }), background: 'transparent', border: `1px solid ${S.border}`, color: S.text }}>Fermer</button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {modal === 'team_history' && teamHistoryData.teamName && (
        <Overlay onClose={() => setModal(null)}>
          <ModalBox style={{ padding: '24px 20px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
              <img src={getFlagUrl(teamHistoryData.teamName)} style={{ width: 32, borderRadius: 4 }} alt={teamHistoryData.teamName} />
              <div style={{ fontSize: 22, fontWeight: 700, color: S.gold }}>
                {teamHistoryData.teamName}
              </div>
            </div>
            <div style={{ fontSize: 14, color: S.muted, marginBottom: 20, textAlign: 'center' }}>
              Historique des matchs
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teamHistoryData.matches.length === 0 ? (
                <div style={{ color: S.muted, textAlign: 'center', padding: 20 }}>Aucun match trouvé pour cette équipe.</div>
              ) : (
                teamHistoryData.matches.map(m => {
                  const dateObj = new Date(m.date);
                  const isHome = m.home_team === teamHistoryData.teamName;
                  const opponent = isHome ? m.away_team : m.home_team;
                  const scoreDisplay = m.status === 'finished' || m.status === 'live' ?
                    (isHome ? `${m.score_home ?? 0} - ${m.score_away ?? 0}` : `${m.score_away ?? 0} - ${m.score_home ?? 0}`) :
                    dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                  // Calcul victoire/defaite pour la couleur
                  let matchResultColor = S.text;
                  if (m.status === 'finished') {
                    const myScore = isHome ? m.score_home : m.score_away;
                    const opScore = isHome ? m.score_away : m.score_home;
                    if (myScore > opScore) matchResultColor = '#00e676';
                    else if (myScore < opScore) matchResultColor = '#ff4c4c';
                    else matchResultColor = '#fb8500';
                  }

                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'rgba(255,255,255,0.03)', padding: '12px 16px',
                      borderRadius: 12, border: `1px solid ${m.status === 'live' ? '#ff4c4c' : S.border}`
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 11, color: S.muted }}>
                          {dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} • {m.group_name.includes('Groupe') ? m.group_name.replace('Groupe ', 'Gr. ') : (m.group_name === 'LAST_32' ? '1/16' : m.group_name)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: S.muted }}>vs</span>
                          <img src={getFlagUrl(opponent)} style={{ width: 20, borderRadius: 2 }} alt={opponent} />
                          <span style={{ fontWeight: 600, color: S.text, fontSize: 15 }}>
                            {opponent}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 18, color: matchResultColor }}>{scoreDisplay}</div>
                        {m.status === 'upcoming' && <div style={{ fontSize: 10, color: S.muted, fontWeight: 700, background: S.goldDim, padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>À VENIR</div>}
                        {m.status === 'live' && <div style={{ fontSize: 10, color: 'white', fontWeight: 700, background: '#ff4c4c', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginTop: 4, animation: 'pulse 1.5s infinite' }}>EN DIRECT</div>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button onClick={() => setModal(null)} style={{ ...btn({ padding: '10px 24px', fontSize: 14 }), background: 'transparent', border: `1px solid ${S.border}`, color: S.text }}>Fermer</button>
            </div>
          </ModalBox>
        </Overlay>
      )}

      {/* ── CHAT GLOBAL ── */}
      {user && <ChatComponent user={user} socket={socket} />}

    </div>
  );
}