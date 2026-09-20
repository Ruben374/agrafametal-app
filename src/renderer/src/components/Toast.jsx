export default function Toast({ toast }) {
  if (!toast) return null

  return (
    <div
      className={`fixed bottom-6 right-6 z-[70] px-4 py-3 rounded shadow-lg text-white text-sm font-semibold flex items-center gap-2 animate-[pulse_0.3s_ease-in-out] ${
        toast.tipo === 'erro' ? 'bg-red-600' : 'bg-gray-800'
      }`}
    >
      <i
        className={`fa-solid ${toast.tipo === 'erro' ? 'fa-triangle-exclamation' : 'fa-circle-check text-green-400'}`}
      ></i>
      {toast.mensagem}
    </div>
  )
}
