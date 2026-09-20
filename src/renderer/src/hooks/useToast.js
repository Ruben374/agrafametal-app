import { useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)

  const mostrarToast = (mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  return { toast, mostrarToast }
}
