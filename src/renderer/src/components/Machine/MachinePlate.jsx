import { PlateField, PlateInlineField } from './PlateField'

export default function MachinePlate({ maquina, onSave }) {
  return (
    <div
      key={maquina.id}
      className="bg-gradient-to-br from-slate-700 to-slate-900 text-slate-200 border-2 border-slate-500 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] rounded-lg p-6 mb-8 relative"
    >
      {/* Parafusos simulados */}
      <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>
      <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>
      <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>
      <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>

      <h3 className="text-center font-bold tracking-[0.2em] text-gray-300 mb-6 border-b border-gray-600 pb-2">
        CARACTERÍSTICAS TÉCNICAS
      </h3>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <PlateField label="MARCA" valor={maquina.marca} campo="marca" onSave={onSave} />
        <PlateField label="MODELO" valor={maquina.modelo} campo="modelo" onSave={onSave} />
        <PlateField label="Nº SÉRIE" valor={maquina.serial} campo="serial" onSave={onSave} />
        <PlateField label="ANO FAB." valor={maquina.ano_fab} campo="ano_fab" onSave={onSave} />
      </div>

      <h3 className="text-center font-bold tracking-[0.2em] text-gray-300 mt-6 mb-6 border-b border-gray-600 pb-2">
        CARACTERÍSTICAS DE ALIMENTAÇÃO
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
        <div className="flex flex-col">
          <label className="block text-xs font-bold text-gray-400 mb-2">Elétricas</label>
          <div className="flex items-center gap-2 flex-wrap">
            <PlateInlineField valor={maquina.elet_v} campo="elet_v" onSave={onSave} unidade="V" />
            <PlateInlineField
              valor={maquina.elet_hz}
              campo="elet_hz"
              onSave={onSave}
              unidade="Hz"
            />
            <PlateInlineField
              valor={maquina.elet_kw}
              campo="elet_kw"
              onSave={onSave}
              unidade="kW"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="block text-xs font-bold text-gray-400 mb-2">Pneumáticas (Ar)</label>
          <PlateInlineField
            valor={maquina.pneu_kgcm2}
            campo="pneu_kgcm2"
            onSave={onSave}
            unidade="Kg/cm²"
            largura="min-w-[60px]"
          />
        </div>

        <div className="flex flex-col">
          <label className="block text-xs font-bold text-gray-400 mb-2">Hidráulicas (Água)</label>
          <div className="flex items-center gap-2 flex-wrap">
            <PlateInlineField
              valor={maquina.hidr_kgcm2}
              campo="hidr_kgcm2"
              onSave={onSave}
              unidade="Kg/cm²"
              largura="min-w-[60px]"
            />
            <PlateInlineField
              valor={maquina.hidr_lh}
              campo="hidr_lh"
              onSave={onSave}
              unidade="l/h"
              largura="min-w-[60px]"
            />
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-6 text-center italic opacity-70">
        Clique nos visores escuros para editar os valores da máquina.
      </p>
    </div>
  )
}
