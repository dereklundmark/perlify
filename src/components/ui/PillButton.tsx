import type { ButtonHTMLAttributes } from 'react';
import './PillButton.css';

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
}

export function PillButton({ variant = 'primary', size = 'md', className, ...rest }: PillButtonProps) {
  const classes = ['pill-button', `pill-button--${variant}`, `pill-button--${size}`, className]
    .filter(Boolean)
    .join(' ');
  return <button className={classes} {...rest} />;
}
