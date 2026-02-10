interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  text?: string;
}

export function LoadingSpinner({ size = 'md', fullPage = false, text }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: '1.25rem',
    md: '2rem',
    lg: '3rem',
  };

  const borderWidth = size === 'sm' ? '3px' : '4px';

  const spinner = (
    <div
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: `${borderWidth} solid var(--border-primary)`,
        borderTopColor: 'var(--brand-primary)',
        borderRadius: '0',
        animation: 'spin 0.6s steps(8) infinite',
      }}
    />
  );

  if (fullPage) {
    return (
      <div className="loading-container">
        {spinner}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.075em' }}>{text || 'Loading...'}</p>
      </div>
    );
  }

  return spinner;
}
