'use client';

const TINTAS = [
  'Black',
  'Cian',
  'Magenta',
  'Yellow',
  '021',
  'Warm Red',
  'Rubine Red',
  'Rhodamine Red',
  'Purple',
  'Violet',
  'Blue 072',
  'Reflex Blue',
  'Process Blue',
  'Green',
  'Opaque White',
  'Laca'
];

export default function IngredientRow({ ingredient, onChange, onRemove, index }) {
  const handleChange = (field, value) => {
    onChange(index, { ...ingredient, [field]: value });
  };

  return (
    <div className="flex flex-col md:flex-row gap-3 items-center bg-slate-900 p-4 rounded-lg border border-slate-700/50 transition-all duration-200">
      <div className="w-full md:flex-1">
        <label className="block text-xs font-medium text-slate-400 mb-1 md:hidden">Tinta Base</label>
        <select
          value={ingredient.tinta_base}
          onChange={(e) => handleChange('tinta_base', e.target.value)}
          className="w-full bg-slate-800 border border-slate-700/50 rounded-md py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all duration-200"
        >
          <option value="">Selecciona tinta...</option>
          {TINTAS.map(tinta => (
            <option key={tinta} value={tinta}>{tinta}</option>
          ))}
        </select>
      </div>
      
      <div className="w-full md:w-32">
        <label className="block text-xs font-medium text-slate-400 mb-1 md:hidden">Cantidad</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={ingredient.cantidad}
          onChange={(e) => handleChange('cantidad', parseFloat(e.target.value) || '')}
          className="w-full bg-slate-800 border border-slate-700/50 rounded-md py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all duration-200"
          placeholder="0.00"
        />
      </div>
      
      <div className="w-full md:w-24">
        <label className="block text-xs font-medium text-slate-400 mb-1 md:hidden">Unidad</label>
        <select
          value={ingredient.unidad}
          onChange={(e) => handleChange('unidad', e.target.value)}
          className="w-full bg-slate-800 border border-slate-700/50 rounded-md py-2 px-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all duration-200"
        >
          <option value="kg">kg</option>
          <option value="gr">gr</option>
        </select>
      </div>
      
      <div className="w-full md:w-auto flex justify-end mt-2 md:mt-0">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all duration-200"
          title="Eliminar ingrediente"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
