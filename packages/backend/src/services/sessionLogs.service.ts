import { google } from 'googleapis';
import { getServiceAccountAuth } from './sheets.service';
import { ISessionEntry, IClassType } from '@rmp/shared-types';

/**
 * Read session log data from a trainer's tab in the master Google Sheet.
 * Returns session entries per class type for a given month.
 *
 * The Google Sheet structure (from HR Confidential):
 * - Row headers in column A
 * - Month columns across the top (e.g., "Jan-26", "Feb-26")
 * - Section headers: "XPRESS", "MAT", "REFORMER", "SEMI PRIVATE", "PRIVATE", "DISCOVERY"
 * - Under each section: "Sessions" row, "Sessions (Incl No Show)" row
 * - A "NO OF SESSION SUMMARY" section with per-class totals
 * - A "GROSS BILLING SUMMARY" section with per-class billing totals
 * - "Gross Payable for Month", "TDS", "Net Payout" rows near the bottom
 */
export async function readSessionLogs(params: {
  sheetId: string;
  sheetTab: string;
  month: string;           // "2026-01"
  classTypes: IClassType[];
}): Promise<{
  entries: ISessionEntry[];
  totalSessions: number;
  grossBilling: number;
}> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ]);

  const sheets = google.sheets({ version: 'v4', auth });

  // Read the entire trainer tab
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.sheetId,
    range: `'${params.sheetTab}'!A:AZ`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    throw new Error(`No data found in sheet tab "${params.sheetTab}"`);
  }

  // Find the column index for the requested month
  // Month headers are like "Jan-26", "Feb-26" in the first row or a header row
  const [yearStr, monthStr] = params.month.split('-');
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabel = `${monthNames[monthNum - 1]}-${String(year).slice(-2)}`;

  // Search for the month column in the first few rows
  let monthColIndex = -1;
  for (let rowIdx = 0; rowIdx < Math.min(5, rows.length); rowIdx++) {
    const row = rows[rowIdx];
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cellValue = String(row[colIdx] || '').trim();
      if (cellValue.toLowerCase() === monthLabel.toLowerCase()) {
        monthColIndex = colIdx;
        break;
      }
    }
    if (monthColIndex >= 0) break;
  }

  if (monthColIndex < 0) {
    throw new Error(`Month column "${monthLabel}" not found in sheet "${params.sheetTab}"`);
  }

  // Helper: find a row whose column A matches (case-insensitive, partial match)
  const findRow = (label: string, startRow = 0): number => {
    for (let i = startRow; i < rows.length; i++) {
      const cell = String(rows[i]?.[0] || '').trim().toLowerCase();
      if (cell.includes(label.toLowerCase())) {
        return i;
      }
    }
    return -1;
  };

  // Helper: get numeric value from a cell
  const getCellNumber = (rowIdx: number, colIdx: number): number => {
    if (rowIdx < 0 || rowIdx >= rows.length) return 0;
    const row = rows[rowIdx];
    if (!row || colIdx >= row.length) return 0;
    const val = String(row[colIdx]).replace(/,/g, '').trim();
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  };

  const entries: ISessionEntry[] = [];
  let totalSessions = 0;
  let grossBilling = 0;

  // Try to find the "NO OF SESSION SUMMARY" section first (it has per-class totals)
  const sessionSummaryRow = findRow('no of session summary');
  const billingSummaryRow = findRow('gross billing summary');

  for (const classType of params.classTypes) {
    let sessions = 0;
    let noShowSessions = 0;
    let billing = 0;

    if (classType.subTypes && classType.subTypes.length > 0) {
      // For class types with sub-types (e.g., PRIVATE with MVP/QVP/PBC)
      const subBreakdown: { name: string; sessions: number; billingRate: number; totalBilling: number }[] = [];
      let totalSubSessions = 0;
      let totalSubBilling = 0;

      for (const subType of classType.subTypes) {
        // Look for sub-type row in the session summary section
        const searchStart = sessionSummaryRow >= 0 ? sessionSummaryRow : 0;
        const subTypeRow = findRow(subType.name, searchStart);
        const subSessions = subTypeRow >= 0 ? getCellNumber(subTypeRow, monthColIndex) : 0;
        const subBilling = subSessions * subType.billingRate;

        subBreakdown.push({
          name: subType.name,
          sessions: subSessions,
          billingRate: subType.billingRate,
          totalBilling: subBilling,
        });

        totalSubSessions += subSessions;
        totalSubBilling += subBilling;
      }

      sessions = totalSubSessions;
      billing = totalSubBilling;

      entries.push({
        classType: classType.name,
        sessions,
        noShowSessions,
        billingRate: classType.billingRate,
        totalBilling: billing,
        subTypeBreakdown: subBreakdown,
      });
    } else {
      // Standard class type -- find session count from summary or section
      if (sessionSummaryRow >= 0) {
        const classRow = findRow(classType.name, sessionSummaryRow);
        if (classRow >= 0) {
          sessions = getCellNumber(classRow, monthColIndex);
        }
      }

      // Try to get billing from the billing summary section
      if (billingSummaryRow >= 0) {
        const billingRow = findRow(classType.name, billingSummaryRow);
        if (billingRow >= 0) {
          billing = getCellNumber(billingRow, monthColIndex);
        }
      }

      // Fall back to calculating from sessions * rate if billing not found in sheet
      if (billing === 0 && sessions > 0) {
        billing = sessions * classType.billingRate;
      }

      // Try to find no-show data
      const noShowRow = findRow(`${classType.name.toLowerCase()} no show`);
      if (noShowRow >= 0) {
        noShowSessions = getCellNumber(noShowRow, monthColIndex);
      }

      entries.push({
        classType: classType.name,
        sessions,
        noShowSessions,
        billingRate: classType.billingRate,
        totalBilling: billing,
      });
    }

    totalSessions += sessions;
    grossBilling += billing;
  }

  return { entries, totalSessions, grossBilling };
}

/**
 * Calculate billing from class config without Google Sheets.
 * Used for manual entry fallback or testing.
 *
 * @param classTypes - The trainer's class type configuration
 * @param sessionData - Session counts keyed by class type name.
 *   For types with sub-types, the value is an object keyed by sub-type name.
 *   e.g. { "XPRESS": 10, "PRIVATE": { "MVP": 3, "QVP": 2 } }
 */
export function calculateBillingFromSessions(
  classTypes: IClassType[],
  sessionData: Record<string, number | { [subType: string]: number }>
): { entries: ISessionEntry[]; totalSessions: number; grossBilling: number } {
  const entries: ISessionEntry[] = [];
  let totalSessions = 0;
  let grossBilling = 0;

  for (const classType of classTypes) {
    const data = sessionData[classType.name];

    if (classType.subTypes && classType.subTypes.length > 0 && typeof data === 'object' && data !== null) {
      // Sub-type breakdown (e.g., PRIVATE with MVP/QVP/PBC)
      const subData = data as { [subType: string]: number };
      const subBreakdown: { name: string; sessions: number; billingRate: number; totalBilling: number }[] = [];
      let totalSubSessions = 0;
      let totalSubBilling = 0;

      for (const subType of classType.subTypes) {
        const subSessions = subData[subType.name] || 0;
        const subBilling = subSessions * subType.billingRate;

        subBreakdown.push({
          name: subType.name,
          sessions: subSessions,
          billingRate: subType.billingRate,
          totalBilling: subBilling,
        });

        totalSubSessions += subSessions;
        totalSubBilling += subBilling;
      }

      entries.push({
        classType: classType.name,
        sessions: totalSubSessions,
        noShowSessions: 0,
        billingRate: classType.billingRate,
        totalBilling: totalSubBilling,
        subTypeBreakdown: subBreakdown,
      });

      totalSessions += totalSubSessions;
      grossBilling += totalSubBilling;
    } else {
      // Simple class type
      const sessions = typeof data === 'number' ? data : 0;
      const billing = sessions * classType.billingRate;

      entries.push({
        classType: classType.name,
        sessions,
        noShowSessions: 0,
        billingRate: classType.billingRate,
        totalBilling: billing,
      });

      totalSessions += sessions;
      grossBilling += billing;
    }
  }

  return { entries, totalSessions, grossBilling };
}
