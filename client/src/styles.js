// ─── Design Tokens & Styles ──────────────────────────────────────────────────
export const S = {
  bg: '#070b1a', surface: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)',
  gold: '#f5c200', goldDim: 'rgba(245,194,0,0.15)', live: '#00e676',
  liveDim: 'rgba(0,230,118,0.12)', done: 'rgba(255,255,255,0.35)',
  text: '#e0e6f8', muted: 'rgba(224,230,248,0.5)', danger: '#ff4c4c',
  card: 'rgba(255,255,255,0.04)', cardHover: 'rgba(255,255,255,0.08)',
};

export const btn = (extra = {}) => ({
  padding: '9px 18px', borderRadius: 8, border: `1px solid ${S.border}`,
  background: 'transparent', color: S.text, cursor: 'pointer', fontSize: 14,
  transition: 'background .15s', ...extra,
});

export const selectStyles = {
  control: (base) => ({ ...base, background: S.bg, borderColor: S.border, color: S.text, boxShadow: 'none', '&:hover': { borderColor: S.gold } }),
  menu: (base) => ({ ...base, background: '#0d1228', border: `1px solid ${S.border}`, zIndex: 100 }),
  option: (base, { isFocused }) => ({ ...base, background: isFocused ? S.cardHover : 'transparent', color: S.text, fontSize: 15, cursor: 'pointer' }),
  singleValue: (base) => ({ ...base, color: S.gold, fontWeight: 600 }),
  input: (base) => ({ ...base, color: S.text }),
  groupHeading: (base) => ({ ...base, color: S.gold, fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }),
  placeholder: (base) => ({ ...base, color: S.muted })
};
