import { google } from 'googleapis';
import { getServiceAccountAuth } from './sheets.service';

const HR_SHEET_ID = process.env.HR_CONFIDENTIAL_SHEET_ID || '';

/**
 * Find the rightmost populated column index in the first few rows.
 */
function findRightmostColumn(rows: string[][]): number {
  let maxCol = 0;
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    for (let c = (rows[r]?.length || 0) - 1; c >= 0; c--) {
      const val = String(rows[r][c] || '').trim();
      if (val !== '') {
        maxCol = Math.max(maxCol, c);
        break;
      }
    }
  }
  return maxCol;
}

/**
 * Convert a 0-based column index to a sheet column letter (0=A, 1=B, ..., 26=AA).
 */
function colToLetter(col: number): string {
  let letter = '';
  let c = col;
  while (c >= 0) {
    letter = String.fromCharCode((c % 26) + 65) + letter;
    c = Math.floor(c / 26) - 1;
  }
  return letter;
}

/**
 * Generate the short month label for a given YYYY-MM string.
 * e.g., "2026-02" -> "Feb-26"
 */
function getShortMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const monthNum = parseInt(monthStr);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[monthNum - 1]}-${yearStr.slice(-2)}`;
}

/**
 * Duplicate the rightmost column in a trainer's HR-Confidential tab,
 * updating the month header in row 4 to the new month.
 *
 * @returns The column letter of the newly created column
 */
export async function duplicateMonthColumn(params: {
  trainerName: string;
  newMonth: string;
}): Promise<{ newColumnLetter: string; sheetTabName: string }> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/spreadsheets',
  ]);
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: HR_SHEET_ID,
    range: `'${params.trainerName}'!A:AZ`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    throw new Error(`No data found in HR sheet tab "${params.trainerName}"`);
  }

  const rightmostCol = findRightmostColumn(rows);
  const newCol = rightmostCol + 1;
  const newColLetter = colToLetter(newCol);

  const newColumnData: string[][] = [];
  for (let r = 0; r < rows.length; r++) {
    const sourceValue = rows[r]?.[rightmostCol] || '';
    newColumnData.push([String(sourceValue)]);
  }

  const newMonthLabel = getShortMonthLabel(params.newMonth);
  if (newColumnData.length > 3) {
    newColumnData[3] = [newMonthLabel];
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: HR_SHEET_ID,
    range: `'${params.trainerName}'!${newColLetter}1:${newColLetter}${newColumnData.length}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: newColumnData,
    },
  });

  return { newColumnLetter: newColLetter, sheetTabName: params.trainerName };
}

/**
 * Export a trainer's HR-Confidential tab as a PDF.
 */
export async function exportTrainerTabAsPdf(trainerName: string): Promise<Buffer> {
  const auth = getServiceAccountAuth([
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ]);

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: HR_SHEET_ID,
    fields: 'sheets.properties',
  });

  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === trainerName
  );

  if (!sheet || sheet.properties?.sheetId === undefined) {
    throw new Error(`Sheet tab "${trainerName}" not found in HR-Confidential spreadsheet`);
  }

  const gid = sheet.properties.sheetId;

  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.export(
    {
      fileId: HR_SHEET_ID,
      mimeType: 'application/pdf',
    },
    {
      responseType: 'arraybuffer',
      params: {
        gid: gid.toString(),
        portrait: false,
        fitw: true,
      },
    },
  );

  return Buffer.from(response.data as ArrayBuffer);
}
