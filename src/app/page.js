'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/lib/auth';
import { AuthGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import SearchBar from '@/components/SearchBar';
import PantoneCard from '@/components/PantoneCard';
import { ToastProvider } from '@/components/Toast';
import Link from 'next/link';

function HomeContent() {
  const [pantones, setPantones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPantones();
  }, [searchQuery]);

  const fetchPantones = async () => {
    setLoading(true);
    try {
      let query = supabase.from('pantones').select('*').order('nombre');
      if (searchQuery) {
        query = query.ilike('nombre', `%${searchQuery}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      setPantones(data || []);
    } catch (error) {
      console.error('Error fetching pantones:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-slate-100 mb-6">Tus Pantones</h1>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-slate-900 rounded-xl border border-slate-700/50 animate-pulse"></div>
            ))}
          </div>
        ) : pantones.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-4">No hay pantones registrados.</p>
            <Link href="/nuevo" className="inline-block bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium py-2 px-6 rounded-lg transition-colors">
              Crear el primero
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {pantones.map(pantone => (
              <PantoneCard key={pantone.id} pantone={pantone} />
            ))}
          </div>
        )}
      </div>

      <Link href="/nuevo" className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-violet-900/50 hover:scale-105 transition-transform z-10">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
      </Link>
      
      <Navbar />
    </div>
  );
}

export default function Page() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGuard>
          <HomeContent />
        </AuthGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
