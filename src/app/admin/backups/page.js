'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthProvider, useAuth, getDisplayUsername } from '@/lib/auth';
import { AdminGuard } from '@/components/AuthGuard';
import Navbar from '@/components/Navbar';
import { ToastProvider, useToast } from '@/components/Toast';
import { logAction } from '@/lib/audit';
import Link from 'next/link';

const CSV_HEADERS = ['pantone', 'notas', 'tinta_base', 'cantidad', 'unidad'];

function escapeCsvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some(cell => cell.trim() !== '')) rows.push(row);
  return rows;
}

function BackupsContent() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
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

      const rows = [CSV_HEADERS.map(escapeCsvValue).join(',')];
      pantones.forEach(pantone => {
        const ingredients = formulaIngredientes.filter(ingredient => ingredient.pantone_id === pantone.id);
        const pantoneIngredients = ingredients.length > 0 ? ingredients : [{}];

        pantoneIngredients.forEach(ingredient => {
          rows.push([
            pantone.nombre,
            pantone.notas || '',
            ingredient.tinta_base || '',
            ingredient.cantidad || '',
            ingredient.unidad || ''
          ].map(escapeCsvValue).join(','));
        });
      });

      const blob = new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pantone-backup-${new Date().toISOString().split('T')[0]}.csv`;
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
        entityId: null,
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

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const rows = parseCsv(await file.text());
      const headers = rows.shift()?.map(header => header.trim().toLowerCase().replace(/^\uFEFF/, '')) || [];
      if (CSV_HEADERS.some((header, index) => headers[index] !== header)) {
        throw new Error('El CSV no tiene las columnas esperadas: pantone, notas, tinta_base, cantidad, unidad.');
      }

      const groupedPantones = new Map();
      rows.forEach(row => {
        const [nombre, notas, tintaBase, cantidad, unidad] = row;
        if (!nombre?.trim()) throw new Error('Hay una fila sin nombre de pantone.');

        const key = nombre.trim();
        if (!groupedPantones.has(key)) {
          groupedPantones.set(key, { nombre: key, notas: notas?.trim() || '', ingredientes: [] });
        }

        const hasIngredient = [tintaBase, cantidad, unidad].some(value => value?.trim());
        if (hasIngredient) {
          if (!tintaBase?.trim() || !cantidad?.trim() || !unidad?.trim()) {
            throw new Error(`La fórmula de ${key} está incompleta.`);
          }
          if (!['kg', 'gr'].includes(unidad.trim()) || Number(cantidad) <= 0) {
            throw new Error(`La fórmula de ${key} tiene una cantidad o unidad inválida.`);
          }
          groupedPantones.get(key).ingredientes.push({
            tinta_base: tintaBase.trim(),
            cantidad: Number(cantidad),
            unidad: unidad.trim()
          });
        }
      });

      if (groupedPantones.size === 0) throw new Error('El archivo no contiene pantones.');

      for (const pantoneData of groupedPantones.values()) {
        const { data: existing, error: findError } = await supabase
          .from('pantones')
          .select('id')
          .eq('nombre', pantoneData.nombre)
          .maybeSingle();
        if (findError) throw findError;

        let pantoneId = existing?.id;
        if (pantoneId) {
          const { error } = await supabase
            .from('pantones')
            .update({ notas: pantoneData.notas, updated_at: new Date().toISOString() })
            .eq('id', pantoneId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('pantones')
            .insert([{ nombre: pantoneData.nombre, notas: pantoneData.notas, created_by: user.id }])
            .select('id')
            .single();
          if (error) throw error;
          pantoneId = data.id;
        }

        const { error: deleteError } = await supabase
          .from('formula_ingredientes')
          .delete()
          .eq('pantone_id', pantoneId);
        if (deleteError) throw deleteError;

        if (pantoneData.ingredientes.length > 0) {
          const { error: insertError } = await supabase
            .from('formula_ingredientes')
            .insert(pantoneData.ingredientes.map(ingredient => ({ ...ingredient, pantone_id: pantoneId })));
          if (insertError) throw insertError;
        }

        await logAction({
          supabase,
          userId: user.id,
          userEmail: profile?.email || user.email,
          action: existing ? 'UPDATE' : 'CREATE',
          entityType: 'pantone',
          entityId: pantoneId,
          entityName: pantoneData.nombre,
          details: { source: 'CSV_IMPORT' }
        });
      }

      await logAction({
        supabase,
        userId: user.id,
        userEmail: profile?.email || user.email,
        action: 'BACKUP',
        entityType: 'system',
        entityId: null,
        entityName: 'Importación de datos CSV',
        details: { pantones: groupedPantones.size }
      });

      showToast(`${groupedPantones.size} pantones importados correctamente`, 'success');
      fetchBackupLogs();
    } catch (error) {
      console.error(error);
      showToast(`Error al importar: ${error.message}`, 'error');
    } finally {
      setImporting(false);
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
            Descarga una tabla CSV compatible con Excel con todos los pantones y sus fórmulas.
            También puedes importar una tabla exportada anteriormente.
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
                Exportar tabla para Excel
              </>
            )}
          </button>
          <label className="mt-4 text-violet-400 hover:text-violet-300 font-medium text-sm cursor-pointer inline-flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14a2 2 0 002-2v-3M3 16v3a2 2 0 002 2" /></svg>
            {importing ? 'Importando...' : 'Importar tabla CSV'}
            <input type="file" accept=".csv,text/csv" onChange={handleImport} disabled={importing} className="hidden" />
          </label>
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
