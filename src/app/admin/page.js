'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, getDisplayUsername } from '@/lib/auth';
import { AdminGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import { ToastProvider } from '@/components/Toast';
import Link from 'next/link';

function AdminContent() {
  const [stats, setStats] = useState({ pantones: 0, usuarios: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [{ count: pCount }, { count: uCount }, { data: lData }] = await Promise.all([
        supabase.from('pantones').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(5)
      ]);
      
      setStats({ pantones: pCount || 0, usuarios: uCount || 0 });
      setLogs(lData || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'UPDATE': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'DELETE': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'BACKUP': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 p-6 text-slate-100">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h1 className="text-3xl font-bold text-slate-100 mb-8">Panel de Administración</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/admin/usuarios" className="bg-slate-900 rounded-xl border border-slate-700/50 p-6 hover:border-violet-500/50 transition-colors">
            <div className="text-slate-400 text-sm font-medium mb-2">Total Usuarios</div>
            <div className="text-3xl font-bold text-slate-100">{stats.usuarios}</div>
          </Link>
          <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
            <div className="text-slate-400 text-sm font-medium mb-2">Total Pantones</div>
            <div className="text-3xl font-bold text-slate-100">{stats.pantones}</div>
          </div>
          <Link href="/admin/backups" className="bg-slate-900 rounded-xl border border-slate-700/50 p-6 hover:border-violet-500/50 transition-colors">
            <div className="text-slate-400 text-sm font-medium mb-2">Copias de Seguridad</div>
            <div className="text-slate-100 mt-2 text-sm flex items-center">
              Gestionar <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-100">Acciones recientes</h2>
            <Link href="/admin/logs" className="text-violet-400 hover:text-violet-300 text-sm font-medium">
              Ver todos
            </Link>
          </div>
          
          <div className="space-y-4">
            {logs.map(log => (
              <div key={log.id} className="border-b border-slate-800 last:border-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-slate-300 text-sm font-medium">{getDisplayUsername(log.user_email)}</span>
                    <span className="text-slate-500 text-xs">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </div>
                <div className="text-slate-400 text-sm mt-1">
                  {log.entity_type} {log.entity_name ? `- ${log.entity_name}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
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
          <AdminContent />
        </AdminGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
