// src/renderer/src/hooks/usePaginacaoRelatorio.js
import { useState, useCallback } from 'react'
import { Previewer } from 'pagedjs'
import a4PagedCSS from '../assets/a4-paged.css?raw' // Vite: importa o CSS como string

export function usePaginacaoRelatorio() {
  const [isPaginando, setIsPaginando] = useState(false)
  const [erroPaginacao, setErroPaginacao] = useState(null)

  const paginar = useCallback(async (htmlContent, containerEl) => {
    if (!containerEl) return

    setIsPaginando(true)
    setErroPaginacao(null)
    containerEl.innerHTML = '' // limpa preview anterior antes de repaginar

    try {
      const previewer = new Previewer()
      await previewer.preview(htmlContent, [{ content: a4PagedCSS }], containerEl)
    } catch (error) {
      setErroPaginacao('Erro ao gerar pré-visualização: ' + error.message)
    } finally {
      setIsPaginando(false)
    }
  }, [])

  return { paginar, isPaginando, erroPaginacao }
}
