import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Engagements from './pages/Engagements'
import EngagementDetail from './pages/EngagementDetail'
import ApplicationForm from './pages/ApplicationForm'
import { Metrics, Candidates, Settings } from './pages/Placeholders'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#718096', fontFamily: 'system-ui, sans-serif' }}>Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/apply/:slug" element={<ApplicationForm />} />
          <Route path="/" element={<ProtectedRoute><Engagements /></ProtectedRoute>} />
          <Route path="/engagements/:id" element={<ProtectedRoute><EngagementDetail /></ProtectedRoute>} />
          <Route path="/candidates" element={<ProtectedRoute><Candidates /></ProtectedRoute>} />
          <Route path="/metrics" element={<ProtectedRoute><Metrics /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
