/**
 * Get current quarter in format "2026-Q1"
 */
export function getCurrentQuarter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  let quarter: number;
  if (month <= 3) quarter = 1;
  else if (month <= 6) quarter = 2;
  else if (month <= 9) quarter = 3;
  else quarter = 4;

  return `${year}-Q${quarter}`;
}

/**
 * Get quarter number (1-4) from quarter string
 */
export function getQuarterNumber(quarter: string): 1 | 2 | 3 | 4 {
  const match = quarter.match(/Q(\d)/);
  return match ? (parseInt(match[1]) as 1 | 2 | 3 | 4) : 1;
}

/**
 * Get year from quarter string
 */
export function getYear(quarter: string): number {
  const match = quarter.match(/^(\d{4})/);
  return match ? parseInt(match[1]) : new Date().getFullYear();
}

/**
 * Format quarter for display: "2026-Q1" -> "Q1 2026"
 */
export function formatQuarterDisplay(quarter: string): string {
  const year = getYear(quarter);
  const quarterNum = getQuarterNumber(quarter);
  return `Q${quarterNum} ${year}`;
}

/**
 * Get month names for a quarter
 */
export function getQuarterMonths(quarterNum: 1 | 2 | 3 | 4): string {
  const months = {
    1: 'January - March',
    2: 'April - June',
    3: 'July - September',
    4: 'October - December',
  };
  return months[quarterNum];
}
