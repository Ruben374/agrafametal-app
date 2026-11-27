/* ================= CÓPIAS DE SEGURANÇA EM ZIP =================
   Conteúdo do zip:
     agrafametal.db      (cópia consistente da base de dados)
     registos/...        (pastas dos registos: documentos e folhas de custos)
   A pasta registos/_eliminados não entra na cópia. */

import archiver from 'archiver'
import AdmZip from 'adm-zip'
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname, resolve, sep } from 'path'

export const NOME_BD_ZIP = 'agrafametal.db'

// Cria o zip. ficheiroBD = cópia temporária da BD (feita com db.backup)
export function criarZip({ destino, ficheiroBD, pastaRegistos }) {
  return new Promise((resolver, rejeitar) => {
    const saida = createWriteStream(destino)
    const arquivo = archiver('zip', { zlib: { level: 6 } })
    saida.on('close', () => resolver({ bytes: arquivo.pointer() }))
    saida.on('error', rejeitar)
    arquivo.on('error', rejeitar)
    arquivo.on('warning', (err) => {
      if (err.code !== 'ENOENT') rejeitar(err)
    })
    arquivo.pipe(saida)
    arquivo.file(ficheiroBD, { name: NOME_BD_ZIP })
    if (pastaRegistos && existsSync(pastaRegistos)) {
      // inclui as pastas vazias (meses sem registos) e todos os ficheiros
      arquivo.glob(
        '**/*',
        {
          cwd: pastaRegistos,
          dot: false,
          ignore: ['_eliminados', '_eliminados/**']
        },
        { prefix: 'registos' }
      )
    }
    arquivo.finalize()
  })
}

// Verifica o zip sem extrair nada: tem de ter a BD e só caminhos seguros
export function inspecionarZip(caminho) {
  let zip
  try {
    zip = new AdmZip(caminho)
  } catch {
    throw new Error('Ficheiro inválido: o ficheiro zip está danificado.')
  }
  const entradas = zip.getEntries()
  if (!entradas.some((e) => e.entryName === NOME_BD_ZIP)) {
    throw new Error('Ficheiro inválido: não é uma cópia de segurança da Agrafametal.')
  }
  const ficheiros = entradas.filter(
    (e) => !e.isDirectory && e.entryName.startsWith('registos/')
  ).length
  return { zip, entradas, ficheiros }
}

// Extrai a BD e a pasta registos para "destino" (que deve estar no mesmo disco que os dados)
export function extrairZip(caminho, destino) {
  const { entradas } = inspecionarZip(caminho)
  const base = resolve(destino)
  mkdirSync(base, { recursive: true })
  for (const e of entradas) {
    const nome = e.entryName.replace(/\\/g, '/')
    if (nome !== NOME_BD_ZIP && !nome.startsWith('registos/')) continue // ignora o resto
    const alvo = resolve(base, nome)
    // proteção contra caminhos do tipo "../../" dentro do zip
    if (alvo !== base && !alvo.startsWith(base + sep)) continue
    if (e.isDirectory) {
      mkdirSync(alvo, { recursive: true })
    } else {
      mkdirSync(dirname(alvo), { recursive: true })
      writeFileSync(alvo, e.getData())
    }
  }
  return {
    ficheiroBD: join(base, NOME_BD_ZIP),
    pastaRegistos: join(base, 'registos')
  }
}

// Extrai só a BD para um ficheiro (usado para validar antes de restaurar)
export function extrairSoBD(caminho, destinoFicheiro) {
  const { zip } = inspecionarZip(caminho)
  const entrada = zip.getEntry(NOME_BD_ZIP)
  writeFileSync(destinoFicheiro, entrada.getData())
  return destinoFicheiro
}
