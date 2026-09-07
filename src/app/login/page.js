'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatAuthEmail } from '@/lib/auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const email = formatAuthEmail(username);
      if (!email) {
        throw new Error('Por favor ingresa un nombre de usuario');
      }

      let { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Fallback por si el usuario fue creado previamente con @taller.com
      if (signInError && !username.includes('@')) {
        const fallbackEmail = `${username.trim().toLowerCase()}@taller.com`;
        const fallbackRes = await supabase.auth.signInWithPassword({
          email: fallbackEmail,
          password,
        });
        if (!fallbackRes.error) {
          signInError = null;
        }
      }

      if (signInError) {
        if (signInError.message === 'Invalid login credentials') {
          throw new Error('Usuario o contraseña incorrectos');
        }
        if (signInError.message?.toLowerCase().includes('email not confirmed')) {
          throw new Error('Esta cuenta no está confirmada. Vuelve a crearla desde Administración > Usuarios.');
        }
        throw signInError;
      }
      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-700/50 p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-center text-slate-100 mb-2">
          Pantone Manager
        </h1>
        <p className="text-center text-slate-500 text-sm mb-8">
          Entra con tu usuario y contraseña
        </p>
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. aitor"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
