export default function MaquinaItem({ maquina, isAtiva, onSelecionar }) {
  return (
    <div
      onClick={onSelecionar}
      className={`flex items-center p-2 rounded cursor-pointer text-xs transition ${
        isAtiva
          ? 'bg-blue-100 text-blue-800 font-semibold'
          : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
      }`}
    >
      <i
        className={`fa-solid fa-gear ${isAtiva ? 'text-blue-600' : 'text-gray-400'} mr-2 w-4 text-center`}
      ></i>
      {maquina.nome}
    </div>
  )
}
