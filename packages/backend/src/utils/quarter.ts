/**
 * Quarter utility functions for BSC
 */

/**
 * Get the current quarter string (e.g., "2026-Q1")
 */
export function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}
