import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Trainers from './pages/Trainers';
import BSCReview from './pages/BSCReview';
import Salary from './pages/Salary';
import AuditLogs from './pages/AuditLogs';
import TrainerLogs from './pages/TrainerLogs';
import { useAuthStore } from './store/authStore';

function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected – layout wraps all inner pages */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="trainers" element={<Trainers />} />
          <Route path="bsc-review" element={<BSCReview />} />
          <Route path="salary" element={<Salary />} />
          <Route path="trainer-logs" element={<TrainerLogs />} />
          <Route path="audit-logs" element={<AuditLogs />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
