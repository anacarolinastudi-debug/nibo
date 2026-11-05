import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

function SessionBoundary() {
  const { pathname } = useLocation();
  if (pathname.replace(/\/+$/, '').toLowerCase() === '/calculadora-pro-labore') return <App />;
  return <AuthProvider><App /></AuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionBoundary />
    </BrowserRouter>
  </React.StrictMode>
);
