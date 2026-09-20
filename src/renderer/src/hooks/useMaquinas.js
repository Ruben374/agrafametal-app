import { useState } from 'react'

export function useMaquinas(carregarDados, mostrarToast, selecionarMaquina) {
  const handleAddMaquina = async (empresaId, nome, onSucesso, onErro) => {
    if (!nome.trim()) {
      onErro('⚠️ Indique um nome para a máquina.')
      return
    }
    try {
      const nova = await window.api.addMaquina(empresaId, nome)
      onSucesso()
      await carregarDados()
      selecionarMaquina(empresaId, nova.id)
    } catch (error) {
      onErro('Erro do sistema: ' + error.message)
    }
  }

  const handleDeleteMaquina = async (machineId, onDepoisApagar) => {
    if (!confirm('Remover esta máquina? Esta ação não pode ser desfeita.')) return
    await window.api.deleteMaquina(machineId)
    onDepoisApagar()
    carregarDados()
  }

  const handleUpdateChapa = async (activeMachine, campo, valorText) => {
    if (!activeMachine) return
    let valor = valorText.trim()
    if (valor === '-') valor = ''
    if (activeMachine[campo] === valor || (!activeMachine[campo] && valor === '')) return

    try {
      const dadosAtualizados = { ...activeMachine, [campo]: valor }
      await window.api.updateMaquina(activeMachine.id, dadosAtualizados)
      await carregarDados()
      mostrarToast('Alteração guardada', 'sucesso')
    } catch (error) {
      mostrarToast('Erro ao guardar: ' + error.message, 'erro')
    }
  }

  return { handleAddMaquina, handleDeleteMaquina, handleUpdateChapa }
}
