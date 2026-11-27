import { app, shell, BrowserWindow, ipcMain, dialog, screen, Menu } from 'electron'
import { join, dirname, basename, resolve, extname, sep } from 'path'
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  unlinkSync,
  renameSync,
  readdirSync,
  statSync,
  rmSync
} from 'fs'
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'
import { criarFolhaCustos, lerValoresCustos, CUSTOS_PADRAO } from './custos'
import { criarZip, inspecionarZip, extrairZip, extrairSoBD } from './zip'

let db
let dbPath
let dadosDir
let modoDados // 'portatil' | 'instalado' | 'desenvolvimento'
let somenteLeitura = false // disco protegido contra escrita: só consulta
let bdNova = false // a base de dados foi criada neste arranque

const NOME_BD = 'agrafametal.db'
const TABELAS_OBRIGATORIAS = ['config', 'empresas', 'maquinas', 'relatorios']

// Em modo só de consulta nenhuma ação que grava é aceite
function exigirEscrita() {
  if (somenteLeitura) {
    throw new Error(
      'Modo só de consulta: o disco não permite escrita, não é possível gravar alterações.'
    )
  }
}

/* ================= SENHA =================
   Protege as alterações e eliminações (criar não precisa de senha).
   - Só se guarda um hash (scrypt + sal aleatório) na tabela config, nunca a senha.
   - A senha por defeito vem aqui já em hash (não está escrita em texto simples).
   - Reset: um ficheiro REPOR_SENHA (ou REPOR_SENHA.txt) na pasta de dados faz voltar
     à senha por defeito no arranque seguinte; o ficheiro é apagado a seguir.
   - Toda a verificação é feita aqui, no processo principal: a interface não decide nada. */
const SENHA_PADRAO_HASH =
  'scrypt$189b9652b9161c0d7d83d68749f6dd69$5c1a9051c3704e810cadd907efc9de5dc02ead5da4c58bf934318efc83adb620bef8c86f99bca38ad6b84f8ddbb0243974d22a7ba2c25ef90cbd8d5fcf9c13a2'
const FICHEIROS_RESET = ['REPOR_SENHA', 'REPOR_SENHA.txt']
const MAX_TENTATIVAS = 5
const BLOQUEIO_MS = 30_000

let tentativasFalhadas = 0
let bloqueadoAte = 0
// Desbloqueios ativos: só a chapa da máquina X / o registo Y podem ser alterados
const desbloqueios = { maquina: null, relatorio: null }

function gerarHash(senha) {
  const sal = randomBytes(16).toString('hex')
  return `scrypt$${sal}$${scryptSync(String(senha), sal, 64).toString('hex')}`
}

function hashCorresponde(senha, guardado) {
  const [tipo, sal, hash] = String(guardado || '').split('$')
  if (tipo !== 'scrypt' || !sal || !hash) return false
  const esperado = Buffer.from(hash, 'hex')
  const calculado = scryptSync(String(senha ?? ''), sal, esperado.length)
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado)
}

function gravarHashSenha(hash) {
  db.prepare(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
  ).run('senha_hash', hash)
}

// 1.ª execução: senha por defeito. Ficheiro REPOR_SENHA: volta à senha por defeito.
function prepararSenha() {
  const reset = FICHEIROS_RESET.map((n) => join(dadosDir, n)).filter((f) => existsSync(f))
  if (reset.length) {
    gravarHashSenha(SENHA_PADRAO_HASH)
    reset.forEach((f) => {
      try {
        unlinkSync(f)
      } catch {
        // se não der para apagar, o reset repete-se no próximo arranque (sem perigo)
      }
    })
  } else if (!lerConfig('senha_hash')) {
    gravarHashSenha(SENHA_PADRAO_HASH)
  }
}

// Lança um erro com mensagem pronta a mostrar se a senha estiver errada
function exigirSenha(senha) {
  const agora = Date.now()
  if (agora < bloqueadoAte) {
    const s = Math.ceil((bloqueadoAte - agora) / 1000)
    throw new Error(`Demasiadas tentativas erradas. Aguarde ${s} segundos e tente outra vez.`)
  }
  // pedido sem senha nenhuma: recusa, mas não conta como tentativa errada
  if (senha == null || senha === '') throw new Error('Introduza a senha.')
  if (hashCorresponde(senha, lerConfig('senha_hash'))) {
    tentativasFalhadas = 0
    return
  }
  tentativasFalhadas++
  if (tentativasFalhadas >= MAX_TENTATIVAS) {
    tentativasFalhadas = 0
    bloqueadoAte = agora + BLOQUEIO_MS
    throw new Error('Demasiadas tentativas erradas. Aguarde 30 segundos e tente outra vez.')
  }
  throw new Error('Senha incorreta.')
}

function exigirDesbloqueio(tipo, id) {
  if (id == null || desbloqueios[tipo] !== Number(id)) {
    throw new Error('Alteração não autorizada: carregue em «Editar» e introduza a senha.')
  }
}

/* ================= DATAS ================= */
const p2 = (n) => String(n).padStart(2, '0')
// Data de hoje no fuso horário do PC (não em UTC)
function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}
function validarDataRegisto(data) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data ?? ''))
  if (!m) throw new Error('Indique a data da intervenção.')
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    throw new Error('A data da intervenção não é válida.')
  }
  if (data > hojeLocal()) throw new Error('A data da intervenção não pode ser no futuro.')
}

/* ================= LOCALIZAÇÃO DOS DADOS =================
   - Versão portátil: usa SEMPRE a pasta "dados" ao lado do programa. Nunca muda em
     silêncio para a pasta do utilizador (era isso que criava uma base de dados nova,
     vazia e com a senha por defeito, quando o disco era ligado a outro PC).
     Se a pasta não existir ou não der para escrever, pergunta o que fazer.
   - Versão instalada: se existir uma pasta "dados" ao lado do programa (e der para
     escrever lá), usa-a; senão usa %APPDATA%\Agrafametal\dados.
   Nunca se guardam letras de unidade (E:, F:...): o caminho é sempre relativo ao .exe. */

function podeEscrever(pasta) {
  // No Windows o accessSync(W_OK) não é fiável em pastas: testa escrevendo um ficheiro
  const teste = join(pasta, `.teste-escrita-${process.pid}`)
  try {
    writeFileSync(teste, 'ok')
    unlinkSync(teste)
    return true
  } catch {
    return false
  }
}

// Devolve { pasta, modo, somenteLeitura? } ou null se o utilizador escolher sair
function resolverPastaDados() {
  const pastaUtilizador = join(app.getPath('userData'), 'dados')
  if (is.dev) return { pasta: pastaUtilizador, modo: 'desenvolvimento' }

  const pastaPortatil = process.env.PORTABLE_EXECUTABLE_DIR // definido só pela versão portátil
  if (pastaPortatil) return resolverPastaPortatil(join(pastaPortatil, 'dados'))

  const pastaLocal = join(dirname(app.getPath('exe')), 'dados')
  if (existsSync(pastaLocal) && podeEscrever(pastaLocal)) {
    return { pasta: pastaLocal, modo: 'portatil' }
  }
  return { pasta: pastaUtilizador, modo: 'instalado' }
}

function caixa(opcoes) {
  return dialog.showMessageBoxSync({ title: 'Agrafametal', noLink: true, ...opcoes })
}

// Disco sem permissão de escrita: só consulta ou sair
function perguntarSoConsulta(pasta) {
  const r = caixa({
    type: 'warning',
    message: 'A pasta de dados no disco não permite escrita.',
    detail:
      `Pasta: ${pasta}\n\n` +
      'O disco pode estar protegido contra escrita (só de leitura) ou o Windows bloqueou o acesso. ' +
      'Verifique o disco e volte a abrir a aplicação.\n\n' +
      'Também pode abrir só para consulta: vê todos os dados, mas não grava nenhuma alteração.',
    buttons: ['Abrir só para consulta', 'Sair'],
    defaultId: 1,
    cancelId: 1
  })
  return r === 0 ? { pasta, modo: 'portatil', somenteLeitura: true } : null
}

function resolverPastaPortatil(pastaLocal) {
  if (existsSync(join(pastaLocal, NOME_BD))) {
    if (podeEscrever(pastaLocal)) return { pasta: pastaLocal, modo: 'portatil' }
    return perguntarSoConsulta(pastaLocal)
  }

  // Não há dados ao lado do programa: nunca cria uma base de dados nova sem perguntar
  for (;;) {
    const r = caixa({
      type: 'question',
      message: 'Não foram encontrados dados junto à aplicação.',
      detail:
        `Procurei em: ${pastaLocal}\n\n` +
        'Se já usava a Agrafametal neste disco, confirme que copiou a pasta completa ' +
        '(o programa E a pasta «dados»).\n\n' +
        '• «Criar base de dados nova aqui»: começa sem dados (só na primeira utilização).\n' +
        '• «Escolher pasta de dados…»: abre uma pasta «dados» que já existe.',
      buttons: ['Criar base de dados nova aqui', 'Escolher pasta de dados…', 'Sair'],
      defaultId: 1,
      cancelId: 2
    })
    if (r === 2) return null

    if (r === 0) {
      try {
        mkdirSync(pastaLocal, { recursive: true })
      } catch {
        // tratado a seguir
      }
      if (existsSync(pastaLocal) && podeEscrever(pastaLocal)) {
        return { pasta: pastaLocal, modo: 'portatil' }
      }
      caixa({
        type: 'error',
        message: 'Não foi possível criar a pasta de dados.',
        detail: `Pasta: ${pastaLocal}\n\nO disco pode estar protegido contra escrita.`,
        buttons: ['OK']
      })
      continue
    }

    const escolha = dialog.showOpenDialogSync({
      title: 'Escolher a pasta de dados da Agrafametal',
      properties: ['openDirectory']
    })
    if (!escolha?.length) continue
    // aceita a própria pasta "dados" ou a pasta que a contém
    const pasta = [escolha[0], join(escolha[0], 'dados')].find((p) => existsSync(join(p, NOME_BD)))
    if (!pasta) {
      caixa({
        type: 'warning',
        message: 'Essa pasta não tem dados da Agrafametal.',
        detail: `Não foi encontrado o ficheiro «${NOME_BD}» em:\n${escolha[0]}`,
        buttons: ['OK']
      })
      continue
    }
    if (podeEscrever(pasta)) return { pasta, modo: 'portatil' }
    const so = perguntarSoConsulta(pasta)
    if (so) return so
  }
}

/* ================= BASE DE DADOS ================= */

function abrirBD(caminho) {
  if (somenteLeitura) {
    // disco protegido: abre só para leitura e não toca na estrutura
    const leitura = new Database(caminho, { readonly: true, fileMustExist: true, timeout: 5000 })
    leitura.pragma('foreign_keys = ON')
    return leitura
  }
  // timeout: se o ficheiro estiver momentaneamente ocupado, espera até 5 s em vez de falhar
  const nova = new Database(caminho, { timeout: 5000 })
  // DELETE em vez de WAL: não cria ficheiros -wal/-shm ao lado da BD,
  // o que é mais seguro num disco externo que pode ser desligado.
  // Se outro programa tiver a BD aberta, a mudança não é possível agora:
  // a app continua a funcionar e tenta outra vez na próxima abertura.
  try {
    nova.pragma('journal_mode = DELETE')
  } catch (err) {
    console.warn('Não foi possível mudar o journal_mode para DELETE:', err.message)
  }
  nova.pragma('foreign_keys = ON')

  nova.exec(`
    CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT);

    CREATE TABLE IF NOT EXISTS empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        notas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maquinas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER,
        nome TEXT NOT NULL,
        marca TEXT, modelo TEXT, serial TEXT, ano_fab TEXT,
        elet_v TEXT, elet_hz TEXT, elet_kw TEXT,
        pneu_kgcm2 TEXT, hidr_kgcm2 TEXT, hidr_lh TEXT,
        estado TEXT DEFAULT 'Operacional',
        notas_tecnicas TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_maquinas_empresa ON maquinas(empresa_id);

    CREATE TABLE IF NOT EXISTS relatorios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        maquina_id INTEGER,
        data TEXT NOT NULL,
        tecnico TEXT, tipo_manutencao TEXT DEFAULT 'Preventiva',
        titulo TEXT, corpo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(maquina_id) REFERENCES maquinas(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_relatorios_maquina ON relatorios(maquina_id);

    CREATE TRIGGER IF NOT EXISTS trg_relatorios_updated
    AFTER UPDATE ON relatorios
    BEGIN
      UPDATE relatorios SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `)

  // v1.2: pasta de cada registo (caminho relativo à pasta de dados)
  const colunas = nova
    .prepare('PRAGMA table_info(relatorios)')
    .all()
    .map((c) => c.name)
  if (!colunas.includes('pasta')) nova.exec('ALTER TABLE relatorios ADD COLUMN pasta TEXT')

  // Localização da máquina (cidade e país): colunas novas, acrescentadas às bases de dados antigas
  const colunasMaquinas = nova
    .prepare('PRAGMA table_info(maquinas)')
    .all()
    .map((c) => c.name)
  if (!colunasMaquinas.includes('cidade')) nova.exec('ALTER TABLE maquinas ADD COLUMN cidade TEXT')
  if (!colunasMaquinas.includes('pais')) nova.exec('ALTER TABLE maquinas ADD COLUMN pais TEXT')

  nova
    .prepare('INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)')
    .run('cabecalho_subtitulo', 'Serviços Reparação e Manutenção Preventiva')
  return nova
}

function fecharBD() {
  if (db && db.open) db.close()
}

function initDB() {
  const escolha = resolverPastaDados()
  if (!escolha) return false // o utilizador escolheu «Sair»
  dadosDir = escolha.pasta
  modoDados = escolha.modo
  somenteLeitura = !!escolha.somenteLeitura
  try {
    if (!somenteLeitura && !existsSync(dadosDir)) mkdirSync(dadosDir, { recursive: true })
    dbPath = join(dadosDir, NOME_BD)
    bdNova = !existsSync(dbPath)
    db = abrirBD(dbPath)
    if (!somenteLeitura) {
      prepararSenha()
      prepararPastasRegistos()
    }
    return true
  } catch (err) {
    dialog.showErrorBox(
      'Erro Crítico na Base de Dados',
      'Não foi possível aceder ao ficheiro de base de dados.\n\n' +
        `Pasta: ${dadosDir}\nDetalhe: ${err.message}`
    )
    return false
  }
}

// Verifica se um ficheiro é uma base de dados da Agrafametal e devolve um resumo
function validarBD(caminho) {
  let teste
  try {
    teste = new Database(caminho, { readonly: true, fileMustExist: true })
    const tabelas = teste
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((t) => t.name)
    const emFalta = TABELAS_OBRIGATORIAS.filter((t) => !tabelas.includes(t))
    if (emFalta.length) throw new Error('não é uma cópia de segurança da Agrafametal')
    const ok = teste.pragma('quick_check', { simple: true })
    if (ok !== 'ok') throw new Error('o ficheiro está danificado')
    const contar = (t) => teste.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
    return {
      empresas: contar('empresas'),
      maquinas: contar('maquinas'),
      relatorios: contar('relatorios')
    }
  } catch (err) {
    const msg = /file is not a database|SQLITE_NOTADB/i.test(err.message)
      ? 'o ficheiro não é uma base de dados válida'
      : err.message
    throw new Error(`Ficheiro inválido: ${msg}.`)
  } finally {
    if (teste && teste.open) teste.close()
  }
}

// Ex.: 2026-10-18_14h05
function carimbo() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`
}

function pastaBackups() {
  const pasta = join(dadosDir, 'backups')
  if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true })
  return pasta
}

/* ================= PASTAS DOS REGISTOS =================
   dados/registos/<id>_<Empresa>/<ano>/<mm-Mês>/<idRegisto>_<data>_<Máquina>/
   - As 12 pastas dos meses de cada ano são criadas logo (não só quando há registos).
   - A pasta de cada registo só é criada quando é preciso (anexar ou folha de custos).
   - Na BD guarda-se só o caminho relativo (relatorios.pasta), com "/".
   - O "<id>_" no início dos nomes mantém as pastas únicas mesmo com nomes repetidos. */

const PASTA_REGISTOS = 'registos'
const PASTA_ELIMINADOS = '_eliminados'
const MESES_PASTA = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

const pastaRegistosAbs = () => join(dadosDir, PASTA_REGISTOS)
const absoluto = (relativo) => join(dadosDir, ...String(relativo).split('/'))

// Nome válido para uma pasta no Windows
function nomeSeguro(texto, max = 60) {
  let s = String(texto ?? '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ') // eslint-disable-line no-control-regex
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/g, '')
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = `_${s}`
  return s || 'sem nome'
}

const pastaEmpresaRel = (emp) => `${PASTA_REGISTOS}/${emp.id}_${nomeSeguro(emp.nome)}`
const pastaMesRel = (emp, ano, mes) =>
  `${pastaEmpresaRel(emp)}/${ano}/${p2(mes)}-${MESES_PASTA[mes - 1]}`

function garantirAnoEmpresa(emp, ano) {
  for (let mes = 1; mes <= 12; mes++) {
    mkdirSync(absoluto(pastaMesRel(emp, ano, mes)), { recursive: true })
  }
}

// Registo com os dados da máquina e da empresa
function dadosRegisto(id) {
  return db
    .prepare(
      `SELECT r.*, m.nome AS maquina_nome, m.marca, m.modelo, m.serial,
              e.id AS empresa_id, e.nome AS empresa_nome
         FROM relatorios r
         JOIN maquinas m ON m.id = r.maquina_id
         JOIN empresas e ON e.id = m.empresa_id
        WHERE r.id = ?`
    )
    .get(id)
}

function pastaRegistoEsperada(r) {
  const [ano, mes] = r.data.split('-').map(Number)
  const emp = { id: r.empresa_id, nome: r.empresa_nome }
  return `${pastaMesRel(emp, ano, mes)}/${r.id}_${r.data}_${nomeSeguro(r.maquina_nome, 40)}`
}

// Pasta atual da empresa no disco (procura pelo "<id>_", o nome pode ter mudado)
function encontrarPastaEmpresa(empresaId) {
  const base = pastaRegistosAbs()
  if (!existsSync(base)) return null
  const d = readdirSync(base, { withFileTypes: true }).find(
    (x) => x.isDirectory() && x.name.startsWith(`${empresaId}_`)
  )
  return d ? `${PASTA_REGISTOS}/${d.name}` : null
}

// Erros do Windows quando um ficheiro dentro da pasta está aberto noutro programa
function erroPastaOcupada(err) {
  return ['EPERM', 'EBUSY', 'EACCES'].includes(err?.code)
    ? 'Há ficheiros desta pasta abertos noutro programa (Excel, PDF...). Feche-os e tente outra vez.'
    : err?.message || String(err)
}

// Põe a pasta do registo no sítio certo (data, máquina ou empresa podem ter mudado)
function sincronizarPastaRegisto(id) {
  const r = dadosRegisto(id)
  if (!r?.pasta) return
  const esperada = pastaRegistoEsperada(r)
  let atual = existsSync(absoluto(r.pasta)) ? r.pasta : null
  if (!atual) {
    // a pasta da empresa foi renomeada: o resto do caminho mantém-se
    const partes = r.pasta.split('/')
    const candidata = [
      pastaEmpresaRel({ id: r.empresa_id, nome: r.empresa_nome }),
      ...partes.slice(2)
    ].join('/')
    if (existsSync(absoluto(candidata))) atual = candidata
  }
  if (!atual) {
    db.prepare('UPDATE relatorios SET pasta = NULL WHERE id = ?').run(id) // pasta desaparecida
    return
  }
  if (atual !== esperada) {
    mkdirSync(dirname(absoluto(esperada)), { recursive: true })
    renameSync(absoluto(atual), absoluto(esperada))
  }
  if (r.pasta !== esperada) {
    db.prepare('UPDATE relatorios SET pasta = ? WHERE id = ?').run(esperada, id)
  }
}

// Renomeia a pasta da empresa se o nome mudou e acerta as pastas dos registos dela
function alinharPastasEmpresa(empresaId) {
  const emp = db.prepare('SELECT id, nome FROM empresas WHERE id = ?').get(empresaId)
  if (!emp) return
  const atual = encontrarPastaEmpresa(emp.id)
  const esperada = pastaEmpresaRel(emp)
  if (atual && atual !== esperada) renameSync(absoluto(atual), absoluto(esperada))
  const ids = db
    .prepare(
      `SELECT r.id FROM relatorios r JOIN maquinas m ON m.id = r.maquina_id
        WHERE m.empresa_id = ? AND r.pasta IS NOT NULL`
    )
    .all(emp.id)
  ids.forEach(({ id }) => sincronizarPastaRegisto(id))
}

// Corre as funções de pastas sem nunca impedir a ação principal; devolve um aviso se falhar
function tentarPastas(fn) {
  try {
    fn()
    return null
  } catch (err) {
    console.warn('Pastas dos registos:', err)
    return `A informação foi guardada, mas não foi possível atualizar as pastas no disco: ${erroPastaOcupada(err)}`
  }
}

// Arranque: cria as pastas do ano atual e acerta nomes que tenham mudado
function prepararPastasRegistos() {
  try {
    mkdirSync(pastaRegistosAbs(), { recursive: true })
    const ano = new Date().getFullYear()
    for (const emp of db.prepare('SELECT id, nome FROM empresas').all()) {
      try {
        alinharPastasEmpresa(emp.id)
        garantirAnoEmpresa(emp, ano)
      } catch (err) {
        console.warn('Pastas da empresa', emp.id, err.message)
      }
    }
  } catch (err) {
    console.warn('Não foi possível preparar as pastas dos registos:', err.message)
  }
}

// Cria (se preciso) a pasta do registo e devolve o caminho absoluto
function garantirPastaRegisto(id) {
  exigirEscrita()
  sincronizarPastaRegisto(id)
  const r = dadosRegisto(id)
  if (!r) throw new Error('O registo já não existe.')
  if (r.pasta && existsSync(absoluto(r.pasta))) return absoluto(r.pasta)
  const esperada = pastaRegistoEsperada(r)
  garantirAnoEmpresa({ id: r.empresa_id, nome: r.empresa_nome }, Number(r.data.slice(0, 4)))
  mkdirSync(absoluto(esperada), { recursive: true })
  db.prepare('UPDATE relatorios SET pasta = ? WHERE id = ?').run(esperada, id)
  return absoluto(esperada)
}

// Nunca se apaga nada do disco: vai para dados/registos/_eliminados/
function moverParaEliminados(caminhoAbs) {
  if (!caminhoAbs || !existsSync(caminhoAbs)) return
  const destinoBase = join(pastaRegistosAbs(), PASTA_ELIMINADOS)
  mkdirSync(destinoBase, { recursive: true })
  let destino = join(destinoBase, `${carimbo()}_${basename(caminhoAbs)}`)
  for (let n = 2; existsSync(destino); n++) {
    destino = join(destinoBase, `${carimbo()}_${n}_${basename(caminhoAbs)}`)
  }
  try {
    renameSync(caminhoAbs, destino)
  } catch (err) {
    throw new Error(erroPastaOcupada(err))
  }
}

// "relatorio.pdf" já existe -> "relatorio (2).pdf"
function nomeLivre(pasta, nome) {
  const ext = extname(nome)
  const base = nome.slice(0, nome.length - ext.length)
  let candidato = nome
  for (let n = 2; existsSync(join(pasta, candidato)); n++) candidato = `${base} (${n})${ext}`
  return candidato
}

// O nome vem da interface: só se aceita um nome simples, dentro da pasta do registo
function ficheiroDoRegisto(id, nome) {
  const r = dadosRegisto(id)
  if (!r?.pasta) throw new Error('Este registo ainda não tem documentos.')
  if (!nome || basename(nome) !== nome || nome === '.' || nome === '..') {
    throw new Error('Nome de ficheiro inválido.')
  }
  const caminho = join(absoluto(r.pasta), nome)
  if (!existsSync(caminho)) throw new Error('O ficheiro já não existe.')
  return caminho
}

const nomeFolhaCustos = (id) => `custos_${id}.xlsx`

/* ================= ESTADO DA JANELA ================= */

function lerConfig(chave) {
  try {
    return db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave)?.valor ?? null
  } catch {
    return null
  }
}

function guardarEstadoJanela(win) {
  if (somenteLeitura || !db || !db.open || !win || win.isDestroyed()) return
  try {
    // maximizada: guarda o tamanho "normal" para quando o utilizador a restaurar
    const b = win.isMaximized() ? win.getNormalBounds() : win.getBounds()
    const estado = JSON.stringify({ ...b, maximizada: win.isMaximized() })
    db.prepare(
      'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
    ).run('janela_estado', estado)
  } catch {
    // não é crítico
  }
}

// A janela só reaparece na posição antiga se essa posição estiver visível
// num dos ecrãs atuais (outro PC ou outro monitor -> centra a janela)
function posicaoVisivel(b) {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    return (
      b.x + b.width - 120 > a.x &&
      b.x + 120 < a.x + a.width &&
      b.y >= a.y - 8 &&
      b.y + 80 < a.y + a.height
    )
  })
}

/* ================= API (IPC) ================= */

function registarAPI() {
  // --- CONFIGURAÇÕES ---
  ipcMain.handle('db:getConfig', () => {
    const rows = db.prepare('SELECT * FROM config').all()
    const configObj = {}
    rows.forEach((r) => {
      if (r.chave !== 'senha_hash') configObj[r.chave] = r.valor // o hash nunca sai daqui
    })
    return configObj
  })

  // Chaves de estado (última máquina, pastas abertas...) são livres; o cabeçalho
  // da folha precisa de senha; a senha só se muda por app:alterarSenha.
  const CONFIG_PROTEGIDA = ['cabecalho_subtitulo']
  ipcMain.handle('db:setConfig', (event, chave, valor, senha) => {
    exigirEscrita()
    if (String(chave).startsWith('senha') || String(chave).startsWith('custo_')) {
      throw new Error('Chave reservada.')
    }
    if (CONFIG_PROTEGIDA.includes(chave)) exigirSenha(senha)
    db.prepare(
      'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
    ).run(chave, valor)
    return true
  })

  // --- EMPRESAS ---
  ipcMain.handle('db:getEmpresas', () => {
    const empresas = db.prepare('SELECT * FROM empresas ORDER BY nome ASC').all()
    const stmt = db.prepare('SELECT * FROM maquinas WHERE empresa_id = ? ORDER BY nome ASC')
    for (let empresa of empresas) {
      empresa.maquinas = stmt.all(empresa.id)
    }
    return empresas
  })

  ipcMain.handle('db:addEmpresa', (event, nome) => {
    exigirEscrita()
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da empresa não pode estar vazio')
    const info = db.prepare('INSERT INTO empresas (nome) VALUES (?)').run(nomeLimpo)
    const id = Number(info.lastInsertRowid)
    // cria logo as 12 pastas dos meses do ano atual
    const aviso = tentarPastas(() =>
      garantirAnoEmpresa({ id, nome: nomeLimpo }, new Date().getFullYear())
    )
    return { id, nome: nomeLimpo, maquinas: [], aviso }
  })

  ipcMain.handle('db:updateEmpresa', (event, id, nome, senha) => {
    exigirEscrita()
    exigirSenha(senha)
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da empresa não pode estar vazio')
    db.prepare('UPDATE empresas SET nome = ? WHERE id = ?').run(nomeLimpo, id)
    // renomeia a pasta da empresa no disco (e acerta os caminhos dos registos)
    return { aviso: tentarPastas(() => alinharPastasEmpresa(id)) }
  })

  // Remove a empresa; as máquinas e os registos saem em cascata (ON DELETE CASCADE)
  // A pasta da empresa vai primeiro para _eliminados: se houver ficheiros abertos, nada é apagado
  ipcMain.handle('db:deleteEmpresa', (event, id, senha) => {
    exigirEscrita()
    exigirSenha(senha)
    const pasta = encontrarPastaEmpresa(id)
    if (pasta) moverParaEliminados(absoluto(pasta))
    db.prepare('DELETE FROM empresas WHERE id = ?').run(id)
    return true
  })

  // --- MÁQUINAS ---
  ipcMain.handle('db:addMaquina', (event, empresaId, nome) => {
    exigirEscrita()
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da máquina não pode estar vazio')
    const info = db
      .prepare('INSERT INTO maquinas (empresa_id, nome) VALUES (?, ?)')
      .run(empresaId, nomeLimpo)
    return { id: info.lastInsertRowid, empresa_id: empresaId, nome: nomeLimpo }
  })

  // Se o nome da máquina mudou, as pastas dos registos dela são renomeadas
  const sincronizarPastasMaquina = (id) =>
    tentarPastas(() => {
      db.prepare('SELECT id FROM relatorios WHERE maquina_id = ? AND pasta IS NOT NULL')
        .all(id)
        .forEach((r) => sincronizarPastaRegisto(r.id))
    })

  ipcMain.handle('db:updateMaquina', (event, id, d) => {
    exigirEscrita()
    exigirDesbloqueio('maquina', id)
    const stmt = db.prepare(`
      UPDATE maquinas SET
        nome=?, marca=?, modelo=?, serial=?, ano_fab=?,
        elet_v=?, elet_hz=?, elet_kw=?, pneu_kgcm2=?,
        hidr_kgcm2=?, hidr_lh=?, estado=?, notas_tecnicas=?
      WHERE id=?
    `)
    // Prevenção do erro "SQLite3 can only bind..." substituindo undefined por null
    stmt.run(
      d.nome ?? null,
      d.marca ?? null,
      d.modelo ?? null,
      d.serial ?? null,
      d.ano_fab ?? null,
      d.elet_v ?? null,
      d.elet_hz ?? null,
      d.elet_kw ?? null,
      d.pneu_kgcm2 ?? null,
      d.hidr_kgcm2 ?? null,
      d.hidr_lh ?? null,
      d.estado ?? null,
      d.notas_tecnicas ?? null,
      id
    )
    return { aviso: sincronizarPastasMaquina(id) }
  })

  // Atualiza um único campo da chapa (lista fechada de colunas -> sem SQL injection)
  const CAMPOS_MAQUINA = [
    'nome',
    'marca',
    'modelo',
    'serial',
    'ano_fab',
    'elet_v',
    'elet_hz',
    'elet_kw',
    'pneu_kgcm2',
    'hidr_kgcm2',
    'hidr_lh',
    'estado',
    'notas_tecnicas',
    'cidade',
    'pais'
  ]
  ipcMain.handle('db:updateCampoMaquina', (event, id, campo, valor) => {
    exigirEscrita()
    exigirDesbloqueio('maquina', id)
    if (!CAMPOS_MAQUINA.includes(campo)) throw new Error('Campo inválido: ' + campo)
    if (campo === 'nome' && !String(valor ?? '').trim()) {
      throw new Error('Nome da máquina não pode estar vazio')
    }
    db.prepare(`UPDATE maquinas SET ${campo} = ? WHERE id = ?`).run(valor ?? null, id)
    return { aviso: campo === 'nome' ? sincronizarPastasMaquina(id) : null }
  })

  ipcMain.handle('db:deleteMaquina', (event, id, senha) => {
    exigirEscrita()
    exigirSenha(senha)
    db.prepare('SELECT pasta FROM relatorios WHERE maquina_id = ? AND pasta IS NOT NULL')
      .all(id)
      .forEach((r) => moverParaEliminados(absoluto(r.pasta)))
    db.prepare('DELETE FROM maquinas WHERE id = ?').run(id)
    return true
  })

  // --- RELATÓRIOS ---
  ipcMain.handle('db:getRelatorios', (event, maquinaId) => {
    return db
      .prepare('SELECT * FROM relatorios WHERE maquina_id = ? ORDER BY data DESC, id DESC')
      .all(maquinaId)
  })

  // Registo completo (abrir a partir da vista da empresa)
  ipcMain.handle('db:getRelatorio', (event, id) =>
    db.prepare('SELECT * FROM relatorios WHERE id = ?').get(id)
  )

  // Registo novo: livre (só exige a data). Registo existente: só com desbloqueio.
  // manterAberto (botão «Aplicar»): grava e continua em edição.
  ipcMain.handle('db:saveRelatorio', (event, maquinaId, d) => {
    exigirEscrita()
    validarDataRegisto(d.data)
    const posGravar = (id) => {
      const r = dadosRegisto(id)
      const aviso = tentarPastas(() => {
        if (!r) return
        garantirAnoEmpresa({ id: r.empresa_id, nome: r.empresa_nome }, Number(r.data.slice(0, 4)))
        sincronizarPastaRegisto(id) // a data pode ter mudado de mês
      })
      return { id, aviso }
    }
    if (d.id) {
      exigirDesbloqueio('relatorio', d.id)
      db.prepare(
        `UPDATE relatorios SET data=?, tecnico=?, tipo_manutencao=?, titulo=?, corpo=? WHERE id=?`
      ).run(
        d.data ?? null,
        d.tecnico ?? null,
        d.tipo_manutencao ?? null,
        d.titulo ?? null,
        d.corpo ?? null,
        d.id
      )
      if (!d.manterAberto) desbloqueios.relatorio = null // guardado: volta a ficar protegido
      return posGravar(Number(d.id))
    } else {
      const info = db
        .prepare(
          `INSERT INTO relatorios (maquina_id, data, tecnico, tipo_manutencao, titulo, corpo) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          maquinaId,
          d.data ?? null,
          d.tecnico ?? null,
          d.tipo_manutencao ?? null,
          d.titulo ?? null,
          d.corpo ?? null
        )
      const id = Number(info.lastInsertRowid)
      // «Aplicar» num registo novo: continua aberto em edição (acabou de ser criado)
      if (d.manterAberto) desbloqueios.relatorio = id
      return posGravar(id)
    }
  })

  // A pasta do registo (documentos, folha de custos) vai para registos/_eliminados
  ipcMain.handle('db:deleteRelatorio', (event, id, senha) => {
    exigirEscrita()
    exigirSenha(senha)
    const r = db.prepare('SELECT pasta FROM relatorios WHERE id = ?').get(id)
    if (r?.pasta) moverParaEliminados(absoluto(r.pasta))
    db.prepare('DELETE FROM relatorios WHERE id = ?').run(id)
    return true
  })

  // --- VISTA DA EMPRESA: MESES ---
  // Número de registos por mês (todas as máquinas da empresa) num ano
  ipcMain.handle('db:getResumoMensal', (event, empresaId, ano) => {
    const emp = db.prepare('SELECT id, created_at FROM empresas WHERE id = ?').get(empresaId)
    if (!emp) throw new Error('A empresa já não existe.')
    const meses = Array(12).fill(0)
    db.prepare(
      `SELECT CAST(strftime('%m', r.data) AS INTEGER) AS mes, COUNT(*) AS total
         FROM relatorios r JOIN maquinas m ON m.id = r.maquina_id
        WHERE m.empresa_id = ? AND strftime('%Y', r.data) = ?
        GROUP BY mes`
    )
      .all(empresaId, String(ano))
      .forEach((l) => (meses[l.mes - 1] = l.total))
    const primeiro = db
      .prepare(
        `SELECT MIN(r.data) AS d FROM relatorios r JOIN maquinas m ON m.id = r.maquina_id
          WHERE m.empresa_id = ?`
      )
      .get(empresaId).d
    const criadaEm = String(emp.created_at || '').slice(0, 10) || hojeLocal()
    const anoMin = Math.min(
      Number(criadaEm.slice(0, 4)),
      primeiro ? Number(primeiro.slice(0, 4)) : Infinity
    )
    return { meses, criadaEm, anoMin }
  })

  ipcMain.handle('db:getRegistosMes', (event, empresaId, ano, mes) =>
    db
      .prepare(
        `SELECT r.id, r.data, r.titulo, r.tecnico, r.tipo_manutencao, r.maquina_id,
                m.nome AS maquina_nome
           FROM relatorios r JOIN maquinas m ON m.id = r.maquina_id
          WHERE m.empresa_id = ? AND substr(r.data, 1, 7) = ?
          ORDER BY r.data DESC, r.id DESC`
      )
      .all(empresaId, `${ano}-${p2(mes)}`)
  )

  // --- CÓPIAS DE SEGURANÇA (zip: base de dados + pasta registos) ---
  const ficheiroTemporario = (sufixo) =>
    join(app.getPath('temp'), `agrafametal_${process.pid}_${Date.now()}_${sufixo}`)

  // Cria um zip com os dados atuais (usado na cópia e antes de um restauro)
  async function zipDadosAtuais(destino) {
    const tmp = ficheiroTemporario('copia.db')
    try {
      await db.backup(tmp) // cópia consistente, mesmo com a BD aberta
      await criarZip({ destino, ficheiroBD: tmp, pastaRegistos: pastaRegistosAbs() })
    } finally {
      if (existsSync(tmp)) unlinkSync(tmp)
    }
  }

  const dentroDe = (caminho, pasta) => {
    const a = resolve(caminho).toLowerCase()
    const b = resolve(pasta).toLowerCase()
    return a === b || a.startsWith(b + sep)
  }

  ipcMain.handle('app:backup', async (event) => {
    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: 'Guardar Cópia de Segurança',
        defaultPath: join(
          somenteLeitura ? app.getPath('documents') : pastaBackups(),
          `Copia_Agrafametal_${carimbo()}.zip`
        ),
        filters: [{ name: 'Cópia de segurança Agrafametal', extensions: ['zip'] }]
      }
    )
    if (canceled || !filePath) return { sucesso: false }
    if (dentroDe(filePath, pastaRegistosAbs())) {
      throw new Error('Escolha outra pasta: a cópia não pode ficar dentro da pasta «registos».')
    }
    await zipDadosAtuais(filePath)
    return { sucesso: true, caminho: filePath }
  })

  // Passo 1 do restauro: escolher e validar o ficheiro (ainda não altera nada)
  // Aceita o zip (v1.2) e o .db das versões anteriores
  ipcMain.handle('app:escolherRestauro', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: 'Restaurar Cópia de Segurança',
        defaultPath: pastaBackups(),
        properties: ['openFile'],
        filters: [{ name: 'Cópia de segurança Agrafametal', extensions: ['zip', 'db'] }]
      }
    )
    if (canceled || !filePaths?.length) return { cancelado: true }
    const caminho = filePaths[0]
    if (resolve(caminho) === resolve(dbPath)) {
      throw new Error('Esse é o ficheiro de dados que já está em uso.')
    }
    if (extname(caminho).toLowerCase() === '.zip') {
      const { ficheiros } = inspecionarZip(caminho)
      const tmp = ficheiroTemporario('validar.db')
      try {
        extrairSoBD(caminho, tmp)
        return {
          cancelado: false,
          caminho,
          nome: basename(caminho),
          tipo: 'zip',
          ficheiros,
          ...validarBD(tmp)
        }
      } finally {
        if (existsSync(tmp)) unlinkSync(tmp)
      }
    }
    return { cancelado: false, caminho, nome: basename(caminho), tipo: 'db', ...validarBD(caminho) }
  })

  // Passo 2 do restauro (depois de o utilizador confirmar)
  ipcMain.handle('app:restaurar', async (event, caminho, senha) => {
    exigirEscrita()
    exigirSenha(senha)
    const eZip = extname(caminho).toLowerCase() === '.zip'
    // a senha atual mantém-se (a da cópia antiga nunca volta a valer)
    const hashAtual = lerConfig('senha_hash')

    // prepara tudo antes de mexer nos dados atuais
    const pastaTmp = join(dadosDir, '.restauro_tmp')
    const temporario = dbPath + '.restauro'
    let novaPastaRegistos = null
    if (existsSync(pastaTmp)) rmSync(pastaTmp, { recursive: true, force: true })
    if (eZip) {
      const extraido = extrairZip(caminho, pastaTmp) // no mesmo disco: depois é só mudar o nome
      validarBD(extraido.ficheiroBD)
      renameSync(extraido.ficheiroBD, temporario)
      novaPastaRegistos = extraido.pastaRegistos
    } else {
      validarBD(caminho)
      copyFileSync(caminho, temporario)
    }

    // guarda primeiro os dados atuais, para se poder voltar atrás
    const copiaAnterior = join(pastaBackups(), `Antes_do_restauro_${carimbo()}.zip`)
    await zipDadosAtuais(copiaAnterior)

    // zip: troca a pasta registos (a pasta _eliminados atual mantém-se)
    const registos = pastaRegistosAbs()
    const registosAntigos = registos + '.antes_do_restauro'
    let registosTrocados = false
    if (eZip) {
      try {
        if (existsSync(registosAntigos)) rmSync(registosAntigos, { recursive: true, force: true })
        if (existsSync(registos)) renameSync(registos, registosAntigos)
        if (existsSync(novaPastaRegistos)) renameSync(novaPastaRegistos, registos)
        else mkdirSync(registos, { recursive: true })
        registosTrocados = true
      } catch (err) {
        if (!existsSync(registos) && existsSync(registosAntigos))
          renameSync(registosAntigos, registos)
        if (existsSync(temporario)) unlinkSync(temporario)
        rmSync(pastaTmp, { recursive: true, force: true })
        throw new Error('Não foi possível restaurar: ' + erroPastaOcupada(err))
      }
    }

    fecharBD()
    try {
      for (const extra of ['-journal', '-wal', '-shm']) {
        if (existsSync(dbPath + extra)) unlinkSync(dbPath + extra)
      }
      renameSync(temporario, dbPath)
      db = abrirBD(dbPath)
      if (hashAtual) gravarHashSenha(hashAtual)
      else prepararSenha()
      desbloqueios.maquina = null
      desbloqueios.relatorio = null
    } catch (err) {
      // algo falhou: volta a pôr a pasta registos e a base de dados que estavam em uso
      if (existsSync(temporario)) unlinkSync(temporario)
      if (registosTrocados) {
        try {
          rmSync(registos, { recursive: true, force: true })
          renameSync(registosAntigos, registos)
        } catch {
          // fica tudo na cópia «Antes_do_restauro»
        }
      }
      db = abrirBD(dbPath)
      throw new Error('Não foi possível restaurar: ' + err.message)
    }

    if (registosTrocados && existsSync(registosAntigos)) {
      try {
        const eliminados = join(registosAntigos, PASTA_ELIMINADOS)
        if (existsSync(eliminados) && !existsSync(join(registos, PASTA_ELIMINADOS))) {
          renameSync(eliminados, join(registos, PASTA_ELIMINADOS))
        }
        rmSync(registosAntigos, { recursive: true, force: true })
      } catch (err) {
        console.warn('Não foi possível apagar a pasta antiga dos registos:', err.message)
      }
    }
    rmSync(pastaTmp, { recursive: true, force: true })
    prepararPastasRegistos()
    return { sucesso: true, copiaAnterior }
  })

  // --- DOCUMENTOS DE CADA REGISTO ---
  ipcMain.handle('docs:listar', (event, id) => {
    const r = dadosRegisto(id)
    if (!r) throw new Error('O registo já não existe.')
    const pasta = r.pasta && existsSync(absoluto(r.pasta)) ? absoluto(r.pasta) : null
    const ficheiros = pasta
      ? readdirSync(pasta, { withFileTypes: true })
          .filter((d) => !d.name.startsWith('~$') && !d.name.startsWith('.')) // temporários do Office
          .map((d) => {
            const st = statSync(join(pasta, d.name))
            return {
              nome: d.name,
              pasta: d.isDirectory(),
              tamanho: d.isDirectory() ? null : st.size,
              modificado: st.mtimeMs
            }
          })
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT', { numeric: true }))
      : []
    const folha = nomeFolhaCustos(id)
    return {
      temPasta: !!pasta,
      ficheiros,
      folhaCustos: ficheiros.some((f) => f.nome === folha) ? folha : null
    }
  })

  ipcMain.handle('docs:adicionar', async (event, id) => {
    exigirEscrita()
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      { title: 'Adicionar documentos ao registo', properties: ['openFile', 'multiSelections'] }
    )
    if (canceled || !filePaths?.length) return { adicionados: 0 }
    const pasta = garantirPastaRegisto(id)
    for (const origem of filePaths)
      copyFileSync(origem, join(pasta, nomeLivre(pasta, basename(origem))))
    return { adicionados: filePaths.length }
  })

  ipcMain.handle('docs:abrir', async (event, id, nome) => {
    const erro = await shell.openPath(ficheiroDoRegisto(id, nome))
    if (erro) throw new Error(`Não foi possível abrir «${nome}»: ${erro}`)
    return true
  })

  ipcMain.handle('docs:abrirPasta', async (event, id) => {
    const r = dadosRegisto(id)
    const pasta =
      r?.pasta && existsSync(absoluto(r.pasta)) ? absoluto(r.pasta) : garantirPastaRegisto(id)
    const erro = await shell.openPath(pasta)
    if (erro) throw new Error('Não foi possível abrir a pasta: ' + erro)
    return true
  })

  // Remover um documento pede a senha; o ficheiro vai para registos/_eliminados
  ipcMain.handle('docs:remover', (event, id, nome, senha) => {
    exigirEscrita()
    exigirSenha(senha)
    moverParaEliminados(ficheiroDoRegisto(id, nome))
    return true
  })

  // Cria a folha de custos (se ainda não existir) e abre-a no Excel
  ipcMain.handle('docs:folhaCustos', async (event, id) => {
    const r = dadosRegisto(id)
    if (!r) throw new Error('O registo já não existe.')
    const existente = r.pasta && join(absoluto(r.pasta), nomeFolhaCustos(id))
    let criada = false
    let usouModelo = false
    let caminho = existente && existsSync(existente) ? existente : null
    if (!caminho) {
      const pasta = garantirPastaRegisto(id)
      caminho = join(pasta, nomeFolhaCustos(id))
      const res = await criarFolhaCustos({
        destino: caminho,
        modelo: join(dadosDir, 'modelo_custos.xlsx'),
        info: {
          id,
          empresa: r.empresa_nome,
          maquina: r.maquina_nome,
          marca: r.marca,
          modelo: r.modelo,
          serial: r.serial,
          data: r.data,
          tecnico: r.tecnico,
          tipo: r.tipo_manutencao,
          titulo: r.titulo
        },
        valores: lerValoresCustos(lerConfig)
      })
      criada = true
      usouModelo = res.usouModelo
    }
    const erro = await shell.openPath(caminho)
    return {
      criada,
      usouModelo,
      aviso: erro ? `A folha foi criada, mas não foi possível abri-la: ${erro}` : null
    }
  })

  // --- CONFIGURAÇÃO DE CUSTOS (valores por defeito das folhas novas) ---
  ipcMain.handle('custos:get', () => ({
    ...lerValoresCustos(lerConfig),
    temModelo: existsSync(join(dadosDir, 'modelo_custos.xlsx'))
  }))

  ipcMain.handle('custos:set', (event, valores, senha) => {
    exigirEscrita()
    exigirSenha(senha)
    const gravar = db.prepare(
      'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor'
    )
    const limpos = {}
    for (const chave of Object.keys(CUSTOS_PADRAO)) {
      const n = Number(String(valores?.[chave] ?? '').replace(',', '.'))
      if (!Number.isFinite(n) || n < 0)
        throw new Error('Valores inválidos: use só números positivos.')
      if (chave.includes('perc') || chave === 'custo_iva') {
        if (n > 100) throw new Error('As percentagens têm de estar entre 0 e 100.')
      }
      limpos[chave] = n
    }
    db.transaction(() => {
      for (const [chave, n] of Object.entries(limpos)) gravar.run(chave, String(n))
    })()
    return true
  })

  // --- SENHA ---
  // Desbloqueia a edição de uma máquina (chapa) ou de um registo existente
  ipcMain.handle('auth:desbloquear', (event, tipo, id, senha) => {
    exigirEscrita()
    if (!(tipo in desbloqueios)) throw new Error('Tipo inválido.')
    exigirSenha(senha)
    desbloqueios[tipo] = Number(id)
    return true
  })

  ipcMain.handle('auth:bloquear', (event, tipo) => {
    if (tipo in desbloqueios) desbloqueios[tipo] = null
    return true
  })

  ipcMain.handle('auth:alterarSenha', (event, atual, nova) => {
    exigirEscrita()
    exigirSenha(atual)
    const s = String(nova ?? '')
    if (s.length < 6) throw new Error('A nova senha tem de ter pelo menos 6 caracteres.')
    gravarHashSenha(gerarHash(s))
    return true
  })

  // --- SISTEMA / IMPRESSÃO / PDF ---
  // Abre a janela de impressão do sistema (escolher impressora, cópias...)
  ipcMain.handle(
    'app:imprimir',
    (event) =>
      new Promise((resolver) => {
        event.sender.print(
          { silent: false, printBackground: true, pageSize: 'A4' },
          (sucesso, motivo) => resolver({ sucesso, motivo: motivo || '' })
        )
      })
  )

  ipcMain.handle('app:info', () => ({
    versao: app.getVersion(),
    pastaDados: dadosDir,
    ficheiro: dbPath,
    modo: modoDados,
    somenteLeitura,
    bdNova
  }))

  ipcMain.handle('app:abrirPastaDados', () => shell.openPath(dadosDir))

  ipcMain.handle('app:exportarPDF', async (event, tituloSugerido) => {
    // Remove caracteres proibidos em nomes de ficheiro no Windows (ex.: "/" num título)
    const nomeFicheiro =
      String(tituloSugerido || 'relatorio')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || 'relatorio'
    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: 'Exportar Relatório em PDF',
        defaultPath: `${nomeFicheiro}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
    )

    if (canceled || !filePath) return { sucesso: false }

    // Gera o PDF silenciosamente (as margens vêm do @page no CSS)
    const pdfBuffer = await event.sender.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true
    })
    writeFileSync(filePath, pdfBuffer)
    return { sucesso: true, caminho: filePath }
  })
}

/* ================= JANELA ================= */

function createWindow() {
  const MIN_W = 960
  const MIN_H = 640
  let estado = null
  try {
    estado = JSON.parse(lerConfig('janela_estado') || 'null')
  } catch {
    estado = null
  }

  const area = screen.getPrimaryDisplay().workAreaSize
  const largura = Math.min(Math.max(estado?.width || 1280, MIN_W), area.width)
  const altura = Math.min(Math.max(estado?.height || 800, MIN_H), area.height)
  const usarPosicao =
    estado &&
    Number.isFinite(estado.x) &&
    Number.isFinite(estado.y) &&
    posicaoVisivel({ x: estado.x, y: estado.y, width: largura, height: altura })

  const mainWindow = new BrowserWindow({
    title: 'Agrafametal',
    width: largura,
    height: altura,
    ...(usarPosicao ? { x: estado.x, y: estado.y } : { center: true }),
    minWidth: MIN_W,
    minHeight: MIN_H,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      spellcheck: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (estado?.maximizada) mainWindow.maximize()
    mainWindow.show()
  })
  mainWindow.on('close', () => guardarEstadoJanela(mainWindow))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  ativarCorretorOrtografico(mainWindow)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/* ================= CORRETOR ORTOGRÁFICO =================
   Português de Portugal. Palavras com erro ficam sublinhadas; o botão direito num campo
   de texto mostra sugestões, «Adicionar ao dicionário» (fica guardado neste computador)
   e Cortar / Copiar / Colar / Selecionar tudo. */

function ativarCorretorOrtografico(win) {
  const sessao = win.webContents.session
  try {
    sessao.setSpellCheckerLanguages(['pt-PT'])
  } catch (e) {
    console.error('Corretor ortográfico: idioma pt-PT indisponível', e)
  }

  win.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return
    const itens = []
    if (params.misspelledWord) {
      params.dictionarySuggestions
        .slice(0, 5)
        .forEach((sugestao) =>
          itens.push({ label: sugestao, click: () => win.webContents.replaceMisspelling(sugestao) })
        )
      if (itens.length === 0) itens.push({ label: 'Sem sugestões', enabled: false })
      itens.push(
        {
          label: 'Adicionar ao dicionário',
          click: () => sessao.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    }
    const f = params.editFlags
    itens.push(
      { label: 'Cortar', role: 'cut', enabled: f.canCut },
      { label: 'Copiar', role: 'copy', enabled: f.canCopy },
      { label: 'Colar', role: 'paste', enabled: f.canPaste },
      { type: 'separator' },
      { label: 'Selecionar tudo', role: 'selectAll', enabled: f.canSelectAll }
    )
    Menu.buildFromTemplate(itens).popup({ window: win })
  })
}

/* ================= ARRANQUE ================= */

// Interface em português de Portugal (ex.: calendário da data em dd/mm/aaaa em qualquer PC)
app.commandLine.appendSwitch('lang', 'pt-PT')

// Uma só instância: duas janelas a escrever na mesma base de dados não é seguro
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('pt.agrafametal.app')
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    if (!initDB()) {
      app.quit()
      return
    }
    registarAPI()
    createWindow()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

// Fecho seguro: guarda o estado da janela e fecha a base de dados
app.on('before-quit', () => {
  BrowserWindow.getAllWindows().forEach(guardarEstadoJanela)
  fecharBD()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
