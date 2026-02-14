import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BSCForm from './components/BSCForm';
import Success from './components/Success';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* BSC Form Routes - uses secure access token */}
        <Route path="/form/:token" element={<BSCForm />} />
        <Route path="/form/:token/:quarter" element={<BSCForm />} />

        {/* Success Page */}
        <Route path="/success" element={<Success />} />

        {/* Home - show instructions */}
        <Route path="/" element={<Home />} />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Simple home page with instructions
function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '48px 40px',
        maxWidth: '600px',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        border: '1px solid #e5e7eb',
      }}>
        <h1 style={{
          marginBottom: '16px',
          color: '#080808',
          fontSize: '32px',
          fontWeight: '600',
          letterSpacing: '-0.5px',
        }}>
          RedMat Pilates
        </h1>
        <p style={{
          color: '#116dff',
          fontSize: '15px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '24px',
        }}>
          BSC Self-Assessment Portal
        </p>
        <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '28px', fontSize: '15px' }}>
          This is the Balanced Score Card self-assessment portal for RedMat Pilates trainers.
        </p>
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'left',
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px', color: '#080808', fontWeight: '600' }}>
            How to Access Your Form
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
            You should receive a personalized link from your manager via Slack when it's time to complete your quarterly assessment.
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            Your personalized link contains a secure access token that is unique to you.
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
