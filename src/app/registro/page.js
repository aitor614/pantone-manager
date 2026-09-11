'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { display_name: displayName.trim() } }
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        router.push('/');
        return;
      }
      setMessage('Cuenta creada. Revisa tu correo para confirmar el acceso.');
    } catch (registrationError) {
      setError(registrationError.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-slate-900 rounded-xl border border-slate-700/50 p-8 shadow-xl space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Crear cuenta</h1>
          <p className="text-slate-400 text-sm mt-2">El administrador podrá ajustar tu rol después.</p>
        </div>
        {error && <p className="bg-red-900/40 border border-red-500/40 text-red-200 p-3 rounded-lg text-sm">{error}</p>}
        {message && <p className="bg-emerald-900/40 border border-emerald-500/40 text-emerald-200 p-3 rounded-lg text-sm">{message}</p>}
        <label className="block text-slate-400 text-sm">
          Nombre visible
          <input value={displayName} onChange={event => setDisplayName(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100" />
        </label>
        <label className="block text-slate-400 text-sm">
          Email
          <input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100" />
        </label>
        <label className="block text-slate-400 text-sm">
          Contraseña
          <input type="password" minLength={6} required value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100" />
        </label>
        <button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3 rounded-lg disabled:opacity-50">
          {loading ? 'Creando...' : 'Registrarme'}
        </button>
        <Link href="/login" className="block text-center text-violet-400 hover:text-violet-300 text-sm">Volver al login</Link>
      </form>
    </main>
  );
}
