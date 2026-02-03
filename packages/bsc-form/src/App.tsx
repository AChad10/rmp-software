import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BSCForm from './components/BSCForm';
import Success from './components/Success';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* BSC Form Routes */}
        <Route path="/:trainerId" element={<BSCForm />} />
        <Route path="/:trainerId/:quarter" element={<BSCForm />} />

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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '600px',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        <h1 style={{ marginBottom: '20px', color: '#1f2937' }}>
          Red Mat Pilates - BSC Submission
        </h1>
        <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '20px' }}>
          This is the BSC (Balanced Score Card) self-assessment portal for Red Mat Pilates trainers.
        </p>
        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'left',
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#1f2937' }}>
            📋 How to Access Your Form
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
            You should receive a personalized link from your manager via Slack when it's time to complete your quarterly assessment.
          </p>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', marginTop: '10px' }}>
            The link format is: <code style={{
              background: '#e5e7eb',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              /trainerId/quarter
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
