import { S } from './styles';

// ─── Scoring Helpers ─────────────────────────────────────────────────────────
export function ptsColor(p) { 
  return p === 4 ? S.gold : p === 3 ? S.live : p === 2 ? '#00bfff' : p === 0 ? S.danger : S.muted; 
}

export function getMultiplier(groupName) {
  if (!groupName) return 1;
  const name = groupName.toLowerCase();
  if (name.includes('groupe')) {
    return 1;
  }
  if (name.includes('seizième') || name.includes('last_32') || name.includes('huitième')) {
    return 2;
  }
  if (name.includes('quart') || name.includes('demi') || name.includes('petite')) {
    return 3;
  }
  if (name.includes('finale')) {
    return 5; // Finale (puisque petite finale est traitée au-dessus)
  }
  return 1;
}

export function ptsLabel(p, m = 1) { 
  return p === 4 ? `+${4 * m}` : p === 3 ? `+${3 * m}` : p === 2 ? `+${2 * m}` : p === 0 ? '0' : '—'; 
}

export function calcPts(ph, pa, sh, sa) {
  if (ph === sh && pa === sa) return 4; 
  const diffP = ph - pa;
  const diffS = sh - sa;
  const pw = ph > pa ? 'H' : ph < pa ? 'A' : 'D';
  const sw = sh > sa ? 'H' : sh < sa ? 'A' : 'D';
  if (pw === sw) {
    if (diffP === diffS) {
      return 3; 
    }
    return 2; 
  }
  return 0; 
}

// ─── Flag URL ────────────────────────────────────────────────────────────────
export function getFlagUrl(teamName) {
  const customCodes = {
    'Mexique': 'mx', 'Afrique du Sud': 'za', 'Corée du Sud': 'kr', 'Tchéquie': 'cz',
    'États-Unis': 'us', 'Bosnie-Herzégovine': 'ba', 'Maroc': 'ma', 'Sénégal': 'sn',
    'Suisse': 'ch', 'Canada': 'ca', 'Qatar': 'qa',
    'Brésil': 'br', 'Haïti': 'ht', 'Écosse': 'gb-sct', 'Paraguay': 'py',
    'Australie': 'au', 'Turquie': 'tr', 'Allemagne': 'de', 'Curaçao': 'cw',
    'Équateur': 'ec', "Côte d'Ivoire": 'ci', 'Pays-Bas': 'nl', 'Japon': 'jp',
    'Suède': 'se', 'Tunisie': 'tn', 'Belgique': 'be', 'Égypte': 'eg',
    'Iran': 'ir', 'Nouvelle-Zélande': 'nz', 'Espagne': 'es', 'Arabie Saoudite': 'sa',
    'Uruguay': 'uy', 'Cap-Vert': 'cv', 'France': 'fr',
    'Irak': 'iq', 'Norvège': 'no', 'Argentine': 'ar', 'Algérie': 'dz',
    'Autriche': 'at', 'Jordanie': 'jo', 'Portugal': 'pt', 'RD Congo': 'cd',
    'Ouzbékistan': 'uz', 'Colombie': 'co', 'Angleterre': 'gb', 'Croatie': 'hr',
    'Ghana': 'gh', 'Panama': 'pa', 'Italie': 'it'
  };
  const code = customCodes[teamName] || 'un'; 
  return `https://flagcdn.com/24x18/${code}.png`;
}

// ─── Group Standings ─────────────────────────────────────────────────────────
export function getGroupStandings(groupName, allMatches) {
  const groupMatches = allMatches.filter(m => m.group_name === groupName);
  const teams = {};

  groupMatches.forEach(m => {
    if (m.home_team && m.home_team !== 'À définir') {
      if (!teams[m.home_team]) teams[m.home_team] = { name: m.home_team, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, pts: 0 };
    }
    if (m.away_team && m.away_team !== 'À définir') {
      if (!teams[m.away_team]) teams[m.away_team] = { name: m.away_team, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, pts: 0 };
    }

    if (m.status === 'finished' && m.home_team !== 'À définir' && m.away_team !== 'À définir') {
      const h = m.score_home ?? 0;
      const a = m.score_away ?? 0;

      teams[m.home_team].j++;
      teams[m.away_team].j++;
      teams[m.home_team].bp += h;
      teams[m.home_team].bc += a;
      teams[m.away_team].bp += a;
      teams[m.away_team].bc += h;

      if (h > a) {
        teams[m.home_team].pts += 3;
        teams[m.home_team].g++;
        teams[m.away_team].p++;
      } else if (h < a) {
        teams[m.away_team].pts += 3;
        teams[m.away_team].g++;
        teams[m.home_team].p++;
      } else {
        teams[m.home_team].pts += 1;
        teams[m.away_team].pts += 1;
        teams[m.home_team].n++;
        teams[m.away_team].n++;
      }
    }
  });

  return Object.values(teams).map(t => ({ ...t, diff: t.bp - t.bc })).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.bp - a.bp;
  });
}
