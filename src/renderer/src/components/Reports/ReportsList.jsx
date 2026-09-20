import { MESES } from '../../constants/meses'
import ReportListItem from './ReportListItem'

function agruparPorAnoMes(relatorios) {
  return relatorios.reduce((acc, rep) => {
    const [ano, mesNum] = rep.data.split('-')
    const mesNome = MESES[parseInt(mesNum, 10) - 1]
    if (!acc[ano]) acc[ano] = {}
    if (!acc[ano][mesNome]) acc[ano][mesNome] = []
    acc[ano][mesNome].push(rep)
    return acc
  }, {})
}

export default function ReportsList({ relatorios, onAbrirRelatorio, onApagarRelatorio }) {
  if (relatorios.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 bg-gray-50 rounded border border-dashed border-gray-200">
        <i className="fa-solid fa-file-signature text-3xl mb-3 opacity-50"></i>
        <p className="text-sm">Ainda não existem registos de manutenção para esta máquina.</p>
      </div>
    )
  }

  const agrupado = agruparPorAnoMes(relatorios)

  return (
    <div className="space-y-2">
      {Object.entries(agrupado)
        .sort(([anoA], [anoB]) => anoB - anoA)
        .map(([ano, meses]) => (
          <details key={ano} className="group" open>
            <summary className="flex items-center text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 p-2 rounded list-none [&::-webkit-details-marker]:hidden">
              <i className="fa-solid fa-chevron-right transition-transform group-open:rotate-90 w-4 text-gray-400 text-[11px] text-center mr-1"></i>
              <i className="fa-solid fa-folder text-blue-400 mr-2"></i> {ano}
            </summary>
            <div className="pl-6 border-l border-gray-200 ml-2 mt-1 space-y-1 mb-2">
              {Object.entries(meses)
                .sort(([mesA], [mesB]) => MESES.indexOf(mesB) - MESES.indexOf(mesA))
                .map(([mes, listaRels]) => (
                  <details key={mes} className="group/mes" open>
                    <summary className="flex items-center text-gray-700 cursor-pointer hover:bg-gray-100 p-2 rounded list-none [&::-webkit-details-marker]:hidden">
                      <i className="fa-solid fa-chevron-right transition-transform group-open/mes:rotate-90 w-4 text-gray-400 text-[11px] text-center mr-1"></i>
                      <i className="fa-solid fa-folder text-yellow-500 mr-2"></i> {mes}
                    </summary>
                    <div className="pl-6 border-l border-gray-200 ml-2 mt-1 space-y-1">
                      {listaRels.map((rel) => (
                        <ReportListItem
                          key={rel.id}
                          relatorio={rel}
                          onAbrir={() => onAbrirRelatorio(rel)}
                          onApagar={() => onApagarRelatorio(rel.id)}
                        />
                      ))}
                    </div>
                  </details>
                ))}
            </div>
          </details>
        ))}
    </div>
  )
}
