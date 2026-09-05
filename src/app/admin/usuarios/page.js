'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import { ToastProvider, useToast } from '@/components/Toast';
import { logAction } from '@/lib/audit';
import Link from 'next/link';

function UsuariosContent() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error(error);
      showToast('Error al cargar usuarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUser.id);
        
      if (error) throw error;

      await logAction({
        supabase,
        userId: currentUser.id,
        userEmail: currentProfile?.email || currentUser.email,
        action: 'UPDATE',
        entityType: 'profile',
        entityId: targetUser.id,
        entityName: targetUser.email,
        details: { old_role: targetUser.role, new_role: newRole }
      });

      setUsers(users.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
      showToast(`Rol actualizado a ${newRole}`, 'success');
    } catch (error) {
      console.error(error);
      showToast('Error al actualizar rol', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <Link href="/admin" className="text-slate-400 hover:text-slate-200 mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">Gestión de Usuarios</h1>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 text-slate-300 text-sm">
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Registro</th>
                <th className="p-4 font-medium">Rol</th>
                <th className="p-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan="5" className="p-4 text-center text-slate-400">Cargando...</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors text-sm">
                    <td className="p-4 text-slate-200">{u.email}</td>
                    <td className="p-4 text-slate-400">{u.display_name || '-'}</td>
                    <td className="p-4 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${u.role === 'admin' ? 'text-violet-400 bg-violet-400/10 border-violet-400/20' : 'text-slate-400 bg-slate-400/10 border-slate-400/20'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => toggleRole(u)}
                        disabled={u.id === currentUser.id}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          u.id === currentUser.id 
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        }`}
                      >
                        Hacer {u.role === 'admin' ? 'Usuario' : 'Admin'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
          <UsuariosContent />
        </AdminGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
