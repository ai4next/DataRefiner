import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Landing from './components/landing/Landing.js';
import Login from './components/common/Login.js';
import Dashboard from './components/dashboard/Dashboard.js';
import TaskWizard from './components/common/TaskWizard.js';
import TaskHistory from './components/common/TaskHistory.js';
import Templates from './components/templates/Templates.js';
import Settings from './components/settings/Settings.js';
import ErrorBoundary from './components/common/ErrorBoundary.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { i18n } = useTranslation();

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/task/new" element={<ProtectedRoute><TaskWizard /></ProtectedRoute>} />
        <Route path="/task/:fileId" element={<ProtectedRoute><TaskWizard /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><TaskHistory /></ProtectedRoute>} />
        <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      </Routes>
    </ErrorBoundary>
  );
}