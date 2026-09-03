import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!saved || !token) return null;

    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      return null;
    }
  });

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setCheckingSession(false);
      return;
    }

    let active = true;

    async function validateSession() {
      try {
        const { data } = await api.get('/auth/me');
        if (!active) return;
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
      } catch {
        if (!active) return;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    validateSession();

    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, checkingSession, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
