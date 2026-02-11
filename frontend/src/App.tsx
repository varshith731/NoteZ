import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { lazy, Suspense, useEffect } from 'react';
import LoginForm from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import ProtectedRoute from './components/ProtectedRoute';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CreatorRoute from './components/CreatorRoute';
import AdminRoute from './components/AdminRoute';

// Import profile and settings directly for debugging
import PublicProfilePage from './components/dashboard/pages/PublicProfilePage';
import SettingsPage from './components/dashboard/pages/SettingsPage';

const AdminDashboard = lazy(() => import('./components/dashboard/pages/AdminDashboard'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const CreatorDashboard = lazy(() => import('./components/dashboard/ContentCreatorDashboard').then(m => ({ default: m.ContentCreatorDashboard })));

function App() {
  useEffect(() => {
    // Default title; route components override as needed
    document.title = 'NoteZ';
  }, []);
  return (
    <Router>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient()}>
          <div className="App">
            <Suspense fallback={<div className="p-6 text-gray-300">Loading...</div>}>
              <Routes>
                <Route path="/login" element={<LoginForm />} />
                <Route path="/register" element={<RegisterForm />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfilePage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/creator" element={<ProtectedRoute><CreatorRoute><CreatorDashboard /></CreatorRoute></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
                <Route path="/" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </div>
        </QueryClientProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;