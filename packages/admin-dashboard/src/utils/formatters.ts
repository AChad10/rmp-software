/**
 * Format currency in INR
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/**
 * Format datetime to readable string
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format month string "2026-03" to "March 2026"
 */
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

/**
 * Format quarter string "2026-Q1" to "Q1 2026"
 */
export function formatQuarter(quarterStr: string): string {
  const match = quarterStr.match(/(\d{4})-Q(\d)/);
  if (!match) return quarterStr;
  return `Q${match[2]} ${match[1]}`;
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

  return formatDate(d);
}

/**
 * Get status badge CSS class (maps to badge-* in index.css)
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'badge-success',
    inactive: 'badge-gray',
    on_leave: 'badge-warning',
    pending_validation: 'badge-warning',
    validated: 'badge-success',
    rejected: 'badge-danger',
    draft: 'badge-info',
    sent: 'badge-success',
    paid: 'badge-purple',
  };
  return colors[status] || 'badge-gray';
}
