import A4Toolbar from './A4Toolbar'

export default function A4Document({
  relatorioAtual,
  configSubtitulo,
  editorRef,
  tituloRef,
  onSaveSubtitulo,
  applyCmd,
  inserirSimbolo,
  handleEditorKeyDown,
  visivel
}) {
  return (
    <div
      className={`w-[210mm] min-h-[297mm] bg-white shadow-2xl mx-auto mt-20 flex flex-col p-[20mm] relative ${
        !visivel ? 'hidden' : ''
      }`}
    >
      <div className="text-center mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Agrafametal, Lda.</h1>
        <div className="bg-blue-50 border-t border-b border-blue-200 py-1 mb-6 group cursor-text">
          <p className="text-[11px] font-semibold text-gray-600 tracking-wide">
            <span>NIF 514 304 197 — </span>
            <span
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => onSaveSubtitulo(e.currentTarget.textContent)}
              className="inline-block min-w-[4rem] outline-none hover:bg-blue-100 focus:bg-white px-1"
            >
              {configSubtitulo}
            </span>
          </p>
        </div>
        <input
          ref={tituloRef}
          defaultValue={relatorioAtual.titulo}
          type="text"
          className="w-full text-center text-lg font-bold text-blue-900 uppercase bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-blue-500 pb-1"
          placeholder="TÍTULO DA INTERVENÇÃO"
        />
        <p className="text-[10px] text-gray-400 mt-2">
          Data: {relatorioAtual.data.split('-').reverse().join('-')}
        </p>
      </div>

      <A4Toolbar applyCmd={applyCmd} inserirSimbolo={inserirSimbolo} />

      <div className="border border-t-0 border-gray-200 flex-grow relative mt-0">
        <div
          ref={editorRef}
          className="absolute inset-0 p-4 text-[13px] leading-relaxed text-gray-800 outline-none overflow-y-auto [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ol]:list-decimal"
          contentEditable
          suppressContentEditableWarning
          onKeyDown={handleEditorKeyDown}
        ></div>
      </div>

      <div className="mt-auto pt-4 border-t-2 border-gray-800">
        <div className="flex justify-between text-[10px] font-bold text-gray-800 mb-4">
          <div className="w-1/2">
            <p className="italic mb-1 text-[11px] text-gray-500">Morada:</p>
            <p>Rua Novos Mares, 28</p>
            <p>3830-660 Gafanha da Nazaré</p>
            <p>Telm - 962 303 861 - 935 990 243</p>
          </div>
          <div className="w-1/2 text-right">
            <p className="italic mb-1 text-[11px] text-gray-500">Oficina:</p>
            <p>Travessa D. Duarte, 4</p>
            <p>3830 - 743 Gafanha da Nazaré</p>
          </div>
        </div>
        <p className="text-[8px] text-justify text-gray-500 leading-tight">
          Todas as Máquinas, independentemente do tipo ou fabricante, têm peças de desgaste que é
          necessário substituir regularmente, para manter um bom nível de fiabilidade e eficiência
          energética do equipamento, minimizando assim os custos de manutenção.
        </p>
      </div>
    </div>
  )
}
