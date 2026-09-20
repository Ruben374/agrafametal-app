import EmpresaFolder from './EmpresaFolder'

export default function Sidebar({
  empresas,
  openFolders,
  activeMachineId,
  onToggleFolder,
  onAddMaquina,
  onSelecionarMaquina,
  onAddEmpresa,
  onDeleteEmpresa
}) {
  return (
    <aside className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col h-full shadow-sm z-10 shrink-0 print:hidden">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-bold text-blue-900 tracking-tight">Agrafametal, Lda.</h1>
        <p className="text-[10px] text-gray-500 uppercase font-semibold mt-1">
          Gestão de Equipamentos
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {empresas.map((empresa) => (
          <EmpresaFolder
            key={empresa.id}
            empresa={empresa}
            isOpen={openFolders[empresa.id]}
            activeMachineId={activeMachineId}
            onToggle={() => onToggleFolder(empresa.id)}
            onAddMaquina={() => onAddMaquina(empresa.id)}
            onSelecionarMaquina={onSelecionarMaquina}
            onDeleteEmpresa={() => onDeleteEmpresa(empresa.id, empresa.nome)}
          />
        ))}
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-100">
        <button
          onClick={onAddEmpresa}
          className="w-full py-2 bg-white border border-gray-300 text-sm font-semibold text-gray-700 rounded shadow-sm hover:bg-gray-50 transition"
        >
          <i className="fa-solid fa-folder-plus mr-2 text-blue-600"></i> Adicionar Empresa
        </button>
      </div>
    </aside>
  )
}
