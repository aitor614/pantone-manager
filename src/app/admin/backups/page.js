'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth, getDisplayUsername } from '@/lib/auth';
import { AdminGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import { ToastProvider, useToast } from '@/components/Toast';
import { logAction } from '@/lib/audit';
import Link from 'next/link';

function BackupsContent() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const { showToast } = useToast();

  useEffect(() => {
    fetchBackupLogs();
  }, []);

  const fetchBackupLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('action', 'BACKUP')
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: pantones, error: pError } = await supabase.from('pantones').select('*');
      if (pError) throw pError;

      const { data: formulaIngredientes, error: fError } = await supabase.from('formula_ingredientes').select('*');
      if (fError) throw fError;

      const pantonesWithIngredients = pantones.map(p => ({
        ...p,
        ingredientes: formulaIngredientes.filter(f => f.pantone_id === p.id)
      }));

      const exportData = {
        exportDate: new Date().toISOString(),
        exportedBy: profile?.email || user.email,
        pantones: pantonesWithIngredients
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pantone-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await logAction({
        supabase,
        userId: user.id,
        userEmail: profile?.email || user.email,
        action: 'BACKUP',
        entityType: 'system',
        entityId: 'backup',
        entityName: 'Exportación de datos completa'
      });

      showToast('Backup exportado correctamente', 'success');
      fetchBackupLogs();
    } catch (error) {
      console.error(error);
      showToast('Error al exportar backup', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-slate-200 mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">Copias de Seguridad</h1>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-8 text-center mb-8">
          <svg className="w-16 h-16 text-violet-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Exportar Datos</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Descarga un archivo JSON con todos los pantones y sus fórmulas.
            Este archivo sirve como respaldo local de tu base de datos.
          </p>
          <button
            onClick={handleExport}
            disabled={loading}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-colors disabled:opacity-50 inline-flex items-center"
          >
            {loading ? (
              <>Cargando...</>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Exportar Backup Completo
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Últimos Backups (Top 10)</h3>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-slate-400 text-sm">No hay registros de backups.</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-200">{new Date(log.created_at).toLocaleString()}</span>
                    <span className="text-xs text-slate-400">Por: {getDisplayUsername(log.user_email)}</span>
                  </div>
                  <span className="text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded text-xs font-medium">
                    BACKUP
                  </span>
                </div>
              ))
            )}
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
          <BackupsContent />
        </AdminGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
