import type { CSSProperties, ReactNode } from 'react';

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  const style: CSSProperties =
    variant === 'secondary'
      ? { padding: '8px 16px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }
      : { padding: '8px 16px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' };
  return (
    <button type="button" onClick={onClick} style={style}>
      {children}
    </button>
  );
}

export interface CardProps {
  title?: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, margin: 8 }}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  );
}
