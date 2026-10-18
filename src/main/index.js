import { app, shell, BrowserWindow, ipcMain, dialog, screen } from 'electron'
import { join, dirname, basename, resolve } from 'path'
import { existsSync, mkdirSync, copyFileSync, writeFileSync, unlinkSync, renameSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'

let db
let dbPath
let dadosDir
let modoDados // 'portatil' | 'instalado' | 'desenvolvimento'

const TABELAS_OBRIGATORIAS = ['config', 'empresas', 'maquinas', 'relatorios']

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
  const nova = new Database(caminho)
  // DELETE em vez de WAL: não cria ficheiros -wal/-shm ao lado da BD,
  // o que é mais seguro num disco externo que pode ser desligado.
  nova.pragma('journal_mode = DELETE')
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
      configObj[r.chave] = r.valor
    })
    return configObj
  })

  ipcMain.handle('db:setConfig', (event, chave, valor) => {
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

  ipcMain.handle('db:updateEmpresa', (event, id, nome) => {
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da empresa não pode estar vazio')
    db.prepare('UPDATE empresas SET nome = ? WHERE id = ?').run(nomeLimpo, id)
    return true
  })

  // Remove a empresa; as máquinas e os registos saem em cascata (ON DELETE CASCADE)
  ipcMain.handle('db:deleteEmpresa', (event, id) => {
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
    if (!CAMPOS_MAQUINA.includes(campo)) throw new Error('Campo inválido: ' + campo)
    if (campo === 'nome' && !String(valor ?? '').trim()) {
      throw new Error('Nome da máquina não pode estar vazio')
    }
    db.prepare(`UPDATE maquinas SET ${campo} = ? WHERE id = ?`).run(valor ?? null, id)
    return true
  })

  ipcMain.handle('db:deleteMaquina', (event, id) => {
    db.prepare('DELETE FROM maquinas WHERE id = ?').run(id)
    return true
  })

  // --- RELATÓRIOS ---
  ipcMain.handle('db:getRelatorios', (event, maquinaId) => {
    return db
      .prepare('SELECT * FROM relatorios WHERE maquina_id = ? ORDER BY data DESC, id DESC')
      .all(maquinaId)
  })

  ipcMain.handle('db:saveRelatorio', (event, maquinaId, d) => {
    if (d.id) {
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

  ipcMain.handle('db:deleteRelatorio', (event, id) => {
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
  ipcMain.handle('app:restaurar', async (event, caminho) => {
    validarBD(caminho)
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
    } catch (err) {
      // algo falhou: reabre a base de dados que estava em uso
      if (existsSync(temporario)) unlinkSync(temporario)
      db = abrirBD(dbPath)
      throw new Error('Não foi possível restaurar: ' + err.message)
    }
    return { sucesso: true, copiaAnterior }
  })

  // --- SISTEMA / PDF ---
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
    backgroundColor: '#f5f7fa',
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
