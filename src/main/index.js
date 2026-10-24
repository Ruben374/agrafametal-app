import { app, shell, BrowserWindow, ipcMain, dialog, screen } from 'electron'
import { join, dirname, basename, resolve } from 'path'
import { existsSync, mkdirSync, copyFileSync, writeFileSync, unlinkSync, renameSync } from 'fs'
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'

let db
let dbPath
let dadosDir
let modoDados // 'portatil' | 'instalado' | 'desenvolvimento'

const TABELAS_OBRIGATORIAS = ['config', 'empresas', 'maquinas', 'relatorios']

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
   Mesma regra para o instalador e para a versão portátil:
   - se existir uma pasta "dados" ao lado do programa (e der para escrever lá), usa-a
     -> uma app num disco externo guarda sempre os dados no próprio disco;
   - senão usa a pasta do utilizador neste computador (%APPDATA%\Agrafametal\dados).
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

function resolverPastaDados() {
  const pastaUtilizador = join(app.getPath('userData'), 'dados')
  if (is.dev) return { pasta: pastaUtilizador, modo: 'desenvolvimento' }

  const pastaPortatil = process.env.PORTABLE_EXECUTABLE_DIR // definido só pela versão portátil
  const exeDir = pastaPortatil || dirname(app.getPath('exe'))
  const pastaLocal = join(exeDir, 'dados')

  if (pastaPortatil && !existsSync(pastaLocal)) {
    try {
      mkdirSync(pastaLocal, { recursive: true }) // 1.ª execução da versão portátil
    } catch {
      // disco só de leitura: cai para a pasta do utilizador
    }
  }

  if (existsSync(pastaLocal) && podeEscrever(pastaLocal)) {
    return { pasta: pastaLocal, modo: 'portatil' }
  }
  return { pasta: pastaUtilizador, modo: 'instalado' }
}

/* ================= BASE DE DADOS ================= */

function abrirBD(caminho) {
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

  nova
    .prepare('INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)')
    .run('cabecalho_subtitulo', 'Serviços Reparação e Manutenção Preventiva')
  return nova
}

function fecharBD() {
  if (db && db.open) db.close()
}

function initDB() {
  const { pasta, modo } = resolverPastaDados()
  dadosDir = pasta
  modoDados = modo
  try {
    if (!existsSync(dadosDir)) mkdirSync(dadosDir, { recursive: true })
    dbPath = join(dadosDir, 'agrafametal.db')
    db = abrirBD(dbPath)
    prepararSenha()
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

/* ================= ESTADO DA JANELA ================= */

function lerConfig(chave) {
  try {
    return db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave)?.valor ?? null
  } catch {
    return null
  }
}

function guardarEstadoJanela(win) {
  if (!db || !db.open || !win || win.isDestroyed()) return
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
    if (String(chave).startsWith('senha')) throw new Error('Chave reservada.')
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
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da empresa não pode estar vazio')
    const info = db.prepare('INSERT INTO empresas (nome) VALUES (?)').run(nomeLimpo)
    return { id: info.lastInsertRowid, nome: nomeLimpo, maquinas: [] }
  })

  ipcMain.handle('db:updateEmpresa', (event, id, nome, senha) => {
    exigirSenha(senha)
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da empresa não pode estar vazio')
    db.prepare('UPDATE empresas SET nome = ? WHERE id = ?').run(nomeLimpo, id)
    return true
  })

  // Remove a empresa; as máquinas e os registos saem em cascata (ON DELETE CASCADE)
  ipcMain.handle('db:deleteEmpresa', (event, id, senha) => {
    exigirSenha(senha)
    db.prepare('DELETE FROM empresas WHERE id = ?').run(id)
    return true
  })

  // --- MÁQUINAS ---
  ipcMain.handle('db:addMaquina', (event, empresaId, nome) => {
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da máquina não pode estar vazio')
    const info = db
      .prepare('INSERT INTO maquinas (empresa_id, nome) VALUES (?, ?)')
      .run(empresaId, nomeLimpo)
    return { id: info.lastInsertRowid, empresa_id: empresaId, nome: nomeLimpo }
  })

  ipcMain.handle('db:updateMaquina', (event, id, d) => {
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
    return true
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
    'notas_tecnicas'
  ]
  ipcMain.handle('db:updateCampoMaquina', (event, id, campo, valor) => {
    exigirDesbloqueio('maquina', id)
    if (!CAMPOS_MAQUINA.includes(campo)) throw new Error('Campo inválido: ' + campo)
    if (campo === 'nome' && !String(valor ?? '').trim()) {
      throw new Error('Nome da máquina não pode estar vazio')
    }
    db.prepare(`UPDATE maquinas SET ${campo} = ? WHERE id = ?`).run(valor ?? null, id)
    return true
  })

  ipcMain.handle('db:deleteMaquina', (event, id, senha) => {
    exigirSenha(senha)
    db.prepare('DELETE FROM maquinas WHERE id = ?').run(id)
    return true
  })

  // --- RELATÓRIOS ---
  ipcMain.handle('db:getRelatorios', (event, maquinaId) => {
    return db
      .prepare('SELECT * FROM relatorios WHERE maquina_id = ? ORDER BY data DESC, id DESC')
      .all(maquinaId)
  })

  // Registo novo: livre (só exige a data). Registo existente: só com desbloqueio.
  ipcMain.handle('db:saveRelatorio', (event, maquinaId, d) => {
    validarDataRegisto(d.data)
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
      desbloqueios.relatorio = null // guardado: volta a ficar protegido
      return d.id
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
      return info.lastInsertRowid
    }
  })

  ipcMain.handle('db:deleteRelatorio', (event, id, senha) => {
    exigirSenha(senha)
    db.prepare('DELETE FROM relatorios WHERE id = ?').run(id)
    return true
  })

  // --- CÓPIAS DE SEGURANÇA ---
  ipcMain.handle('app:backup', async (event) => {
    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: 'Guardar Cópia de Segurança',
        defaultPath: join(pastaBackups(), `Copia_Agrafametal_${carimbo()}.db`),
        filters: [{ name: 'Base de Dados Agrafametal', extensions: ['db'] }]
      }
    )
    if (canceled || !filePath) return { sucesso: false }
    if (resolve(filePath) === resolve(dbPath)) {
      throw new Error('Escolha outro nome: este é o ficheiro de dados em uso.')
    }
    await db.backup(filePath) // cópia consistente, mesmo com a BD aberta
    return { sucesso: true, caminho: filePath }
  })

  // Passo 1 do restauro: escolher e validar o ficheiro (ainda não altera nada)
  ipcMain.handle('app:escolherRestauro', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: 'Restaurar Cópia de Segurança',
        defaultPath: pastaBackups(),
        properties: ['openFile'],
        filters: [{ name: 'Base de Dados Agrafametal', extensions: ['db'] }]
      }
    )
    if (canceled || !filePaths?.length) return { cancelado: true }
    const caminho = filePaths[0]
    if (resolve(caminho) === resolve(dbPath)) {
      throw new Error('Esse é o ficheiro de dados que já está em uso.')
    }
    return { cancelado: false, caminho, nome: basename(caminho), ...validarBD(caminho) }
  })

  // Passo 2 do restauro (depois de o utilizador confirmar)
  ipcMain.handle('app:restaurar', async (event, caminho, senha) => {
    exigirSenha(senha)
    validarBD(caminho)
    // a senha atual mantém-se (a da cópia antiga nunca volta a valer)
    const hashAtual = lerConfig('senha_hash')
    // guarda primeiro os dados atuais, para se poder voltar atrás
    const copiaAnterior = join(pastaBackups(), `Antes_do_restauro_${carimbo()}.db`)
    await db.backup(copiaAnterior)

    const temporario = dbPath + '.restauro'
    copyFileSync(caminho, temporario)
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
      // algo falhou: reabre a base de dados que estava em uso
      if (existsSync(temporario)) unlinkSync(temporario)
      db = abrirBD(dbPath)
      throw new Error('Não foi possível restaurar: ' + err.message)
    }
    return { sucesso: true, copiaAnterior }
  })

  // --- SENHA ---
  // Desbloqueia a edição de uma máquina (chapa) ou de um registo existente
  ipcMain.handle('auth:desbloquear', (event, tipo, id, senha) => {
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
    modo: modoDados
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
      contextIsolation: true
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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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
