import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export interface SalaryPDFData {
  // Employee Info
  employeeName: string;
  designation: string;
  employeeCode: string;
  panNumber: string;

  // Period Info
  period: string; // e.g., "Jan-26"
  daysInPeriod: number;
  financialYear: string; // e.g., "2025-26"
  month: string; // e.g., "2026-01" for file naming

  // Fixed Compensation
  annualBase: number;
  monthlyBase: number;
  currentBase: number;
  baseRemarks: string;

  // Variable Compensation
  annualBonus: number;
  monthlyBonus: number;
  currentBonus: string; // Can be empty for non-payout months
  bonusRemarks: string;

  // Totals
  annualCTC: number;
  monthlyCTC: number;

  // Other
  travelRemarks: string;
  bankTransfer: number;
  milestoneNote: string;
  effectiveDateHeader?: string; // e.g., "Revised Eff 1st Oct 25"
}

export interface SeniorSalaryPDFData {
  employeeName: string;
  designation: string;
  employeeCode: string;
  panNumber: string;
  period: string;
  daysInPeriod: number;
  financialYear: string;
  month: string;
  fixedComponents: Array<{
    name: string;
    annualAmount: number;
    monthlyAmount: number;
    frequency: string;
    remarks: string;
    currentAmount: number;
  }>;
  variableComponents: Array<{
    name: string;
    annualAmount: number;
    monthlyAmount: number;
    frequency: string;
    remarks: string;
    currentAmount: number;
  }>;
  tds: number;
  travelReimbursement: number;
  bankTransfer: number;
  milestoneNote: string;
  customNotes?: string;
}

const STORAGE_DIR = path.join(__dirname, '../../storage/salary-statements');
const TEMPLATE_PATH = path.join(__dirname, '../templates/salaryStatement.html');
const SENIOR_TEMPLATE_PATH = path.join(__dirname, '../templates/seniorSalaryStatement.html');

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    console.log(`Created storage directory: ${STORAGE_DIR}`);
  }
}

/**
 * Format number with Indian number system (lakhs/crores)
 */
function formatNumber(amount: number): string {
  if (amount === 0) return '';
  return amount.toLocaleString('en-IN');
}

/**
 * Get days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Get financial year string (e.g., "2025-26" for Jan 2026)
 */
export function getFinancialYear(year: number, month: number): string {
  // Financial year runs April to March
  // Jan-Mar belongs to previous FY (e.g., Jan 2026 = FY 2025-26)
  // Apr-Dec belongs to current FY (e.g., Oct 2025 = FY 2025-26)
  if (month <= 3) {
    return `${year - 1}-${String(year).slice(-2)}`;
  }
  return `${year}-${String(year + 1).slice(-2)}`;
}

/**
 * Get period string (e.g., "Jan-26")
 */
export function getPeriodString(year: number, month: number): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]}-${String(year).slice(-2)}`;
}

/**
 * Calculate milestone note based on join date
 */
export function getMilestoneNote(joinDate: Date): string {
  const monthsWorked = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  const targetMonths = 30;

  if (monthsWorked >= targetMonths) {
    return `Completed ${targetMonths} months with the Company`;
  }

  const remainingMonths = targetMonths - monthsWorked;
  const targetDate = new Date(joinDate);
  targetDate.setMonth(targetDate.getMonth() + targetMonths);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const targetMonth = monthNames[targetDate.getMonth()];
  const targetYear = targetDate.getFullYear();

  return `${targetMonths} months with the Company - ${targetMonth} ${targetYear}`;
}

/**
 * Generate salary PDF for a trainer
 */
export async function generateSalaryPDF(data: SalaryPDFData): Promise<{
  pdfPath: string;
  pdfUrl: string;
}> {
  await ensureStorageDir();

  // Read HTML template
  let html = await fs.readFile(TEMPLATE_PATH, 'utf-8');

  // Replace template variables
  html = html
    // Header - Employee Info
    .replace(/{{EMPLOYEE_NAME}}/g, data.employeeName)
    .replace(/{{DESIGNATION}}/g, data.designation)
    .replace(/{{EMPLOYEE_CODE}}/g, data.employeeCode)
    .replace(/{{PAN_NUMBER}}/g, data.panNumber || '')
    // Header - Period Info
    .replace(/{{PERIOD}}/g, data.period)
    .replace(/{{DAYS_IN_PERIOD}}/g, data.daysInPeriod.toString())
    .replace(/{{FINANCIAL_YEAR}}/g, data.financialYear)
    // Fixed Compensation
    .replace(/{{ANNUAL_BASE}}/g, formatNumber(data.annualBase))
    .replace(/{{MONTHLY_BASE}}/g, formatNumber(data.monthlyBase))
    .replace(/{{CURRENT_BASE}}/g, formatNumber(data.currentBase))
    .replace(/{{BASE_REMARKS}}/g, data.baseRemarks || '')
    // Variable Compensation
    .replace(/{{ANNUAL_BONUS}}/g, formatNumber(data.annualBonus))
    .replace(/{{MONTHLY_BONUS}}/g, formatNumber(data.monthlyBonus))
    .replace(/{{CURRENT_BONUS}}/g, data.currentBonus || '')
    .replace(/{{BONUS_REMARKS}}/g, data.bonusRemarks || '')
    // Totals
    .replace(/{{ANNUAL_CTC}}/g, formatNumber(data.annualCTC))
    .replace(/{{MONTHLY_CTC}}/g, formatNumber(data.monthlyCTC))
    // Other
    .replace(/{{TRAVEL_REMARKS}}/g, data.travelRemarks || '')
    .replace(/{{BANK_TRANSFER}}/g, formatNumber(data.bankTransfer))
    .replace(/{{MILESTONE_NOTE}}/g, data.milestoneNote || '')
    .replace(/{{EFFECTIVE_DATE_HEADER}}/g, data.effectiveDateHeader || '');

  // Generate filename: YYYY-MM-EmployeeName.pdf
  const sanitizedName = data.employeeName.replace(/[^a-zA-Z0-9]/g, '-');
  const filename = `${data.month}-${sanitizedName}.pdf`;
  const pdfPath = path.join(STORAGE_DIR, filename);

  // Launch Puppeteer and generate PDF
  console.log(`Generating PDF for ${data.employeeName}...`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true, // Landscape for wider table
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    console.log(`PDF generated: ${filename}`);

  } finally {
    await browser.close();
  }

  // Generate URL (will be served by Express static middleware)
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const pdfUrl = `${backendUrl}/pdfs/${filename}`;

  return {
    pdfPath,
    pdfUrl
  };
}

/**
 * Generate senior salary PDF with dynamic components
 */
export async function generateSeniorSalaryPDF(data: SeniorSalaryPDFData): Promise<{
  pdfPath: string;
  pdfUrl: string;
}> {
  await ensureStorageDir();

  let html = await fs.readFile(SENIOR_TEMPLATE_PATH, 'utf-8');

  // Build fixed rows HTML
  const fixedRowsHtml = data.fixedComponents.map(c => `
    <tr>
      <td class="desc-col">${c.name}</td>
      <td class="num-col">${formatNumber(c.annualAmount)}</td>
      <td class="num-col">${formatNumber(c.monthlyAmount)}</td>
      <td class="num-col">${c.frequency}</td>
      <td class="remarks-col">${c.remarks}</td>
      <td class="num-col">${formatNumber(c.currentAmount)}</td>
    </tr>
  `).join('');

  // Build variable rows HTML
  const variableRowsHtml = data.variableComponents.map(c => `
    <tr>
      <td class="desc-col">${c.name}</td>
      <td class="num-col">${formatNumber(c.annualAmount)}</td>
      <td class="num-col">${formatNumber(c.monthlyAmount)}</td>
      <td class="num-col">${c.frequency}</td>
      <td class="remarks-col">${c.remarks}</td>
      <td class="num-col">${formatNumber(c.currentAmount)}</td>
    </tr>
  `).join('');

  // Calculate totals
  const allComponents = [...data.fixedComponents, ...data.variableComponents];
  const totalAnnual = allComponents.reduce((s, c) => s + c.annualAmount, 0);
  const totalMonthly = allComponents.reduce((s, c) => s + c.monthlyAmount, 0);
  const totalCurrent = allComponents.reduce((s, c) => s + c.currentAmount, 0);

  html = html
    .replace(/{{EMPLOYEE_NAME}}/g, data.employeeName)
    .replace(/{{DESIGNATION}}/g, data.designation)
    .replace(/{{EMPLOYEE_CODE}}/g, data.employeeCode)
    .replace(/{{PAN_NUMBER}}/g, data.panNumber || '')
    .replace(/{{PERIOD}}/g, data.period)
    .replace(/{{DAYS_IN_PERIOD}}/g, data.daysInPeriod.toString())
    .replace(/{{FINANCIAL_YEAR}}/g, data.financialYear)
    .replace(/{{FIXED_ROWS}}/g, fixedRowsHtml)
    .replace(/{{VARIABLE_ROWS}}/g, variableRowsHtml)
    .replace(/{{TOTAL_ANNUAL}}/g, formatNumber(totalAnnual))
    .replace(/{{TOTAL_MONTHLY}}/g, formatNumber(totalMonthly))
    .replace(/{{TOTAL_CURRENT}}/g, formatNumber(totalCurrent))
    .replace(/{{TDS_AMOUNT}}/g, formatNumber(data.tds))
    .replace(/{{TRAVEL_AMOUNT}}/g, formatNumber(data.travelReimbursement))
    .replace(/{{BANK_TRANSFER}}/g, formatNumber(data.bankTransfer))
    .replace(/{{MILESTONE_NOTE}}/g, data.milestoneNote || '')
    .replace(/{{CUSTOM_NOTES}}/g, data.customNotes || '');

  const sanitizedName = data.employeeName.replace(/[^a-zA-Z0-9]/g, '-');
  const filename = `${data.month}-${sanitizedName}.pdf`;
  const pdfPath = path.join(STORAGE_DIR, filename);

  console.log(`Generating senior PDF for ${data.employeeName}...`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });
    console.log(`Senior PDF generated: ${filename}`);
  } finally {
    await browser.close();
  }

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const pdfUrl = `${backendUrl}/pdfs/${filename}`;

  return { pdfPath, pdfUrl };
}

/**
 * Delete a salary PDF file
 */
export async function deleteSalaryPDF(pdfPath: string): Promise<void> {
  try {
    await fs.unlink(pdfPath);
    console.log(`Deleted PDF: ${pdfPath}`);
  } catch (error) {
    console.error(`Failed to delete PDF: ${pdfPath}`, error);
    throw error;
  }
}

/**
 * Check if PDF file exists
 */
export async function pdfExists(pdfPath: string): Promise<boolean> {
  try {
    await fs.access(pdfPath);
    return true;
  } catch {
    return false;
  }
}
