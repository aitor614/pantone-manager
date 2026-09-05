'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import FormulaTable from '@/components/FormulaTable';
import ConfirmDialog from '@/components/ConfirmDialog';
import { ToastProvider, useToast } from '@/components/Toast';
import { logAction } from '@/lib/audit';
import Link from 'next/link';

function PantoneDetailContent({ id }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [pantone, setPantone] = useState(null);
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [creator, setCreator] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pData, error: pError } = await supabase
        .from('pantones')
        .select('*')
        .eq('id', id)
        .single();
      if (pError) throw pError;
      setPantone(pData);

      const { data: iData, error: iError } = await supabase
        .from('formula_ingredientes')
        .select('*')
        .eq('pantone_id', id)
        .order('cantidad', { ascending: false });
      if (iError) throw iError;
      setIngredientes(iData || []);

      if (pData.created_by) {
        const { data: uData } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', pData.created_by)
          .single();
        setCreator(uData);
      }
    } catch (error) {
      console.error(error);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('pantones')
        .delete()
        .eq('id', id);
      if (error) throw error;

      await logAction({
        supabase,
        userId: user.id,
        userEmail: profile?.email || user.email,
        action: 'DELETE',
        entityType: 'pantone',
        entityId: id,
        entityName: pantone.nombre,
      });

      showToast('Pantone eliminado', 'success');
      router.push('/');
    } catch (error) {
      console.error(error);
      showToast('Error al eliminar', 'error');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 p-6 text-slate-100">Cargando...</div>;
  }

  if (!pantone) {
    return <div className="min-h-screen bg-slate-950 p-6 text-slate-100">Pantone no encontrado</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <Link href="/" className="text-slate-400 hover:text-slate-200 mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-100">{pantone.nombre}</h1>
            <p className="text-slate-400 text-sm mt-1">
              Creado el {new Date(pantone.created_at).toLocaleDateString()}
              {creator && ` por ${creator.display_name || creator.email}`}
            </p>
          </div>
        </div>

        {pantone.notas && (
          <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-4 mb-6">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Notas</h3>
            <p className="text-slate-200">{pantone.notas}</p>
          </div>
        )}

        <div className="bg-slate-900 rounded-xl border border-slate-700/50 overflow-hidden mb-6">
          <FormulaTable ingredientes={ingredientes} />
        </div>

        <div className="flex gap-4">
          <Link href={`/pantone/${id}/editar`} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-100 text-center font-medium py-3 rounded-xl transition-colors border border-slate-700">
            Editar
          </Link>
          <button onClick={() => setShowConfirm(true)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-xl transition-colors">
            Eliminar
          </button>
        </div>
      </div>
      
      {showConfirm && (
        <ConfirmDialog
          title="¿Eliminar Pantone?"
          message={`¿Estás seguro de que deseas eliminar ${pantone.nombre}? Esta acción no se puede deshacer.`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      
      <Navbar />
    </div>
  );
}

export default function Page({ params }) {
  const { id } = use(params);
  
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGuard>
          <PantoneDetailContent id={id} />
        </AuthGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
