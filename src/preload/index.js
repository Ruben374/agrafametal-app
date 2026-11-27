import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Config
  getConfig: () => ipcRenderer.invoke('db:getConfig'),
  setConfig: (chave, valor, senha) => ipcRenderer.invoke('db:setConfig', chave, valor, senha),

  // Empresas
  getEmpresas: () => ipcRenderer.invoke('db:getEmpresas'),
  addEmpresa: (nome) => ipcRenderer.invoke('db:addEmpresa', nome),
  updateEmpresa: (id, nome, senha) => ipcRenderer.invoke('db:updateEmpresa', id, nome, senha),
  deleteEmpresa: (id, senha) => ipcRenderer.invoke('db:deleteEmpresa', id, senha),

  // Máquinas
  addMaquina: (empresaId, nome) => ipcRenderer.invoke('db:addMaquina', empresaId, nome),
  updateMaquina: (id, dados) => ipcRenderer.invoke('db:updateMaquina', id, dados),
  updateCampoMaquina: (id, campo, valor) =>
    ipcRenderer.invoke('db:updateCampoMaquina', id, campo, valor),
  deleteMaquina: (id, senha) => ipcRenderer.invoke('db:deleteMaquina', id, senha),

  // Relatórios
  getRelatorios: (maquinaId) => ipcRenderer.invoke('db:getRelatorios', maquinaId),
  getRelatorio: (id) => ipcRenderer.invoke('db:getRelatorio', id),
  saveRelatorio: (maquinaId, dados) => ipcRenderer.invoke('db:saveRelatorio', maquinaId, dados),
  deleteRelatorio: (id, senha) => ipcRenderer.invoke('db:deleteRelatorio', id, senha),

  // Vista da empresa (meses do ano)
  getResumoMensal: (empresaId, ano) => ipcRenderer.invoke('db:getResumoMensal', empresaId, ano),
  getRegistosMes: (empresaId, ano, mes) =>
    ipcRenderer.invoke('db:getRegistosMes', empresaId, ano, mes),

  // Documentos de cada registo (pasta no disco) e folha de custos
  listarDocumentos: (id) => ipcRenderer.invoke('docs:listar', id),
  adicionarDocumentos: (id) => ipcRenderer.invoke('docs:adicionar', id),
  abrirDocumento: (id, nome) => ipcRenderer.invoke('docs:abrir', id, nome),
  abrirPastaRegisto: (id) => ipcRenderer.invoke('docs:abrirPasta', id),
  removerDocumento: (id, nome, senha) => ipcRenderer.invoke('docs:remover', id, nome, senha),
  folhaCustos: (id) => ipcRenderer.invoke('docs:folhaCustos', id),

  // Configuração de custos
  getConfigCustos: () => ipcRenderer.invoke('custos:get'),
  setConfigCustos: (valores, senha) => ipcRenderer.invoke('custos:set', valores, senha),

  // Senha (alterações e eliminações)
  desbloquear: (tipo, id, senha) => ipcRenderer.invoke('auth:desbloquear', tipo, id, senha),
  bloquear: (tipo) => ipcRenderer.invoke('auth:bloquear', tipo),
  alterarSenha: (atual, nova) => ipcRenderer.invoke('auth:alterarSenha', atual, nova),

  // Cópias de segurança
  fazerBackup: () => ipcRenderer.invoke('app:backup'),
  escolherRestauro: () => ipcRenderer.invoke('app:escolherRestauro'),
  restaurarBackup: (caminho, senha) => ipcRenderer.invoke('app:restaurar', caminho, senha),

  // Sistema
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  abrirPastaDados: () => ipcRenderer.invoke('app:abrirPastaDados'),
  imprimir: () => ipcRenderer.invoke('app:imprimir'),
  exportarPDF: (tituloSugerido) => ipcRenderer.invoke('app:exportarPDF', tituloSugerido)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
