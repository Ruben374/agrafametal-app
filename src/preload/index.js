import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Config
  getConfig: () => ipcRenderer.invoke('db:getConfig'),
  setConfig: (chave, valor) => ipcRenderer.invoke('db:setConfig', chave, valor),

  // Empresas
  getEmpresas: () => ipcRenderer.invoke('db:getEmpresas'),
  addEmpresa: (nome) => ipcRenderer.invoke('db:addEmpresa', nome),
  updateEmpresa: (id, nome) => ipcRenderer.invoke('db:updateEmpresa', id, nome),
  deleteEmpresa: (id) => ipcRenderer.invoke('db:deleteEmpresa', id),

  // Máquinas
  addMaquina: (empresaId, nome) => ipcRenderer.invoke('db:addMaquina', empresaId, nome),
  updateMaquina: (id, dados) => ipcRenderer.invoke('db:updateMaquina', id, dados),
  deleteMaquina: (id) => ipcRenderer.invoke('db:deleteMaquina', id),

  // Relatórios
  getRelatorios: (maquinaId) => ipcRenderer.invoke('db:getRelatorios', maquinaId),
  saveRelatorio: (maquinaId, dados) => ipcRenderer.invoke('db:saveRelatorio', maquinaId, dados),
  deleteRelatorio: (id) => ipcRenderer.invoke('db:deleteRelatorio', id),

  // Sistema
  fazerBackup: () => ipcRenderer.invoke('app:backup'),
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
