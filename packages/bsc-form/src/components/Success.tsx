import { useSearchParams } from 'react-router-dom';
import { formatQuarterDisplay } from '../utils/quarterUtils';
import './Success.css';

export default function Success() {
  const [searchParams] = useSearchParams();
  const quarter = searchParams.get('quarter') || 'this quarter';

  return (
    <div className="success-container">
      <div className="success-card">
        <div className="success-icon">✅</div>
        <h1>Assessment Submitted!</h1>
        <p className="success-message">
          Your self-assessment for <strong>{formatQuarterDisplay(quarter)}</strong> has been successfully submitted.
        </p>
        <div className="next-steps">
          <h2>What's Next?</h2>
          <ul>
            <li>Your manager will review your self-assessment</li>
            <li>They may adjust scores based on performance data</li>
            <li>You'll be notified once the validation is complete</li>
            <li>Your quarterly bonus will be calculated based on the final validated score</li>
          </ul>
        </div>
        <div className="info-note">
          <p>
            💡 <strong>Tip:</strong> Check your Slack for updates on your BSC validation status.
          </p>
        </div>
        <button onClick={() => window.close()} className="close-button">
          Close Window
        </button>
      </div>
    </div>
  );
}
