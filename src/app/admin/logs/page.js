'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, getDisplayUsername } from '@/lib/auth';
import { AdminGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import { ToastProvider } from '@/components/Toast';
import Link from 'next/link';

function LogsContent() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchEmail, setSearchEmail] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLogs([]);
    setPage(0);
    setHasMore(true);
    fetchLogs(0, true);
  }, [actionFilter, searchEmail]);

  const fetchLogs = async (pageIndex, reset = false) => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

      if (actionFilter !== 'ALL') {
        query = query.eq('action', actionFilter);
      }
      if (searchEmail) {
        query = query.ilike('user_email', `%${searchEmail}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      if (reset) {
        setLogs(data);
      } else {
        setLogs(prev => [...prev, ...data]);
      }
      
      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLogs(next);
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'UPDATE': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'DELETE': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'IMPORT': return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
      case 'BACKUP': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-slate-400 hover:text-slate-200 mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">Registro de Auditoría</h1>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="ALL">Todas las acciones</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="IMPORT">IMPORT</option>
            <option value="BACKUP">BACKUP</option>
          </select>
          <input
            type="text"
            placeholder="Buscar por usuario o email..."
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 text-slate-300 text-sm">
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium">Usuario</th>
                <th className="p-4 font-medium">Acción</th>
                <th className="p-4 font-medium">Entidad</th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors text-sm">
                  <td className="p-4 text-slate-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="p-4">
                    <span className="text-slate-200 font-medium block">{getDisplayUsername(log.user_email)}</span>
                    <span className="text-xs text-slate-500 font-mono">{log.user_email}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 capitalize">{log.entity_type}</td>
                  <td className="p-4 text-slate-300">{log.entity_name || '-'}</td>
                  <td className="p-4 text-slate-500">
                    {log.details ? (
                      <details className="cursor-pointer">
                        <summary>Ver</summary>
                        <pre className="mt-2 text-xs bg-slate-950 p-2 rounded overflow-auto max-w-xs max-h-32">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && !loading && (
            <div className="text-center p-8 text-slate-400">No hay registros</div>
          )}
        </div>
        
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-6 py-2 rounded-lg font-medium transition-colors border border-slate-700 disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Cargar más'}
            </button>
          </div>
        )}
      </div>
      <Navbar />
    </div>
  );
}

export default function Page() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AdminGuard>
          <LogsContent />
        </AdminGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
