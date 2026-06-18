import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORY_LABELS = {
  NOTA_FISCAL: 'Nota fiscal',
  EXTRATO_BANCARIO: 'Extrato bancário',
  CONTRATO: 'Contrato',
  GUIA_IMPOSTO: 'Guia de imposto',
  COMPROVANTE: 'Comprovante',
  OUTRO: 'Outro',
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadModal({ clients, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('NOTA_FISCAL');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return setError('Selecione um arquivo.');
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      if (clientId) formData.append('clientId', clientId);
      await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.error || 'Não foi possível enviar o arquivo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Enviar documento</h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="block text-sm font-medium mb-1">Arquivo</label>
          <input required type="file" onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm border border-ink/15 rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Categoria</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {clients.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm">
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-ink/60 hover:bg-ink/5">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const [docsRes, clientsRes] = await Promise.all([
      api.get('/documents'),
      user.role !== 'CLIENT' ? api.get('/clients') : Promise.resolve({ data: [] }),
    ]);
    setDocuments(docsRes.data);
    setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    await api.delete(`/documents/${id}`);
    load();
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="text-ink/50 text-sm">Centralizador de arquivos trocados entre escritório e clientes.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
          + Enviar documento
        </button>
      </div>

      <div className="bg-white rounded-xl border border-ink/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-ink/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Arquivo</th>
              <th className="text-left px-4 py-3">Categoria</th>
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-left px-4 py-3">Tamanho</th>
              <th className="text-left px-4 py-3">Enviado por</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="px-4 py-3">
                  <a href={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:4000'}${doc.fileUrl}`}
                    target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                    {doc.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-ink/60">{CATEGORY_LABELS[doc.category]}</td>
                <td className="px-4 py-3 text-ink/60">{doc.client?.name}</td>
                <td className="px-4 py-3 text-ink/60">{formatSize(doc.fileSize)}</td>
                <td className="px-4 py-3 text-ink/60">{doc.uploadedBy?.name}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(doc.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Excluir</button>
                </td>
              </tr>
            ))}
            {!loading && documents.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink/40">Nenhum documento enviado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && <UploadModal clients={clients} onClose={() => setShowModal(false)} onUploaded={() => { setShowModal(false); load(); }} />}
    </Layout>
  );
}
