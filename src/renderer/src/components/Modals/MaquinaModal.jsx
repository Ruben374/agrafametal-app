export default function MaquinaModal({
  isOpen,
  nome,
  erro,
  inputRef,
  onChangeNome,
  onCancelar,
  onConfirmar
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-96 p-6">
        <h3 className="font-bold text-lg mb-4 text-gray-800">
          <i className="fa-solid fa-cogs mr-2 text-blue-600"></i>Adicionar Máquina
        </h3>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Nome da máquina</label>
        <input
          ref={inputRef}
          value={nome}
          onChange={(e) => onChangeNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onConfirmar()
            }
          }}
          placeholder="Ex: Máquina de Corte"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2 outline-none focus:border-blue-500"
        />
        {erro && <p className="text-red-500 text-xs font-semibold mb-4">{erro}</p>}
        <div className={`flex justify-end gap-2 ${!erro && 'mt-4'}`}>
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
