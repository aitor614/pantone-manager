'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import IngredientRow from '@/components/IngredientRow';
import { ToastProvider, useToast } from '@/components/Toast';
import { logAction } from '@/lib/audit';
import Link from 'next/link';

function NuevoContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  
  const [nombre, setNombre] = useState('');
  const [notas, setNotas] = useState('');
  const [ingredientes, setIngredientes] = useState([
    { id: Date.now(), tinta_base: '', cantidad: '', unidad: 'g' }
  ]);
  const [saving, setSaving] = useState(false);

  const addIngredient = () => {
    setIngredientes([...ingredientes, { id: Date.now(), tinta_base: '', cantidad: '', unidad: 'g' }]);
  };

  const updateIngredient = (id, field, value) => {
    setIngredientes(ingredientes.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));
  };

  const removeIngredient = (id) => {
    setIngredientes(ingredientes.filter(ing => ing.id !== id));
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    if (ingredientes.length === 0) {
      showToast('Añade al menos un ingrediente', 'error');
      return;
    }
    
    for (const ing of ingredientes) {
      if (!ing.tinta_base || !ing.cantidad || Number(ing.cantidad) <= 0 || !ing.unidad) {
        showToast('Completa todos los campos de los ingredientes', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const { data: pantone, error: pantoneError } = await supabase
        .from('pantones')
        .insert([{ nombre, notas, created_by: user.id }])
        .select()
        .single();
        
      if (pantoneError) throw pantoneError;

      const formula = ingredientes.map(({ id, ...rest }) => ({
        ...rest,
        pantone_id: pantone.id
      }));

      const { error: formulaError } = await supabase
        .from('formula_ingredientes')
        .insert(formula);

      if (formulaError) throw formulaError;

      await logAction({
        supabase,
        userId: user.id,
        userEmail: profile?.email || user.email,
        action: 'CREATE',
        entityType: 'pantone',
        entityId: pantone.id,
        entityName: nombre,
        details: { formula }
      });

      showToast('Pantone creado correctamente', 'success');
      router.push(`/pantone/${pantone.id}`);
    } catch (error) {
      console.error(error);
      showToast('Error al guardar: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="flex items-center mb-6">
          <Link href="/" className="text-slate-400 hover:text-slate-200 mr-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">Nuevo Pantone</h1>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">Nombre del Pantone *</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Ej. 185 C"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                rows="3"
                placeholder="Detalles sobre la mezcla, sustrato..."
              />
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Fórmula</h2>
            <div className="space-y-3 mb-4">
              {ingredientes.map((ing) => (
                <IngredientRow
                  key={ing.id}
                  ingredient={ing}
                  onChange={(field, val) => updateIngredient(ing.id, field, val)}
                  onRemove={() => removeIngredient(ing.id)}
                />
              ))}
            </div>
            <button
              onClick={addIngredient}
              className="text-violet-400 hover:text-violet-300 font-medium text-sm flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Añadir tinta
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Pantone'}
          </button>
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
        <AuthGuard>
          <NuevoContent />
        </AuthGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
