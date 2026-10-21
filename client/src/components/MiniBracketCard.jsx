import React, { useState, useEffect } from 'react';
import { S } from '../styles';
import { getFlagUrl, getMultiplier } from '../utils';

export default function MiniBracketCard({ m, onAdmin, onViewOthers }) {
  const dateObj = new Date(m.date);
  
  const optionsDate = { weekday: 'short', day: 'numeric', month: 'short' };
  const dateMatch = dateObj.toLocaleDateString('fr-FR', optionsDate).replace('.', '');
  const heureMatch = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const HomeIcon = m.home_team !== 'À définir' ? <img src={getFlagUrl(m.home_team)} style={{ width: 22, height: 16, borderRadius: 2 }} alt="" /> : <span style={{ fontSize: 18 }}>🛡️</span>;
  const AwayIcon = m.away_team !== 'À définir' ? <img src={getFlagUrl(m.away_team)} style={{ width: 22, height: 16, borderRadius: 2 }} alt="" /> : <span style={{ fontSize: 18 }}>🛡️</span>;
  
  const mult = getMultiplier(m.group_name);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (m.status === 'live') {
      const interval = setInterval(() => setNow(new Date()), 60000);
      return () => clearInterval(interval);
    }
  }, [m.status]);

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
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${m.status === 'live' ? '#ff4c4c' : S.border}`,
      borderRadius: 10,
      padding: '12px 8px',
      width: 110,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      position: 'relative',
      boxShadow: m.status === 'live' ? '0 0 8px rgba(255, 76, 76, 0.2)' : 'none',
    }}>
      {onAdmin && (
        <button onClick={onAdmin} style={{ position: 'absolute', top: 2, right: 2, background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, opacity: 0.5 }}>⚙</button>
      )}
      {m.status === 'finished' && onViewOthers && (
        <button onClick={(e) => { e.stopPropagation(); onViewOthers(); }} style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 9, padding: '2px 4px', color: S.gold, fontWeight: 700 }} title="Voir les pronostics des joueurs">Pronos</button>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {HomeIcon}
          <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{m.score_home ?? '-'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {AwayIcon}
          <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{m.score_away ?? '-'}</span>
        </div>
      </div>

      <div style={{ fontSize: 11, color: S.muted, textAlign: 'center', lineHeight: 1.4, width: '100%' }}>
        {mult > 1 && (
          <div style={{
            background: mult === 5 ? '#ffb703' : mult === 3 ? '#fb8500' : '#8ecae6', color: '#000', padding: '2px 4px',
            borderRadius: 4, fontWeight: 800, fontSize: 9, marginBottom: 4, display: 'inline-block'
          }}>
            {mult === 5 ? '🏆 Points x5' : mult === 3 ? '⭐ Points x3' : '🔥 Points x2'}
          </div>
        )}
        {m.status === 'live' && (
          <div style={{
            background: '#ff4c4c', color: 'white', padding: '2px 4px',
            borderRadius: 4, fontWeight: 800, fontSize: 9, marginBottom: 4,
            display: 'inline-block', animation: 'pulse 1.5s infinite'
          }}>
            LIVE {displayMinute ? `• ${displayMinute}` : ''}
          </div>
        )}
        {m.status === 'finished' && (
          <div style={{
            background: S.done || '#20d6b5', color: '#000', padding: '2px 4px',
            borderRadius: 4, fontWeight: 800, fontSize: 9, marginBottom: 4,
            display: 'inline-block'
          }}>
            TERMINÉ
          </div>
        )}
        {m.status !== 'live' && m.status !== 'finished' && (
          <div>{dateMatch}</div>
        )}
        <div>{heureMatch}</div>
      </div>
    </div>
  );
}
