import { getStatusColor } from '../../utils/formatters';

interface BadgeProps {
  status: string;
  label?: string;
}

export function Badge({ status, label }: BadgeProps) {
  const colorClass = getStatusColor(status);
  const displayLabel = label || status.replace(/_/g, ' ').toUpperCase();

  return <span className={`badge ${colorClass}`}>{displayLabel}</span>;
}
