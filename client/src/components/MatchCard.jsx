import React, { useState, useEffect } from 'react';
import { S } from '../styles';
import { calcPts, ptsColor, ptsLabel, getFlagUrl, getMultiplier } from '../utils';

export default function MatchCard({ m, myPred, onPred, onAdmin, onViewOthers, onTeamClick }) {
  const p = (m.status === 'finished' || m.status === 'live') && m.score_home !== null && myPred
    ? calcPts(myPred.pred_home, myPred.pred_away, m.score_home, m.score_away) : null;

  const dateObj = new Date(m.date);
  const heureMatch = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateMatch = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (m.status === 'live') {
      const interval = setInterval(() => setNow(new Date()), 60000); // Met à jour chaque minute
      return () => clearInterval(interval);
    }
  }, [m.status]);

  const isStarted = now >= dateObj || m.status !== 'upcoming';
  const isClickable = !!onPred && !isStarted;
  const mult = getMultiplier(m.group_name);

  let displayMinute = m.minute;
  if (!displayMinute && m.status === 'live') {
    const diffMins = Math.floor((now - dateObj) / 60000);
    if (diffMins >= 0) {
      if (diffMins <= 45) {
        displayMinute = `${diffMins}'`;
      } else if (diffMins > 45 && diffMins <= 50) {
        displayMinute = `45+${diffMins - 45}'`;
      } else if (diffMins > 50 && diffMins <= 60) {
        displayMinute = 'MT';
      } else if (diffMins > 60 && diffMins <= 105) {
        displayMinute = `${diffMins - 15}'`;
      } else {
        displayMinute = `90+${diffMins - 105}'`;
      }
    }
  }

  return (
    <div className="mc" onClick={isClickable ? onPred : null} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
      background: S.card,
      border: `2px solid ${m.status === 'live' ? '#ff4c4c' : S.border}`,
      borderRadius: 12, cursor: isClickable ? 'pointer' : 'default',
      boxShadow: m.status === 'live' ? '0 0 10px rgba(255, 76, 76, 0.3)' : 'none',
      transition: 'all 0.3s ease'
    }}>
      <div className="mc-left" style={{ flex: 1, textAlign: 'left', fontSize: 11, color: S.muted }}>
        <div className="mc-top-row">
          <div className="mc-status" style={{ marginBottom: '6px' }}>
            {m.status === 'live' && (
              <span style={{
                background: '#ff4c4c', color: 'white', padding: '2px 6px',
                borderRadius: 4, fontWeight: 800, fontSize: 10, marginRight: 5,
                display: 'inline-block', animation: 'pulse 1.5s infinite'
              }}>
                LIVE {displayMinute ? `• ${displayMinute}` : ''}
              </span>
            )}
            {m.status === 'upcoming' && (
              <span style={{
                background: S.gold, color: '#000', padding: '2px 6px',
                borderRadius: 4, fontWeight: 800, fontSize: 10, marginRight: 5,
                display: 'inline-block'
              }}>À VENIR</span>
            )}
            {m.status === 'finished' && (
              <span style={{
                background: S.done, color: '#000', padding: '2px 6px',
                borderRadius: 4, fontWeight: 800, fontSize: 10, marginRight: 5,
                display: 'inline-block'
              }}>TERMINÉ</span>
            )}
            {mult > 1 && (
              <span style={{
                background: mult === 5 ? '#ffb703' : mult === 3 ? '#fb8500' : '#8ecae6', color: '#000', padding: '2px 6px',
                borderRadius: 4, fontWeight: 800, fontSize: 10, marginRight: 5,
                display: 'inline-block'
              }}>{mult === 5 ? '🏆 Points x5' : mult === 3 ? '⭐ Points x3' : '🔥 Points x2'}</span>
            )}
          </div>
          <div className="mc-time" style={{ marginBottom: '6px' }}>
            {heureMatch}
          </div>
        </div>
        <div className="mc-teams" style={{ color: S.text, fontSize: 14, fontWeight: 600 }}>
          <span className="mc-team-home"
            onClick={(e) => {
              if (onTeamClick) {
                e.stopPropagation();
                onTeamClick(m.home_team);
              }
            }}
            style={onTeamClick && m.home_team !== 'À définir' ? { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'color 0.2s' } : { display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={e => onTeamClick && m.home_team !== 'À définir' ? e.currentTarget.style.color = S.gold : null}
            onMouseLeave={e => onTeamClick && m.home_team !== 'À définir' ? e.currentTarget.style.color = S.text : null}
          >
            {m.home_team}
            <img src={getFlagUrl(m.home_team)} style={{ marginRight: 8, marginLeft: 8, verticalAlign: 'middle' }} alt={m.home_team} />
          </span>
          <span className="mc-vs" style={{ fontSize: '18px', fontWeight: 800, color: S.muted, margin: '0 15px' }}>vs</span>
          <span className="mc-team-away"
            onClick={(e) => {
              if (onTeamClick) {
                e.stopPropagation();
                onTeamClick(m.away_team);
              }
            }}
            style={onTeamClick && m.away_team !== 'À définir' ? { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'color 0.2s' } : { display: 'inline-flex', alignItems: 'center' }}
            onMouseEnter={e => onTeamClick && m.away_team !== 'À définir' ? e.currentTarget.style.color = S.gold : null}
            onMouseLeave={e => onTeamClick && m.away_team !== 'À définir' ? e.currentTarget.style.color = S.text : null}
          >
            <img src={getFlagUrl(m.away_team)} style={{ marginLeft: 8, marginRight: 8, verticalAlign: 'middle' }} alt={m.away_team} />
            {m.away_team}
          </span>
        </div>
      </div>
      <div style={{ background: S.border, padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: 18 }}>
        {m.score_home ?? '-'} - {m.score_away ?? '-'}
      </div>
      {myPred && (
        <div className="mc-pred" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: S.muted }}>Prono</div>
          <div style={{ fontSize: 14, color: S.gold, fontWeight: 700 }}>{myPred.pred_home}-{myPred.pred_away}</div>
          {p !== null && <div style={{ fontSize: 11, color: ptsColor(p) }}>{ptsLabel(p, mult)} pts</div>}
        </div>
      )}
      {(m.status === 'finished' || m.status === 'live') && onViewOthers && (
        <button onClick={(e) => { e.stopPropagation(); onViewOthers(); }} style={{ marginLeft: 10, background: 'rgba(255, 255, 255, 0.05)', border: `1px solid ${S.border}`, borderRadius: 8, cursor: 'pointer', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: S.gold, fontWeight: 600, transition: 'background 0.2s' }} title="Voir les pronostics des joueurs">
          Pronostics des joueurs
        </button>
      )}
      {onAdmin && <button onClick={(e) => { e.stopPropagation(); onAdmin(); }} style={{ marginLeft: 10, background: 'none', border: 0, cursor: 'pointer' }}>⚙</button>}
    </div>
  );
}
