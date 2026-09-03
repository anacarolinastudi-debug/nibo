import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Demands from './pages/Demands';
import Clients from './pages/Clients';
import Financial from './pages/Financial';
import Invoices from './pages/Invoices';
import Payroll from './pages/Payroll';
import Documents from './pages/Documents';
import Obligations from './pages/Obligations';
import Forms from './pages/Forms';
import FormEditor from './pages/FormEditor';
import Relationship from './pages/Relationship';
import RadarEcac from './pages/RadarEcac';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registrar" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Obligations /></ProtectedRoute>} />
      <Route path="/painel-antigo" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/demandas" element={<ProtectedRoute><Demands /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
      <Route path="/notas-fiscais" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
      <Route path="/folha-pagamento" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
      <Route path="/documentos" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
      <Route path="/formularios" element={<ProtectedRoute><Forms /></ProtectedRoute>} />
      <Route path="/formularios/:id" element={<ProtectedRoute><FormEditor /></ProtectedRoute>} />
      <Route path="/relacionamento" element={<ProtectedRoute><Relationship /></ProtectedRoute>} />
      <Route path="/radar-ecac" element={<ProtectedRoute><RadarEcac /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    </Routes>
  );
}
