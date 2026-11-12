import type { ComponentPropsWithRef } from 'react';
import './button.css';

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  loadingLabel?: string;
  pulse?: boolean;
}

export default function Button({ variant = 'primary', loading = false, loadingLabel = 'Procesando…', pulse = false, type = 'button', disabled, className = '', children, ...props }: ButtonProps) {
  return (
    <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || props['aria-busy']}
      className={`ui-button ui-button--${variant} ${pulse && variant === 'primary' ? 'ui-button--pulse' : ''} ${className}`.trim()}>
      {loading && <span className="ui-button-spinner" aria-hidden="true" />}
      {loading ? loadingLabel : children}
    </button>
  );
}
