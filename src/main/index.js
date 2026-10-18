import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Database from 'better-sqlite3'

let db
let dbPath

function initDB() {
  const isPortable = process.env.PORTABLE_EXECUTABLE_DIR !== undefined
  const basePath = isPortable ? process.env.PORTABLE_EXECUTABLE_DIR : app.getPath('userData')

  const dadosDir = join(basePath, 'dados')
  if (!existsSync(dadosDir)) {
    mkdirSync(dadosDir, { recursive: true })
  }
  dbPath = join(dadosDir, 'agrafametal.db')

  try {
    db = new Database(dbPath)

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    db.exec(`
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

    const insertConfig = db.prepare('INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)')
    insertConfig.run('cabecalho_subtitulo', 'Serviços Reparação e Manutenção Preventiva')
  } catch (err) {
    dialog.showErrorBox(
      'Erro Crítico na Base de Dados',
      'Não foi possível aceder ao ficheiro de base de dados.\n\nDetalhe: ' + err.message
    )
    app.quit()
  }
}

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
    for (let empresa of empresas) {
      empresa.maquinas = db
        .prepare('SELECT * FROM maquinas WHERE empresa_id = ? ORDER BY nome ASC')
        .all(empresa.id)
    }
    return empresas
  })

  ipcMain.handle('db:addEmpresa', (event, nome) => {
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da empresa não pode estar vazio')
    const info = db.prepare('INSERT INTO empresas (nome) VALUES (?)').run(nomeLimpo)
    return { id: info.lastInsertRowid, nome: nomeLimpo, maquinas: [] }
  })

  // NOVA: Atualizar Empresa
  ipcMain.handle('db:updateEmpresa', (event, id, nome) => {
    const nomeLimpo = String(nome ?? '').trim()
    if (!nomeLimpo) throw new Error('Nome da empresa não pode estar vazio')
    db.prepare('UPDATE empresas SET nome = ? WHERE id = ?').run(nomeLimpo, id)
    return true
  })

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

  // --- SISTEMA / PDF / BACKUP ---
  ipcMain.handle('app:backup', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar Cópia de Segurança',
      defaultPath: `Backup_Agrafametal_${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Base de Dados SQLite', extensions: ['db'] }]
    })

    if (!canceled && filePath) {
      copyFileSync(dbPath, filePath) // Mantido como estava, conforme pediste
      return { sucesso: true, caminho: filePath }
    }
    return { sucesso: false }
  })

  // NOVA: Exportação Nativa para PDF
  ipcMain.handle('app:exportarPDF', async (event, tituloSugerido) => {
    // Remove caracteres proibidos em nomes de ficheiro no Windows (ex.: "/" num título)
    const nomeFicheiro =
      String(tituloSugerido || 'relatorio')
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || 'relatorio'
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Relatório em PDF',
      defaultPath: `${nomeFicheiro}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) return { sucesso: false }

    // Gera o PDF silenciosamente
    const pdfBuffer = await event.sender.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true
      // A linha "margins: {...}" foi apagada para deixar o @page do CSS atuar
    })
    writeFileSync(filePath, pdfBuffer)
    return { sucesso: true, caminho: filePath }
  })
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800, // abaixo disto a folha A4 e a chapa deixam de caber
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.agrafametal.app')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDB()
  registarAPI()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// NOVO: Fecho seguro da Base de Dados
app.on('before-quit', () => {
  if (db) {
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
