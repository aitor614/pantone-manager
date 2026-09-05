'use client';

import Link from 'next/link';

export default function PantoneCard({ pantone }) {
  const { id, nombre, notas, created_at } = pantone;

  const formattedDate = new Date(created_at).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <Link href={`/pantone/${id}`} className="block">
      <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.15)] hover:scale-[1.02] transition-all duration-200 cursor-pointer h-full flex flex-col">
        <h3 className="text-xl font-bold text-slate-100 mb-2 truncate" title={nombre}>
          {nombre}
        </h3>
        
        {notas ? (
          <p className="text-sm text-slate-400 mb-4 line-clamp-2 flex-grow">
            {notas}
          </p>
        ) : (
          <div className="flex-grow"></div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-500">
          <span>Añadido</span>
          <span>{formattedDate}</span>
        </div>
      </div>
    </Link>
  );
}
