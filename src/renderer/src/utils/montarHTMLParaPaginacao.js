// src/renderer/src/utils/montarHTMLParaPaginacao.js

export function montarHTMLParaPaginacao({ relatorio, configSubtitulo, corpoHTML }) {
  const dataFormatada = relatorio.data.split('-').reverse().join('-')

  return `
    <!-- 1. DECLARAR CABEÇALHO PRIMEIRO -->
    <div class="pagedjs-cabecalho">
      <div class="cabecalho-topo">
        <h1>Agrafametal, Lda.</h1>
        <p class="cabecalho-subtitulo">
          NIF 514 304 197 — ${escapeHTML(configSubtitulo)}
        </p>
        <h2 class="cabecalho-titulo">${escapeHTML(relatorio.titulo)}</h2>
        <p class="cabecalho-data">Data: ${dataFormatada}</p>
      </div>
    </div>

    <!-- 2. DECLARAR RODAPÉ LOGO A SEGUIR (Antes do conteúdo!) -->
    <div class="pagedjs-rodape">
      <div class="rodape-moradas">
        <div class="rodape-coluna">
          <p class="rodape-label">Morada:</p>
          <p>Rua Novos Mares, 28</p>
          <p>3830-660 Gafanha da Nazaré</p>
          <p>Telm - 962 303 861 - 935 990 243</p>
        </div>
        <div class="rodape-coluna rodape-coluna-direita">
          <p class="rodape-label">Oficina:</p>
          <p>Travessa D. Duarte, 4</p>
          <p>3830 - 743 Gafanha da Nazaré</p>
        </div>
      </div>
      <p class="rodape-legal">
        Todas as Máquinas, independentemente do tipo ou fabricante, têm peças de desgaste
        que é necessário substituir regularmente, para manter um bom nível de fiabilidade e
        eficiência energética do equipamento, minimizando assim os custos de manutenção.
      </p>
    </div>

    <!-- 3. SÓ AGORA VEM O CORPO DO RELATÓRIO -->
    <div class="corpo-relatorio">
      ${corpoHTML}
    </div>
  `
}

function escapeHTML(texto) {
  const div = document.createElement('div')
  div.textContent = texto ?? ''
  return div.innerHTML
}
