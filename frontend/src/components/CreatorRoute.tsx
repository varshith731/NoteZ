import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function CreatorRoute({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setRole(null);
      return;
    }
    fetch('http://localhost:3001/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setRole(data?.user?.role || null);
        setLoading(false);
      })
      .catch(() => {
        setRole(null);
        setLoading(false);
      });
  }, []);

  if (loading) return null;
  if (role !== 'content_creator') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}


