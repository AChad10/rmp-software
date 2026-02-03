interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export function LoadingSpinner({ size = 'md', fullPage = false }: LoadingSpinnerProps) {
  const sizeClass = {
    sm: '1.25rem',
    md: '2rem',
    lg: '3rem',
  }[size];

  const spinner = (
    <div
      className="spinner"
      style={{
        width: sizeClass,
        height: sizeClass,
        border: size === 'sm' ? '2px solid #e5e7eb' : '3px solid #e5e7eb',
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );

  if (fullPage) {
    return (
      <div className="loading-container">
        {spinner}
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return spinner;
}
