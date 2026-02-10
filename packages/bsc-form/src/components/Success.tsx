import { useSearchParams } from 'react-router-dom';
import { formatQuarterDisplay } from '../utils/quarterUtils';
import './Success.css';

export default function Success() {
  const [searchParams] = useSearchParams();
  const quarter = searchParams.get('quarter') || 'this quarter';

  return (
    <div className="success-container">
      <div className="success-card">
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="success-icon"
        >
          <circle cx="40" cy="40" r="40" fill="#dcfce7" />
          <path
            d="M55 30L35 50L25 40"
            stroke="#16a34a"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <h1>Assessment Submitted Successfully</h1>
        <p className="success-message">
          Your self-assessment for <strong>{formatQuarterDisplay(quarter)}</strong> has been submitted and is now under review.
        </p>

        <div className="next-steps">
          <h2>What Happens Next</h2>
          <ul>
            <li>Your manager will review your self-assessment</li>
            <li>Scores may be adjusted based on performance data</li>
            <li>You'll receive notification once validation is complete</li>
            <li>Your quarterly bonus will be calculated from the final validated score</li>
          </ul>
        </div>

        <div className="info-note">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="10" cy="10" r="10" fill="#dbeafe" />
            <path d="M10 6v4M10 14h.01" stroke="#116dff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p>
            Check your Slack for updates on your BSC validation status.
          </p>
        </div>

        <button
          onClick={() => {
            // Try to close the window if it was opened by JavaScript
            window.close();
            // If the window doesn't close (not opened by JS), redirect back
            setTimeout(() => {
              if (!window.closed) {
                window.location.href = 'about:blank';
              }
            }, 100);
          }}
          className="close-button"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}
