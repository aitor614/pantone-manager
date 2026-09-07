'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth, formatAuthEmail, getDisplayUsername, DEFAULT_EMAIL_DOMAIN } from '@/lib/auth';
import { AdminGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import { ToastProvider, useToast } from '@/components/Toast';
import { logAction } from '@/lib/audit';
import Link from 'next/link';

function UsuariosContent() {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);
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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const cleanUsername = newUsername.trim();
    if (!cleanUsername) {
      showToast('Ingresa un nombre de usuario', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }
    setCreating(true);

    try {
      const targetEmail = formatAuthEmail(cleanUsername);
      const targetDisplayName = newDisplayName.trim() || cleanUsername;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sesión caducada. Vuelve a iniciar sesión.');
      }

      const res = await fetch('/api/crear-usuario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: targetEmail,
          password: newPassword,
          usuario: cleanUsername.trim().toLowerCase(),
          rol: newRole,
          display_name: targetDisplayName
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al crear usuario');
      }

      await logAction({
        supabase,
        userId: currentUser.id,
        userEmail: currentProfile?.email || currentUser.email,
        action: 'CREATE',
        entityType: 'profile',
        entityId: json.id,
        entityName: targetEmail,
        details: {
          username: cleanUsername,
          email: targetEmail,
          role: newRole,
          display_name: targetDisplayName
        }
      });

      showToast(`Usuario "${cleanUsername}" creado correctamente`, 'success');
      setShowCreateModal(false);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('user');
      await fetchUsers();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error al crear usuario', 'error');
    } finally {
      setCreating(false);
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/admin" className="text-slate-400 hover:text-slate-200 mr-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Gestión de Usuarios</h1>
              <p className="text-xs text-slate-500">Los usuarios creados usarán el dominio @{DEFAULT_EMAIL_DOMAIN}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-lg shadow-violet-900/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span>Crear Usuario</span>
          </button>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 text-slate-300 text-sm">
                <th className="p-4 font-medium">Usuario / Email</th>
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
                    <td className="p-4">
                      <span className="text-slate-100 font-medium block">{getDisplayUsername(u.email)}</span>
                      <span className="text-xs text-slate-500 font-mono">{u.email}</span>
                    </td>
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

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700/60 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-slate-100">Crear Nuevo Usuario</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Nombre de usuario</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="ej. pepe"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
                {newUsername && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <span>Email asignado:</span>
                    <span className="text-violet-400 font-mono">{formatAuthEmail(newUsername)}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">Nombre completo / Alias <span className="text-slate-500">(opcional)</span></label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="ej. Pepe García"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-1">Rol</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="user">Usuario normal</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-1/2 py-2 text-sm rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
