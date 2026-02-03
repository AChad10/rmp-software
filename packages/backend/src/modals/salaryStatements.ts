import { View } from '@slack/bolt';

interface SalaryStatementData {
  _id: string;
  month: string;
  year: number;
  baseSalary: number;
  calculatedBonus: number;
  totalSalary: number;
  pdfUrl: string;
  status: string;
  createdAt: Date;
}

interface BuildSalaryStatementsModalParams {
  statements: SalaryStatementData[];
  trainerName: string;
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Get month name from month string (YYYY-MM)
 */
function getMonthName(month: string): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const [, monthNum] = month.split('-');
  return monthNames[parseInt(monthNum) - 1];
}

/**
 * Build Salary Statements Modal
 */
export function buildSalaryStatementsModal({
  statements,
  trainerName
}: BuildSalaryStatementsModalParams): View {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `💰 Salary Statements - ${trainerName}`,
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: statements.length > 0
          ? `You have *${statements.length}* salary statement(s) available.`
          : 'No salary statements available yet.'
      }
    },
    {
      type: 'divider'
    }
  ];

  if (statements.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📭 No salary statements have been generated yet.\n\n_Salary statements are typically generated on the 28th of each month._'
      }
    });
  } else {
    // Sort statements by date (most recent first)
    const sortedStatements = statements.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    sortedStatements.forEach((statement, index) => {
      const monthName = getMonthName(statement.month);

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*${monthName} ${statement.year}*`,
            `Base Salary: ${formatCurrency(statement.baseSalary)}`,
            statement.calculatedBonus > 0
              ? `Bonus: ${formatCurrency(statement.calculatedBonus)}`
              : null,
            `*Total: ${formatCurrency(statement.totalSalary)}*`
          ].filter(Boolean).join('\n')
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📄 Download PDF',
            emoji: true
          },
          url: statement.pdfUrl,
          action_id: `download_salary_${statement._id}`,
          style: 'primary'
        }
      });

      // Add divider between statements (except after last one)
      if (index < sortedStatements.length - 1) {
        blocks.push({
          type: 'divider'
        });
      }
    });
  }

  // Add footer
  blocks.push(
    {
      type: 'divider'
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 *Need help?* Contact business@redmatpilates.com for salary inquiries.'
        }
      ]
    }
  );

  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'My Salary Statements',
      emoji: true
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true
    },
    blocks
  };
}

/**
 * Build error modal when statements can't be loaded
 */
export function buildSalaryErrorModal(): View {
  return {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'My Salary Statements',
      emoji: true
    },
    close: {
      type: 'plain_text',
      text: 'Close',
      emoji: true
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '❌ *Error Loading Salary Statements*\n\nWe encountered an error while fetching your salary statements. Please try again later or contact support.'
        }
      }
    ]
  };
}
