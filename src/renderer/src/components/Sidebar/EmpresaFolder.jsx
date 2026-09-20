import MaquinaItem from './MaquinaItem'

export default function EmpresaFolder({
  empresa,
  isOpen,
  activeMachineId,
  onToggle,
  onAddMaquina,
  onSelecionarMaquina,
  onDeleteEmpresa
}) {
  return (
    <div className="mb-1">
      <div
        className="flex items-center justify-between p-2 hover:bg-gray-200 rounded cursor-pointer text-sm font-semibold text-gray-700 transition group"
        onClick={onToggle}
      >
        <div className="flex items-center flex-1 min-w-0">
          <i
            className={`fa-solid fa-chevron-down tree-caret text-[10px] text-gray-400 mr-2 ${!isOpen ? 'collapsed' : ''}`}
          ></i>
          <i className="fa-solid fa-building text-gray-400 mr-2 w-4 text-center"></i>
          <span className="truncate">{empresa.nome}</span>
        </div>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition">
          <button
            title="Adicionar máquina"
            onClick={(e) => {
              e.stopPropagation()
              onAddMaquina()
            }}
            className="text-blue-500 hover:text-blue-700 px-1"
          >
            <i className="fa-solid fa-plus text-xs"></i>
          </button>
          <button
            title="Eliminar empresa"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteEmpresa()
            }}
            className="text-gray-400 hover:text-red-600 px-1"
          >
            <i className="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="pl-6 mt-1 space-y-1">
          {empresa.maquinas.length === 0 ? (
            <div className="text-[11px] text-gray-400 italic px-2 py-1">
              Sem máquinas registadas
            </div>
          ) : (
            empresa.maquinas.map((maquina) => (
              <MaquinaItem
                key={maquina.id}
                maquina={maquina}
                isAtiva={maquina.id === activeMachineId}
                onSelecionar={() => onSelecionarMaquina(empresa.id, maquina.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
