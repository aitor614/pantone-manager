'use client';

export default function FormulaTable({ ingredientes }) {
  if (!ingredientes || ingredientes.length === 0) {
    return <p className="text-slate-400 text-sm italic">No hay ingredientes en la fórmula.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/50">
      <table className="min-w-full divide-y divide-slate-700/50">
        <thead className="bg-slate-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Tinta Base
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Cantidad
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Unidad
            </th>
          </tr>
        </thead>
        <tbody className="bg-slate-900 divide-y divide-slate-700/50">
          {ingredientes.map((ingrediente, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/50'}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                {ingrediente.tinta_base}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                {ingrediente.cantidad}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  ingrediente.unidad === 'kg' 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {ingrediente.unidad}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
