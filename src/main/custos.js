/* ================= FOLHA DE CUSTOS (Excel) =================
   Cria a folha de custos de um registo de manutenção.
   - Se existir "dados/modelo_custos.xlsx", usa esse modelo e só preenche as células
     com nome definido (EMPRESA, MAQUINA, DATA, PRECO_HORA, IVA...).
   - Senão gera a folha por defeito, com fórmulas verdadeiras do Excel
     (os totais são calculados pelo Excel, não aqui).
   Os valores por defeito (preço/hora, IVA...) vêm da tabela config (chaves custo_*). */

import ExcelJS from 'exceljs'
import { existsSync } from 'fs'

// Valores por defeito quando ainda não foram configurados
export const CUSTOS_PADRAO = {
  custo_preco_hora: 25,
  custo_perc_extra: 50, // %
  custo_preco_hora_oficina: 25,
  custo_preco_hora_viagem: 15,
  custo_preco_km: 0.4,
  custo_perc_urgencia: 0, // %
  custo_iva: 23 // %
}

// Lê os valores configurados (texto na BD) e devolve números
export function lerValoresCustos(lerConfig) {
  const valores = {}
  for (const [chave, padrao] of Object.entries(CUSTOS_PADRAO)) {
    const n = Number(String(lerConfig(chave) ?? '').replace(',', '.'))
    valores[chave] = lerConfig(chave) != null && Number.isFinite(n) ? n : padrao
  }
  return valores
}

const EURO = '#,##0.00 "€";-#,##0.00 "€";"–"'
const PERC = '0%'
const COR_ENTRADA = 'FFFFF8C5' // amarelo claro: células para preencher
const COR_TITULO = 'FF244262' // brand-700
const COR_SECCAO = 'FFDCE6F0'
const LIMITE_FINO = { style: 'thin', color: { argb: 'FFB8C4D0' } }
const BORDAS = { top: LIMITE_FINO, left: LIMITE_FINO, bottom: LIMITE_FINO, right: LIMITE_FINO }

// Data "AAAA-MM-DD" -> Date (meio-dia, para não mudar de dia com o fuso horário)
function paraData(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto ?? ''))
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)) : null
}

function cabecalhoDados(info) {
  const marcaModelo = [info.marca, info.modelo].filter(Boolean).join(' / ')
  return {
    EMPRESA: info.empresa || '',
    MAQUINA: info.maquina || '',
    NUM_SERIE: info.serial || '',
    MARCA_MODELO: marcaModelo,
    DATA: paraData(info.data),
    TECNICO: info.tecnico || '',
    TIPO: info.tipo || '',
    NUM_REGISTO: info.id,
    TITULO: info.titulo || ''
  }
}

function valoresComNome(v) {
  return {
    PRECO_HORA: v.custo_preco_hora,
    PERC_EXTRA: v.custo_perc_extra / 100,
    PRECO_HORA_OFICINA: v.custo_preco_hora_oficina,
    PRECO_HORA_VIAGEM: v.custo_preco_hora_viagem,
    PRECO_KM: v.custo_preco_km,
    PERC_URGENCIA: v.custo_perc_urgencia / 100,
    IVA: v.custo_iva / 100
  }
}

/* ---------- Modelo do cliente (modelo_custos.xlsx) ---------- */

// "'Custos'!$B$3" -> { folha: 'Custos', celula: 'B3' }
function lerReferencia(ref) {
  const m = /^'?(.+?)'?!\$?([A-Z]+)\$?(\d+)/.exec(String(ref))
  return m ? { folha: m[1].replace(/''/g, "'"), celula: `${m[2]}${m[3]}` } : null
}

async function preencherModelo(caminhoModelo, destino, info, valores) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(caminhoModelo)
  const dados = { ...cabecalhoDados(info), ...valoresComNome(valores) }
  for (const [nome, valor] of Object.entries(dados)) {
    const def = wb.definedNames.getRanges(nome)
    for (const ref of def?.ranges || []) {
      const r = lerReferencia(ref)
      const folha = r && wb.getWorksheet(r.folha)
      if (folha) folha.getCell(r.celula).value = valor ?? null
    }
  }
  await wb.xlsx.writeFile(destino)
}

/* ---------- Folha por defeito ---------- */

async function gerarFolhaPadrao(destino, info, valores) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Agrafametal'
  wb.created = new Date()
  const ws = wb.addWorksheet('Custos', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }
    },
    views: [{ showGridLines: false }]
  })
  ws.columns = [
    { key: 'a', width: 17 }, // Referência
    { key: 'b', width: 42 }, // Descrição
    { key: 'c', width: 11 }, // Quantidade
    { key: 'd', width: 14 }, // Preço unitário
    { key: 'e', width: 10 }, // %
    { key: 'f', width: 16 } // Total
  ]
  const nomes = {} // nome definido -> célula
  const nomear = (nome, celula) => {
    nomes[nome] = celula
    wb.definedNames.add(`'Custos'!$${celula.replace(/(\d+)/, '$$$1')}`, nome)
  }
  const entrada = (celula, valor, formato) => {
    const c = ws.getCell(celula)
    if (valor !== undefined) c.value = valor
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_ENTRADA } }
    c.protection = { locked: false }
    c.border = BORDAS
    if (formato) c.numFmt = formato
    return c
  }
  const formula = (celula, f, formato = EURO) => {
    const c = ws.getCell(celula)
    c.value = { formula: f }
    c.numFmt = formato
    c.border = BORDAS
    return c
  }
  const rotulo = (celula, texto, negrito = false) => {
    const c = ws.getCell(celula)
    c.value = texto
    c.font = { bold: negrito, color: { argb: 'FF334155' } }
    return c
  }
  const seccao = (linha, titulo, colunas) => {
    ws.mergeCells(`A${linha}:F${linha}`)
    const c = ws.getCell(`A${linha}`)
    c.value = titulo
    c.font = { bold: true, color: { argb: COR_TITULO }, size: 12 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_SECCAO } }
    if (colunas) {
      const l = ws.getRow(linha + 1)
      colunas.forEach((t, i) => {
        const cel = l.getCell(i + 1)
        cel.value = t
        cel.font = { bold: true, size: 9, color: { argb: 'FF64748B' } }
        cel.alignment = { horizontal: i >= 2 ? 'right' : 'left' }
      })
      return linha + 2
    }
    return linha + 1
  }
  const subtotal = (linha, texto, f) => {
    ws.mergeCells(`A${linha}:E${linha}`)
    const c = ws.getCell(`A${linha}`)
    c.value = texto
    c.font = { bold: true }
    c.alignment = { horizontal: 'right' }
    const t = formula(`F${linha}`, f)
    t.font = { bold: true }
    return `F${linha}`
  }

  // Título
  ws.mergeCells('A1:F1')
  const t = ws.getCell('A1')
  t.value = 'FOLHA DE CUSTOS — AGRAFAMETAL, LDA.'
  t.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_TITULO } }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // Cabeçalho do registo (preenchido pela aplicação)
  const cab = cabecalhoDados(info)
  const linhaCab = (linha, r1, n1, r2, n2, unir = true) => {
    rotulo(`A${linha}`, r1, true)
    if (unir) ws.mergeCells(`B${linha}:C${linha}`)
    ws.getCell(`B${linha}`).value = cab[n1]
    nomear(n1, `B${linha}`)
    if (r2) {
      rotulo(`D${linha}`, r2, true)
      ws.mergeCells(`E${linha}:F${linha}`)
      ws.getCell(`E${linha}`).value = cab[n2]
      nomear(n2, `E${linha}`)
    }
  }
  linhaCab(3, 'Empresa', 'EMPRESA', 'Nº registo', 'NUM_REGISTO')
  linhaCab(4, 'Máquina', 'MAQUINA', 'Data', 'DATA')
  linhaCab(5, 'Marca / Modelo', 'MARCA_MODELO', 'Nº série', 'NUM_SERIE')
  linhaCab(6, 'Técnico', 'TECNICO', 'Tipo', 'TIPO')
  rotulo('A7', 'Título', true)
  ws.mergeCells('B7:F7')
  ws.getCell('B7').value = cab.TITULO
  nomear('TITULO', 'B7')
  ws.getCell('E4').numFmt = 'dd/mm/yyyy'
  ws.getCell('E3').alignment = { horizontal: 'left' }
  ws.getCell('E4').alignment = { horizontal: 'left' }
  // estas células ficam livres (o cliente pode corrigir o técnico, o título...)
  for (const c of ['B3', 'E3', 'B4', 'E4', 'B5', 'E5', 'B6', 'E6', 'B7']) {
    ws.getCell(c).protection = { locked: false }
  }

  const COLS = ['', 'Descrição', 'Quantidade', 'Preço unit.', '%', 'Total']
  let l = 9

  // 1. Mão de obra
  l = seccao(l, '1. Mão de obra', COLS)
  const moNormal = l
  ws.getCell(`B${l}`).value = 'Horas normais'
  entrada(`C${l}`, null, '0.0')
  entrada(`D${l}`, valores.custo_preco_hora, EURO)
  nomear('PRECO_HORA', `D${l}`)
  formula(`F${l}`, `C${l}*D${l}`)
  l++
  const moExtra = l
  ws.getCell(`B${l}`).value = 'Horas extra'
  entrada(`C${l}`, null, '0.0')
  formula(`D${l}`, `D${moNormal}`)
  entrada(`E${l}`, valores.custo_perc_extra / 100, PERC)
  nomear('PERC_EXTRA', `E${l}`)
  formula(`F${l}`, `C${l}*D${l}*(1+E${l})`)
  l++
  const totMO = subtotal(l, 'Subtotal mão de obra', `SUM(F${moNormal}:F${moExtra})`)
  l += 2

  // 2. Trabalho em oficina
  l = seccao(l, '2. Trabalho em oficina', COLS)
  const of1 = l
  ws.getCell(`B${l}`).value = 'Horas de trabalho em oficina'
  entrada(`C${l}`, null, '0.0')
  entrada(`D${l}`, valores.custo_preco_hora_oficina, EURO)
  nomear('PRECO_HORA_OFICINA', `D${l}`)
  formula(`F${l}`, `C${l}*D${l}`)
  l++
  const totOficina = subtotal(l, 'Subtotal oficina', `F${of1}`)
  l += 2

  // 3. Deslocação
  l = seccao(l, '3. Deslocação', COLS)
  const d1 = l
  ws.getCell(`B${l}`).value = 'Quilómetros (ida e volta)'
  entrada(`C${l}`, null, '0')
  entrada(`D${l}`, valores.custo_preco_km, '#,##0.00 "€"')
  nomear('PRECO_KM', `D${l}`)
  formula(`F${l}`, `C${l}*D${l}`)
  l++
  ws.getCell(`B${l}`).value = 'Tempo de viagem (horas)'
  entrada(`C${l}`, null, '0.0')
  entrada(`D${l}`, valores.custo_preco_hora_viagem, EURO)
  nomear('PRECO_HORA_VIAGEM', `D${l}`)
  formula(`F${l}`, `C${l}*D${l}`)
  l++
  ws.getCell(`B${l}`).value = 'Portagens / estacionamento'
  entrada(`F${l}`, null, EURO)
  const d3 = l
  l++
  const totDesl = subtotal(l, 'Subtotal deslocação', `SUM(F${d1}:F${d3})`)
  l += 2

  // 4. Peças e materiais (10 linhas)
  l = seccao(l, '4. Peças e materiais', [
    'Referência',
    'Descrição',
    'Qtd',
    'Preço unit.',
    '',
    'Total'
  ])
  const p1 = l
  for (let i = 0; i < 10; i++, l++) {
    entrada(`A${l}`)
    entrada(`B${l}`)
    entrada(`C${l}`, null, '0.##')
    entrada(`D${l}`, null, EURO)
    formula(`F${l}`, `C${l}*D${l}`)
  }
  const totPecas = subtotal(l, 'Subtotal peças e materiais', `SUM(F${p1}:F${l - 1})`)
  l += 2

  // 5. Outros custos (5 linhas)
  l = seccao(l, '5. Outros custos', ['', 'Descrição', '', '', '', 'Valor'])
  const o1 = l
  for (let i = 0; i < 5; i++, l++) {
    ws.mergeCells(`B${l}:E${l}`)
    entrada(`B${l}`)
    entrada(`F${l}`, null, EURO)
  }
  const totOutros = subtotal(l, 'Subtotal outros custos', `SUM(F${o1}:F${l - 1})`)
  l += 2

  // 6. Resumo
  l = seccao(l, '6. Resumo', null)
  const linhaResumo = (texto, f, negrito = false) => {
    ws.mergeCells(`A${l}:D${l}`)
    rotulo(`A${l}`, texto, negrito)
    const c = formula(`F${l}`, f)
    if (negrito) c.font = { bold: true }
    return `F${l++}`
  }
  const rMO = linhaResumo('Mão de obra', totMO)
  const rOf = linhaResumo('Trabalho em oficina', totOficina)
  linhaResumo('Deslocação', totDesl)
  linhaResumo('Peças e materiais', totPecas)
  const rOutros = linhaResumo('Outros custos', totOutros)

  // Taxa de urgência: aplica-se sobre a mão de obra (incluindo oficina) se a célula disser "Sim"
  ws.mergeCells(`A${l}:B${l}`)
  rotulo(`A${l}`, 'Taxa de urgência (aplica-se?)')
  const celSim = entrada(`C${l}`, 'Não')
  celSim.alignment = { horizontal: 'center' }
  celSim.dataValidation = {
    type: 'list',
    allowBlank: false,
    formulae: ['"Sim,Não"'],
    showErrorMessage: true,
    errorTitle: 'Valor inválido',
    error: 'Escolha Sim ou Não.'
  }
  entrada(`E${l}`, valores.custo_perc_urgencia / 100, PERC)
  nomear('PERC_URGENCIA', `E${l}`)
  formula(`F${l}`, `IF(C${l}="Sim",(${rMO}+${rOf})*E${l},0)`)
  const rUrg = `F${l++}`

  const rSub = linhaResumo('Subtotal', `SUM(${rMO}:${rOutros})+${rUrg}`, true)

  ws.mergeCells(`A${l}:D${l}`)
  rotulo(`A${l}`, 'Desconto')
  entrada(`E${l}`, 0, PERC)
  formula(`F${l}`, `-${rSub}*E${l}`)
  const rDesc = `F${l++}`

  const rBase = linhaResumo('Base tributável', `${rSub}+${rDesc}`, true)

  ws.mergeCells(`A${l}:D${l}`)
  rotulo(`A${l}`, 'IVA')
  entrada(`E${l}`, valores.custo_iva / 100, PERC)
  nomear('IVA', `E${l}`)
  formula(`F${l}`, `${rBase}*E${l}`)
  const rIva = `F${l++}`

  ws.mergeCells(`A${l}:E${l}`)
  const tt = ws.getCell(`A${l}`)
  tt.value = 'TOTAL'
  tt.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  tt.alignment = { horizontal: 'right' }
  tt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_TITULO } }
  const tv = formula(`F${l}`, `${rBase}+${rIva}`)
  tv.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  tv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_TITULO } }
  ws.getRow(l).height = 22
  l += 2

  const nota = ws.getCell(`A${l}`)
  ws.mergeCells(`A${l}:F${l}`)
  nota.value =
    'As células a amarelo são para preencher. Os totais são calculados automaticamente. ' +
    'A folha está protegida sem senha (Rever › Desproteger folha) para não apagar as fórmulas por engano.'
  nota.font = { italic: true, size: 9, color: { argb: 'FF64748B' } }
  nota.alignment = { wrapText: true }
  ws.getRow(l).height = 28

  ws.headerFooter.oddFooter = '&L&8Agrafametal, Lda.&R&8Página &P de &N'

  // Protege as fórmulas (sem senha: o cliente pode desproteger quando quiser)
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    formatRows: true
  })
  await wb.xlsx.writeFile(destino)
  return nomes
}

/* info = { id, empresa, maquina, marca, modelo, serial, data, tecnico, tipo, titulo } */
export async function criarFolhaCustos({ destino, modelo, info, valores }) {
  if (modelo && existsSync(modelo)) {
    await preencherModelo(modelo, destino, info, valores)
    return { usouModelo: true }
  }
  await gerarFolhaPadrao(destino, info, valores)
  return { usouModelo: false }
}
