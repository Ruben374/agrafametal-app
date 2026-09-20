export default function ReportListItem({ relatorio, onAbrir, onApagar }) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 p-2 rounded transition group/file">
      <div className="flex items-center cursor-pointer flex-1 min-w-0" onClick={onAbrir}>
        <i className="fa-solid fa-file-pdf text-red-500 mr-2"></i>
        <span className="truncate">
          Relatório {relatorio.data.split('-').reverse().join('-')} - {relatorio.titulo}
        </span>
      </div>
      <button
        onClick={onApagar}
        className="opacity-0 group-hover/file:opacity-100 text-gray-400 hover:text-red-600 px-2 transition"
        title="Eliminar"
      >
        <i className="fa-solid fa-trash text-xs"></i>
      </button>
    </div>
  )
}
