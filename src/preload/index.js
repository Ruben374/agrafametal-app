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
  saveRelatorio: (maquinaId, dados) => ipcRenderer.invoke('db:saveRelatorio', maquinaId, dados),
  deleteRelatorio: (id, senha) => ipcRenderer.invoke('db:deleteRelatorio', id, senha),

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
