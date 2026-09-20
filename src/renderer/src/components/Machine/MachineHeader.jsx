export default function MachineHeader({ activeMachine, activeCompany, onDeleteMaquina }) {
  return (
    <header className="h-16 border-b border-gray-200 flex items-center px-6 justify-between bg-white shrink-0 print:hidden">
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          {activeMachine ? activeMachine.nome : 'Nenhuma Máquina Selecionada'}
        </h2>
        <p className="text-xs text-gray-500">
          {activeCompany
            ? `Cliente: ${activeCompany.nome}`
            : 'Selecione uma máquina no menu à esquerda'}
        </p>
      </div>
      {activeMachine && (
        <button
          onClick={onDeleteMaquina}
          className="text-xs text-red-500 hover:text-red-700 font-semibold transition"
        >
          <i className="fa-solid fa-trash mr-1"></i>Remover máquina
        </button>
      )}
    </header>
  )
}
