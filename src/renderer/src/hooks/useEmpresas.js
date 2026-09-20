import { useState, useCallback } from 'react'

export function useEmpresas(mostrarToast) {
  const [empresas, setEmpresas] = useState([])
  const [openFolders, setOpenFolders] = useState({})
  const [configSubtitulo, setConfigSubtitulo] = useState(
    'Serviços Reparação e Manutenção Preventiva'
  )

  const carregarDados = useCallback(async () => {
    try {
      const dados = await window.api.getEmpresas()
      setEmpresas(dados)

      const config = await window.api.getConfig()
      if (config.cabecalho_subtitulo) setConfigSubtitulo(config.cabecalho_subtitulo)

      setOpenFolders((prev) => {
        const novo = { ...prev }
        dados.forEach((emp) => {
          if (!(emp.id in novo)) novo[emp.id] = true
        })
        return novo
      })
    } catch (error) {
      mostrarToast('Erro ao carregar dados: ' + error.message, 'erro')
    }
  }, [mostrarToast])

  const handleAddEmpresa = async (nome, onSucesso, onErro) => {
    if (!nome.trim()) {
      onErro('⚠️ Indique um nome para a empresa.')
      return
    }
    try {
      await window.api.addEmpresa(nome)
      onSucesso()
      carregarDados()
    } catch (error) {
      onErro('Erro do sistema: ' + error.message)
    }
  }

  const toggleFolder = (id) => {
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSaveSubtitulo = async (novoSubtitulo) => {
    const texto = novoSubtitulo.trim()
    setConfigSubtitulo(texto)
    await window.api.setConfig('cabecalho_subtitulo', texto)
    mostrarToast('Cabeçalho atualizado', 'sucesso')
  }

  const handleDeleteEmpresa = async (empresaId, onSucesso) => {
    try {
      await window.api.deleteEmpresa(empresaId)
      mostrarToast('Empresa eliminada com sucesso!', 'sucesso')
      carregarDados()
      onSucesso?.()
    } catch (error) {
      mostrarToast('Erro ao eliminar empresa: ' + error.message, 'erro')
    }
  }

  return {
    empresas,
    openFolders,
    configSubtitulo,
    carregarDados,
    handleAddEmpresa,
    toggleFolder,
    handleSaveSubtitulo,
    handleDeleteEmpresa
  }
}
