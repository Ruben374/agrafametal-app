import A4Document from './A4Document'

export default function A4EditorModal({
  relatorioAtual,
  configSubtitulo,
  editorRef,
  tituloRef,
  previewContainerRef,
  isExportando,
  onVoltar,
  onExportarPDF,
  onGuardar,
  onSaveSubtitulo,
  applyCmd,
  inserirSimbolo,
  handleEditorKeyDown
}) {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-[80] overflow-y-auto pb-10 print:static print:inset-auto print:bg-transparent print:overflow-visible print:p-0">

      <div className="fixed top-0 left-0 right-0 bg-gray-800 text-white p-3 flex justify-between items-center shadow-lg z-[90] print:hidden">
        <div>
          <button
            onClick={onVoltar}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm mr-4 transition"
          >
            <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
          </button>
          <span className="text-sm text-gray-300 font-semibold">
            {relatorioAtual.id ? 'Editar Registo Existente' : 'Novo Registo'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExportarPDF}
            disabled={isExportando}
            className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-bold shadow transition disabled:opacity-60"
          >
            <i className="fa-solid fa-file-pdf mr-2"></i>
            {isExportando ? 'A gerar PDF...' : 'Exportar PDF'}
          </button>
          <button
            onClick={onGuardar}
            className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded text-sm font-bold shadow transition"
          >
            <i className="fa-solid fa-floppy-disk mr-2"></i>Guardar
          </button>
        </div>
      </div>

      <div className="print:hidden">
        <A4Document
          relatorioAtual={relatorioAtual}
          configSubtitulo={configSubtitulo}
          editorRef={editorRef}
          tituloRef={tituloRef}
          onSaveSubtitulo={onSaveSubtitulo}
          applyCmd={applyCmd}
          inserirSimbolo={inserirSimbolo}
          handleEditorKeyDown={handleEditorKeyDown}
          visivel={true}
        />
      </div>

      <div ref={previewContainerRef} className="pagedjs-print-root print:block" />
    </div>
  )
}
