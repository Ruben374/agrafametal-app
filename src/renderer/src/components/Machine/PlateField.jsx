export function PlateField({ label, valor, campo, onSave, unidade }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-400 font-semibold mb-1">{label}</label>
      <div
        className="font-mono text-lg font-bold text-white outline-none focus:bg-white/10 hover:bg-white/5 rounded transition-colors px-2 py-1 -ml-2 cursor-text min-h-[36px] min-w-[80px] empty:before:content-['---'] empty:before:text-gray-500"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onSave(campo, e.currentTarget.textContent)}
      >
        {valor}
      </div>
      {unidade && <span className="text-gray-400 text-[10px] font-bold ml-1">{unidade}</span>}
    </div>
  )
}

export function PlateInlineField({ valor, campo, onSave, unidade, largura = 'min-w-[50px]' }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`bg-gray-800 text-gray-100 px-3 py-1.5 rounded font-mono text-sm border border-gray-600 inline-block outline-none focus:bg-gray-700 cursor-text ${largura} text-center shadow-inner min-h-[32px] empty:before:content-['0'] empty:before:text-gray-500`}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onSave(campo, e.currentTarget.textContent)}
      >
        {valor}
      </span>
      <span className="text-gray-400 text-[10px] font-bold">{unidade}</span>
    </span>
  )
}
