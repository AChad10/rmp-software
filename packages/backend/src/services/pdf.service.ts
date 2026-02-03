import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

interface SalaryPDFData {
  trainerName: string;
  memberId: string;
  month: string;
  year: number;
  monthNumber: number;
  baseSalary: number;
  quarterlyBonusAmount: number;
  bscScore: number;
  calculatedBonus: number;
  totalSalary: number;
  bscApplied: boolean;
}

const STORAGE_DIR = path.join(__dirname, '../../storage/salary-statements');
const TEMPLATE_PATH = path.join(__dirname, '../templates/salaryStatement.html');

// Month names for display
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    console.log(`📁 Created storage directory: ${STORAGE_DIR}`);
  }
}

/**
 * Format number as Indian Rupees with commas
 */
function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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

  // Build BSC section if bonus was applied
  let bscSection = '';
  if (data.bscApplied && data.bscScore > 0) {
    bscSection = `
      <div class="bsc-section">
        <div class="bsc-title">🎯 Balanced Score Card (BSC) Performance Bonus</div>
        <div class="bsc-details">
          Your quarterly BSC score: <strong>${(data.bscScore * 10).toFixed(1)}/10</strong><br>
          Bonus pool: ₹${formatCurrency(data.quarterlyBonusAmount)}<br>
          Calculated bonus: ₹${formatCurrency(data.calculatedBonus)} (${(data.bscScore * 100).toFixed(1)}% of pool)
        </div>
      </div>
    `;
  }

  // Build bonus note
  let bonusNote = '';
  if (data.bscApplied && data.bscScore > 0) {
    bonusNote = '<div class="note">(Based on BSC Score: ' + (data.bscScore * 10).toFixed(1) + '/10)</div>';
  } else if (!data.bscApplied) {
    bonusNote = '<div class="note">(No BSC score available for this quarter)</div>';
  }

  // Replace template variables
  html = html
    .replace(/{{TRAINER_NAME}}/g, data.trainerName)
    .replace(/{{MEMBER_ID}}/g, data.memberId)
    .replace(/{{MONTH}}/g, data.month)
    .replace(/{{MONTH_NAME}}/g, MONTH_NAMES[data.monthNumber - 1])
    .replace(/{{YEAR}}/g, data.year.toString())
    .replace(/{{BASE_SALARY}}/g, formatCurrency(data.baseSalary))
    .replace(/{{CALCULATED_BONUS}}/g, formatCurrency(data.calculatedBonus))
    .replace(/{{TOTAL_SALARY}}/g, formatCurrency(data.totalSalary))
    .replace(/{{GENERATED_DATE}}/g, new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }))
    .replace(/{{BSC_SECTION}}/g, bscSection)
    .replace(/{{BONUS_NOTE}}/g, bonusNote);

  // Generate filename: YYYY-MM-TrainerName.pdf
  const sanitizedName = data.trainerName.replace(/[^a-zA-Z0-9]/g, '-');
  const filename = `${data.month}-${sanitizedName}.pdf`;
  const pdfPath = path.join(STORAGE_DIR, filename);

  // Launch Puppeteer and generate PDF
  console.log(`📄 Generating PDF for ${data.trainerName}...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    console.log(`✅ PDF generated: ${filename}`);

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
 * Delete a salary PDF file
 */
export async function deleteSalaryPDF(pdfPath: string): Promise<void> {
  try {
    await fs.unlink(pdfPath);
    console.log(`🗑️  Deleted PDF: ${pdfPath}`);
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
