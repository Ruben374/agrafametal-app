import { useState, useEffect, useRef } from 'react'
import { Previewer } from 'pagedjs'
import a4PagedCSS from './assets/a4-paged.css?raw'
import { montarHTMLParaPaginacao } from './utils/montarHTMLParaPaginacao'
import { useToast } from './hooks/useToast'
import { useEmpresas } from './hooks/useEmpresas'
import { useMaquinas } from './hooks/useMaquinas'
import { useRelatorios } from './hooks/useRelatorios'
import Toast from './components/Toast'
import EmpresaModal from './components/Modals/EmpresaModal'
import MaquinaModal from './components/Modals/MaquinaModal'
import Sidebar from './components/Sidebar/Sidebar'
import MachinePlate from './components/Machine/MachinePlate'
import ReportsList from './components/Reports/ReportsList'
import MachineHeader from './components/Machine/MachineHeader'
import EmptyWorkspace from './components/Machine/EmptyWorkspace'
import A4EditorModal from './components/A4Editor/A4EditorModal'

export default function App() {
  // ===== REFERÊNCIAS =====
  const previewContainerRef = useRef(null)
  const inputEmpresaRef = useRef(null)
  const inputMaquinaRef = useRef(null)
  const editorRef = useRef(null)
  const tituloRef = useRef(null)

  // ===== SELEÇÃO ATIVA (partilhada entre hooks) =====
  const [activeCompanyId, setActiveCompanyId] = useState(null)
  const [activeMachineId, setActiveMachineId] = useState(null)

  const selecionarMaquina = (companyId, machineId) => {
    setActiveCompanyId(companyId)
    setActiveMachineId(machineId)
  }

  // ===== ESTADO DE UI — MODAIS DE EMPRESA/MÁQUINA =====
  const [isEmpresaModalOpen, setEmpresaModalOpen] = useState(false)
  const [isMaquinaModalOpen, setMaquinaModalOpen] = useState(false)
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('')
  const [novaMaquinaNome, setNovaMaquinaNome] = useState('')
  const [pendingCompanyId, setPendingCompanyId] = useState(null)
  const [erroEmpresa, setErroEmpresa] = useState('')
  const [erroMaquina, setErroMaquina] = useState('')

  // ===== ESTADO DE UI — MODAL A4 =====
  const [isA4ModalOpen, setA4ModalOpen] = useState(false)
  const [relatorioAtual, setRelatorioAtual] = useState(null)
  const [isExportando, setIsExportando] = useState(false)

  // ===== TOAST =====
  const { toast, mostrarToast } = useToast()

  // ===== HOOKS DE DADOS =====
  const {
    empresas,
    openFolders,
    configSubtitulo,
    carregarDados,
    handleAddEmpresa,
    handleDeleteEmpresa,
    toggleFolder,
    handleSaveSubtitulo
  } = useEmpresas(mostrarToast)

  const { handleAddMaquina, handleDeleteMaquina, handleUpdateChapa } = useMaquinas(
    carregarDados,
    mostrarToast,
    selecionarMaquina
  )

  const { relatorios, carregarRelatorios, handleApagarRelatorio } = useRelatorios(
    activeMachineId,
    mostrarToast
  )

  // ===== HELPERS DERIVADOS =====
  const activeCompany = empresas.find((e) => e.id === activeCompanyId)
  const activeMachine = activeCompany?.maquinas.find((m) => m.id === activeMachineId)

  // ===== WRAPPERS — ligam os hooks genéricos ao estado de UI local =====
  const handleAddEmpresaSubmit = () => {
    handleAddEmpresa(
      novaEmpresaNome,
      () => {
        setNovaEmpresaNome('')
        setEmpresaModalOpen(false)
        setErroEmpresa('')
      },
      setErroEmpresa
    )
  }
  const handleDeleteEmpresaAtual = (empresaId, nomeEmpresa) => {
    const confirmar = window.confirm(
      `Tem a certeza que quer eliminar "${nomeEmpresa}"?\n\nTodas as máquinas e relatórios desta empresa serão também eliminados. Esta ação não pode ser desfeita.`
    )
    if (!confirmar) return

    handleDeleteEmpresa(empresaId, () => {
      if (empresaId === activeCompanyId) {
        setActiveCompanyId(null)
        setActiveMachineId(null)
      }
    })
  }

  const handleAddMaquinaSubmit = () => {
    handleAddMaquina(
      pendingCompanyId,
      novaMaquinaNome,
      () => {
        setNovaMaquinaNome('')
        setMaquinaModalOpen(false)
        setErroMaquina('')
      },
      setErroMaquina
    )
  }

  const handleDeleteMaquinaAtual = () => {
    handleDeleteMaquina(activeMachineId, () => {
      setActiveMachineId(null)
      setActiveCompanyId(null)
    })
  }

  const handleUpdateChapaAtual = (campo, valorText) => {
    handleUpdateChapa(activeMachine, campo, valorText)
  }

  const handleApagarRelatorioAtual = (id) => {
    handleApagarRelatorio(id, activeMachineId)
  }

  // ===== EFEITOS =====

  useEffect(() => {
    if (isEmpresaModalOpen) {
      setTimeout(() => inputEmpresaRef.current?.focus(), 100)
    }
  }, [isEmpresaModalOpen])

  useEffect(() => {
    if (isMaquinaModalOpen) {
      setTimeout(() => inputMaquinaRef.current?.focus(), 100)
    }
  }, [isMaquinaModalOpen])

  useEffect(() => {
    carregarDados()
  }, [])

  // Foco seguro e injeção de conteúdo na Folha A4
  useEffect(() => {
    if (isA4ModalOpen && editorRef.current && relatorioAtual) {
      editorRef.current.innerHTML = relatorioAtual.corpo
      setTimeout(() => editorRef.current?.focus(), 100)
    }
  }, [isA4ModalOpen, relatorioAtual])

  useEffect(() => {
    if (isA4ModalOpen) {
      document.execCommand('styleWithCSS', false, true)
    }
  }, [isA4ModalOpen])

  // ===== FUNÇÕES DA FOLHA A4 =====
  const inserirSimbolo = (simbolo) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, simbolo + ' ')
  }

  const handleEditorKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertText', false, '\u0009')
    }
  }

  const handleAbrirNovoRelatorio = () => {
    if (!activeMachine) return
    setRelatorioAtual({
      id: null,
      data: new Date().toISOString().slice(0, 10),
      tecnico: '',
      tipo_manutencao: 'Preventiva',
      titulo: `MANUTENÇÃO ${activeMachine.nome.toUpperCase()}`,
      corpo: ''
    })
    setA4ModalOpen(true)
  }

  const applyCmd = (cmd, value = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  const handleSaveRelatorio = async () => {
    if (!activeMachine || !relatorioAtual) return

    const titulo = tituloRef.current?.value.trim() || 'REGISTO SEM TÍTULO'
    const corpo = editorRef.current?.innerHTML || ''
    const dadosGuardar = { ...relatorioAtual, titulo, corpo }

    try {
      await window.api.saveRelatorio(activeMachine.id, dadosGuardar)
      mostrarToast('Registo guardado com sucesso!', 'sucesso')
      setA4ModalOpen(false)
      carregarRelatorios(activeMachine.id)
    } catch (error) {
      mostrarToast('Erro ao guardar documento: ' + error.message, 'erro')
    }
  }

  const handleAbrirRelatorio = (rel) => {
    setRelatorioAtual(rel)
    setA4ModalOpen(true)
  }

  // Único fluxo agora: gera a paginação (escondida) e imprime logo a seguir
  const handleExportarPDF = async () => {
    if (isExportando) return // NOVO — impede que corra outra vez enquanto já está a exportar
    if (!editorRef.current || !previewContainerRef.current || !relatorioAtual) return

    const titulo = tituloRef.current?.value.trim() || 'relatorio'

    const html = montarHTMLParaPaginacao({
      relatorio: relatorioAtual,
      configSubtitulo,
      corpoHTML: editorRef.current.innerHTML
    })

    setIsExportando(true)
    previewContainerRef.current.innerHTML = ''

    try {
      const previewer = new Previewer()
      await previewer.preview(html, [{ content: a4PagedCSS }], previewContainerRef.current)

      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

      const resultado = await window.api.exportarPDF(titulo)
      if (resultado.sucesso) {
        mostrarToast('PDF exportado com sucesso!', 'sucesso')
      }
    } catch (error) {
      mostrarToast('Erro ao exportar PDF: ' + error.message, 'erro')
    } finally {
      setIsExportando(false)
    }
  }
  // ===== RENDER =====
  return (
    <div className="h-screen flex text-gray-800 bg-gray-50 overflow-hidden print:h-auto print:overflow-visible">
      {/* ================= SIDEBAR ================= */}
      <Sidebar
        empresas={empresas}
        openFolders={openFolders}
        activeMachineId={activeMachineId}
        onToggleFolder={toggleFolder}
        onAddMaquina={(empresaId) => {
          setPendingCompanyId(empresaId)
          setMaquinaModalOpen(true)
        }}
        onSelecionarMaquina={selecionarMaquina}
        onAddEmpresa={() => setEmpresaModalOpen(true)}
        onDeleteEmpresa={handleDeleteEmpresaAtual}
      />
      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col h-full bg-white relative">
        <MachineHeader
          activeMachine={activeMachine}
          activeCompany={activeCompany}
          onDeleteMaquina={handleDeleteMaquinaAtual}
        />

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 print:hidden">
          {!activeMachine ? (
            <EmptyWorkspace />
          ) : (
            <div className="max-w-5xl mx-auto">
              <MachinePlate maquina={activeMachine} onSave={handleUpdateChapaAtual} />

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-800">
                    <i className="fa-solid fa-folder-open text-yellow-500 mr-2"></i> Documentos de
                    Manutenção
                  </h3>
                  <button
                    onClick={handleAbrirNovoRelatorio}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition shadow-sm"
                  >
                    <i className="fa-solid fa-file-circle-plus mr-1"></i> Criar Registo Diário
                  </button>
                </div>

                <ReportsList
                  relatorios={relatorios}
                  onAbrirRelatorio={handleAbrirRelatorio}
                  onApagarRelatorio={handleApagarRelatorioAtual}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODAIS ================= */}
      <EmpresaModal
        isOpen={isEmpresaModalOpen}
        nome={novaEmpresaNome}
        erro={erroEmpresa}
        inputRef={inputEmpresaRef}
        onChangeNome={(v) => {
          setNovaEmpresaNome(v)
          setErroEmpresa('')
        }}
        onCancelar={() => {
          setEmpresaModalOpen(false)
          setErroEmpresa('')
          setNovaEmpresaNome('')
        }}
        onConfirmar={handleAddEmpresaSubmit}
      />

      <MaquinaModal
        isOpen={isMaquinaModalOpen}
        nome={novaMaquinaNome}
        erro={erroMaquina}
        inputRef={inputMaquinaRef}
        onChangeNome={(v) => {
          setNovaMaquinaNome(v)
          setErroMaquina('')
        }}
        onCancelar={() => {
          setMaquinaModalOpen(false)
          setErroMaquina('')
          setNovaMaquinaNome('')
        }}
        onConfirmar={handleAddMaquinaSubmit}
      />

      {/* ================= MODAL FOLHA A4 ================= */}
      {isA4ModalOpen && relatorioAtual && (
        <A4EditorModal
          relatorioAtual={relatorioAtual}
          configSubtitulo={configSubtitulo}
          editorRef={editorRef}
          tituloRef={tituloRef}
          previewContainerRef={previewContainerRef}
          isExportando={isExportando}
          onVoltar={() => setA4ModalOpen(false)}
          onExportarPDF={handleExportarPDF}
          onGuardar={handleSaveRelatorio}
          onSaveSubtitulo={handleSaveSubtitulo}
          applyCmd={applyCmd}
          inserirSimbolo={inserirSimbolo}
          handleEditorKeyDown={handleEditorKeyDown}
        />
      )}

      {/* ================= TOAST ================= */}
      <Toast toast={toast} />
    </div>
  )
}
