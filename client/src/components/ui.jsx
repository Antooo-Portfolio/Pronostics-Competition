import { S } from '../styles';

export function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function ModalBox({ children, style, className = '' }) {
  return ( <div className={`hide-scrollbar ${className}`} style={{ background: '#0d1228', border: `1px solid ${S.border}`, borderRadius: 16, padding: 28, width: 360, maxWidth: '90vw', ...style }}>{children}</div> );
}

export function AuthInput({ type = 'text', placeholder, value, onChange, onEnter }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && onEnter?.()}
      style={{ display: 'block', width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.05)', color: S.text, fontSize: 14, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
  );
}

export function ScoreInput({ value, onChange, placeholder = "0" }) {
  return (
    <input 
      type="number" 
      min="0" 
      max="20" 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      onFocus={e => {
        if (e.target.value === '0') onChange(''); // Vide le champ s'il contient '0'
      }}
      onBlur={e => {
        if (e.target.value === '') onChange('0'); // Remet '0' si on quitte sans rien taper
      }}
      placeholder={placeholder}
      style={{ width: 70, padding: '12px', textAlign: 'center', fontSize: 24, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: `1px solid ${S.border}`, borderRadius: 8, color: S.text, outline: 'none' }} 
    />
  );
}

export function GoldButton({ children, onClick }) {
  return ( <button onClick={onClick} style={{ display: 'block', width: '100%', padding: 12, borderRadius: 8, border: 'none', background: S.gold, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{children}</button> );
}

export function TextBtn({ children, onClick }) {
  return ( <button onClick={onClick} style={{ background: 'none', border: 'none', color: S.gold, cursor: 'pointer', fontSize: 12 }}>{children}</button> );
}