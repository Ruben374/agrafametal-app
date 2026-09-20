import { useState, useEffect, useCallback } from 'react'

export function useRelatorios(activeMachineId, mostrarToast) {
  const [relatorios, setRelatorios] = useState([])

  const carregarRelatorios = useCallback(
    async (id) => {
      try {
        const dados = await window.api.getRelatorios(id)
        setRelatorios(dados)
      } catch (error) {
        mostrarToast('Erro ao carregar relatórios', error.message)
      }
    },
    [mostrarToast]
  )

  useEffect(() => {
    if (activeMachineId) {
      carregarRelatorios(activeMachineId)
    } else {
      setRelatorios([])
    }
  }, [activeMachineId, carregarRelatorios])

  const handleApagarRelatorio = async (id, activeMachineId) => {
    if (!confirm('Eliminar este registo de manutenção?')) return
    try {
      await window.api.deleteRelatorio(id)
      mostrarToast('Registo eliminado', 'sucesso')
      carregarRelatorios(activeMachineId)
    } catch (error) {
      mostrarToast('Erro ao apagar: ' + error.message, 'erro')
    }
  }

  return { relatorios, carregarRelatorios, handleApagarRelatorio }
}
