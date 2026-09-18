import { useState, useEffect, useRef } from 'react'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

export default function App() {
  // 1. ESTADO DA APLICAÇÃO (Ligado ao SQLite)
  const [empresas, setEmpresas] = useState([])
  const [activeCompanyId, setActiveCompanyId] = useState(null)
  const [activeMachineId, setActiveMachineId] = useState(null)

  // Controlo de Pastas Abertas/Fechadas na Sidebar
  const [openFolders, setOpenFolders] = useState({})

  // Controlo dos Modais
  const [isEmpresaModalOpen, setEmpresaModalOpen] = useState(false)
  const [isMaquinaModalOpen, setMaquinaModalOpen] = useState(false)

  // Campos dos formulários
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('')
  const [novaMaquinaNome, setNovaMaquinaNome] = useState('')
  const [pendingCompanyId, setPendingCompanyId] = useState(null)

  // === ESTADOS DOS RELATÓRIOS ===
  const [relatorios, setRelatorios] = useState([])
  const [isA4ModalOpen, setA4ModalOpen] = useState(false)
  const [relatorioAtual, setRelatorioAtual] = useState(null) // Guarda os dados do relatório que está aberto

  // Estados de erro para os modais
  const [erroEmpresa, setErroEmpresa] = useState('')
  const [erroMaquina, setErroMaquina] = useState('')

  // Referências para os campos de input
  const inputEmpresaRef = useRef(null)
  const inputMaquinaRef = useRef(null)

  // Referências para o Relatório A4
  const editorRef = useRef(null)
  const tituloRef = useRef(null)
  const [configSubtitulo, setConfigSubtitulo] = useState(
    'Serviços Reparação e Manutenção Preventiva'
  )

  const inserirSimbolo = (simbolo) => {
    editorRef.current?.focus()
    document.execCommand('insertText', false, simbolo + ' ')
  }

  const handleEditorKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertText', false, '\u0009') // caractere de tabulação real
    }
  }

  // Sistema de Notificações (Toast)
  const [toast, setToast] = useState(null)

  const mostrarToast = (mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo })
    // Desaparece automaticamente após 3 segundos
    setTimeout(() => setToast(null), 3000)
  }
  const carregarRelatorios = async (id) => {
    try {
      const dados = await window.api.getRelatorios(id)
      setRelatorios(dados)
    } catch (error) {
      mostrarToast('Erro ao carregar relatórios', error.message)
    }
  }
  const carregarDados = async () => {
    try {
      const dados = await window.api.getEmpresas()
      setEmpresas(dados)

      // NOVO: Carregar Configurações (Subtítulo)
      const config = await window.api.getConfig()
      if (config.cabecalho_subtitulo) setConfigSubtitulo(config.cabecalho_subtitulo)

      setOpenFolders((prev) => {
        const novo = { ...prev }
        dados.forEach((emp) => {
          if (!(emp.id in novo)) novo[emp.id] = true // só abre por defeito empresas novas
        })
        return novo
      })
    } catch (error) {
      mostrarToast('Erro ao carregar dados: ' + error.message, 'erro')
    }
  }

  // 3. EFEITOS DE FOCO SEGURO PARA O ELECTRON
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

  // Sempre que a máquina ativa muda, carrega os relatórios dela
  useEffect(() => {
    if (activeMachineId) {
      carregarRelatorios(activeMachineId)
    } else {
      setRelatorios([])
    }
  }, [activeMachineId])

  // 2. CARREGAR DADOS DA BD
  useEffect(() => {
    carregarDados()
  }, [])

  // Foco seguro e injeção de texto para a Folha A4
  useEffect(() => {
    if (isA4ModalOpen && editorRef.current && relatorioAtual) {
      // Injeta o conteúdo contornando a limitação do dangerouslySetInnerHTML no mount
      editorRef.current.innerHTML = relatorioAtual.corpo
      setTimeout(() => editorRef.current?.focus(), 100)
    }
  }, [isA4ModalOpen, relatorioAtual])

  useEffect(() => {
    if (isA4ModalOpen) {
      document.execCommand('styleWithCSS', false, true)
    }
  }, [isA4ModalOpen])

  // 4. FUNÇÕES DE AÇÃO (Falam com o preload.js)
  const handleAddEmpresa = async () => {
    if (!novaEmpresaNome.trim()) {
      setErroEmpresa('⚠️ Indique um nome para a empresa.')
      return
    }

    try {
      setErroEmpresa('')
      await window.api.addEmpresa(novaEmpresaNome)
      setNovaEmpresaNome('')
      setEmpresaModalOpen(false)
      carregarDados()
    } catch (error) {
      setErroEmpresa('Erro do sistema: ' + error.message)
    }
  }

  const handleAddMaquina = async () => {
    if (!novaMaquinaNome.trim()) {
      setErroMaquina('⚠️ Indique um nome para a máquina.')
      return
    }

    try {
      setErroMaquina('')
      const nova = await window.api.addMaquina(pendingCompanyId, novaMaquinaNome)
      setNovaMaquinaNome('')
      setMaquinaModalOpen(false)
      await carregarDados()
      selecionarMaquina(pendingCompanyId, nova.id)
    } catch (error) {
      setErroMaquina('Erro do sistema: ' + error.message)
    }
  }

  const handleDeleteMaquina = async () => {
    if (!confirm('Remover esta máquina? Esta ação não pode ser desfeita.')) return
    await window.api.deleteMaquina(activeMachineId)
    setActiveMachineId(null)
    setActiveCompanyId(null)
    setRelatorios([]) // Limpa a lista de relatórios do ecrã
    carregarDados()
  }

  const handleAbrirNovoRelatorio = () => {
    if (!activeMachine) return

    // Prepara um relatório vazio com valores por defeito
    setRelatorioAtual({
      id: null, // null significa que é novo e ainda não está no SQLite
      data: new Date().toISOString().slice(0, 10), // Data de hoje (YYYY-MM-DD)
      tecnico: '',
      tipo_manutencao: 'Preventiva',
      titulo: `MANUTENÇÃO ${activeMachine.nome.toUpperCase()}`,
      corpo: ''
    })
    setA4ModalOpen(true)
  }
  // === FUNÇÕES DA FOLHA A4 ===
  const applyCmd = (cmd, value = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  const handleSaveSubtitulo = async (novoSubtitulo) => {
    const texto = novoSubtitulo.trim()
    setConfigSubtitulo(texto)
    await window.api.setConfig('cabecalho_subtitulo', texto)
    mostrarToast('Cabeçalho atualizado', 'sucesso')
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

      // Atualiza a lista de relatórios no ecrã silenciosamente
      const novosRels = await window.api.getRelatorios(activeMachine.id)
      setRelatorios(novosRels)
    } catch (error) {
      mostrarToast('Erro ao guardar documento: ' + error.message, 'erro')
    }
  }
  const handleAbrirRelatorio = (rel) => {
    setRelatorioAtual(rel)
    setA4ModalOpen(true)
  }

  const handleApagarRelatorio = async (id) => {
    if (!confirm('Eliminar este registo de manutenção?')) return
    try {
      await window.api.deleteRelatorio(id)
      mostrarToast('Registo eliminado', 'sucesso')
      carregarRelatorios(activeMachine.id)
    } catch (error) {
      mostrarToast('Erro ao apagar: ' + error.message, 'erro')
    }
  }

  const handleExportarPDF = async () => {
    const titulo = tituloRef.current?.value.trim() || 'relatorio'
    try {
      const resultado = await window.api.exportarPDF(titulo)
      if (resultado.sucesso) {
        mostrarToast('PDF exportado com sucesso!', 'sucesso')
      }
      // Se o utilizador cancelar o diálogo, "sucesso" vem false — não mostramos erro nenhum, é escolha dele
    } catch (error) {
      mostrarToast('Erro ao exportar PDF: ' + error.message, 'erro')
    }
  }

  // Grava as alterações feitas diretamente na Chapa Metálica
  const handleUpdateChapa = async (campo, valorText) => {
    if (!activeMachine) return

    let valor = valorText.trim()
    if (valor === '-') valor = ''

    if (activeMachine[campo] === valor || (!activeMachine[campo] && valor === '')) return

    try {
      const dadosAtualizados = { ...activeMachine, [campo]: valor }
      await window.api.updateMaquina(activeMachine.id, dadosAtualizados)
      await carregarDados()

      // NOTIFICAÇÃO DE SUCESSO AQUI:
      mostrarToast('Alteração guardada', 'sucesso')
    } catch (error) {
      mostrarToast('Erro ao guardar: ' + error.message, 'erro')
    }
  }

  const toggleFolder = (id) => {
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const selecionarMaquina = (companyId, machineId) => {
    setActiveCompanyId(companyId)
    setActiveMachineId(machineId)
  }

  // Helper para obter a máquina selecionada atual
  const activeCompany = empresas.find((e) => e.id === activeCompanyId)
  const activeMachine = activeCompany?.maquinas.find((m) => m.id === activeMachineId)

  return (
    <div className="h-screen flex text-gray-800 bg-gray-50 overflow-hidden print:h-auto print:overflow-visible">
      {/* ================= SIDEBAR ================= */}
      <aside className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col h-full shadow-sm z-10 shrink-0 print:hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-bold text-blue-900 tracking-tight">Agrafametal, Lda.</h1>
          <p className="text-[10px] text-gray-500 uppercase font-semibold mt-1">
            Gestão de Equipamentos
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {empresas.map((empresa) => (
            <div key={empresa.id} className="mb-1">
              {/* Botão da Empresa */}
              <div
                className="flex items-center justify-between p-2 hover:bg-gray-200 rounded cursor-pointer text-sm font-semibold text-gray-700 transition group"
                onClick={() => toggleFolder(empresa.id)}
              >
                <div className="flex items-center flex-1 min-w-0">
                  <i
                    className={`fa-solid fa-chevron-down tree-caret text-[10px] text-gray-400 mr-2 ${!openFolders[empresa.id] ? 'collapsed' : ''}`}
                  ></i>
                  <i className="fa-solid fa-building text-gray-400 mr-2 w-4 text-center"></i>
                  <span className="truncate">{empresa.nome}</span>
                </div>
                <button
                  title="Adicionar máquina"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPendingCompanyId(empresa.id)
                    setMaquinaModalOpen(true)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 px-1 transition"
                >
                  <i className="fa-solid fa-plus text-xs"></i>
                </button>
              </div>

              {/* Lista de Máquinas */}
              {openFolders[empresa.id] && (
                <div className="pl-6 mt-1 space-y-1">
                  {empresa.maquinas.length === 0 ? (
                    <div className="text-[11px] text-gray-400 italic px-2 py-1">
                      Sem máquinas registadas
                    </div>
                  ) : (
                    empresa.maquinas.map((maquina) => {
                      const isAtiva = maquina.id === activeMachineId
                      return (
                        <div
                          key={maquina.id}
                          onClick={() => selecionarMaquina(empresa.id, maquina.id)}
                          className={`flex items-center p-2 rounded cursor-pointer text-xs transition ${isAtiva ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'}`}
                        >
                          <i
                            className={`fa-solid fa-gear ${isAtiva ? 'text-blue-600' : 'text-gray-400'} mr-2 w-4 text-center`}
                          ></i>
                          {maquina.nome}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-100">
          <button
            onClick={() => setEmpresaModalOpen(true)}
            className="w-full py-2 bg-white border border-gray-300 text-sm font-semibold text-gray-700 rounded shadow-sm hover:bg-gray-50 transition"
          >
            <i className="fa-solid fa-folder-plus mr-2 text-blue-600"></i> Adicionar Empresa
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col h-full bg-white relative">
        {/* Header Superior */}
        <header className="h-16 border-b border-gray-200 flex items-center px-6 justify-between bg-white shrink-0 print:hidden">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {activeMachine ? activeMachine.nome : 'Nenhuma Máquina Selecionada'}
            </h2>
            <p className="text-xs text-gray-500">
              {activeCompany
                ? `Cliente: ${activeCompany.nome}`
                : 'Selecione uma máquina no menu à esquerda'}
            </p>
          </div>
          {activeMachine && (
            <button
              onClick={handleDeleteMaquina}
              className="text-xs text-red-500 hover:text-red-700 font-semibold transition"
            >
              <i className="fa-solid fa-trash mr-1"></i>Remover máquina
            </button>
          )}
        </header>

        {/* Área de Conteúdo */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 print:hidden">
          {!activeMachine ? (
            /* Estado Vazio */
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <i className="fa-solid fa-gears text-6xl mb-4 text-gray-300"></i>
              <p className="text-lg">O espaço de trabalho está vazio.</p>
              <p className="text-sm">
                Escolha uma máquina à esquerda, ou adicione uma nova empresa.
              </p>
            </div>
          ) : (
            /* Estado Preenchido (Fase 2: Chapa Metálica e Relatórios) */
            <div className="max-w-5xl mx-auto">
              {/* === CHAPA DE CARACTERÍSTICAS === */}
              <div
                key={activeMachine.id}
                className="bg-gradient-to-br from-slate-700 to-slate-900 text-slate-200 border-2 border-slate-500 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] rounded-lg p-6 mb-8 relative"
              >
                {/* Parafusos visuais nos cantos */}
                <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>
                <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>
                <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>
                <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-gray-400 shadow-inner"></div>

                {/* BLOCO 1: IDENTIFICAÇÃO */}
                <h3 className="text-center font-bold tracking-[0.2em] text-gray-300 mb-6 border-b border-gray-600 pb-2">
                  CARACTERÍSTICAS TÉCNICAS
                </h3>

                <div className="grid grid-cols-4 gap-6 mb-8">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-semibold mb-1">
                      MARCA
                    </label>
                    <div
                      className="font-mono text-lg font-bold text-white outline-none focus:bg-white/10 hover:bg-white/5 rounded transition-colors px-2 py-1 -ml-2 cursor-text"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleUpdateChapa('marca', e.currentTarget.textContent)}
                    >
                      {activeMachine.marca || ''}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-semibold mb-1">
                      MODELO
                    </label>
                    <div
                      className="font-mono text-lg font-bold text-white outline-none focus:bg-white/10 hover:bg-white/5 rounded transition-colors px-2 py-1 -ml-2 cursor-text"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleUpdateChapa('modelo', e.currentTarget.textContent)}
                    >
                      {activeMachine.modelo || ''}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-semibold mb-1">
                      N/SERIE
                    </label>
                    <div
                      className="font-mono text-lg font-bold text-white outline-none focus:bg-white/10 hover:bg-white/5 rounded transition-colors px-2 py-1 -ml-2 cursor-text"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleUpdateChapa('serial', e.currentTarget.textContent)}
                    >
                      {activeMachine.serial || ''}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-semibold mb-1">
                      AÑO FAB.
                    </label>
                    <div
                      className="font-mono text-lg font-bold text-white outline-none focus:bg-white/10 hover:bg-white/5 rounded transition-colors px-2 py-1 -ml-2 cursor-text"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleUpdateChapa('ano_fab', e.currentTarget.textContent)}
                    >
                      {activeMachine.ano_fab || ''}
                    </div>
                  </div>
                </div>

                {/* BLOCO 2: ALIMENTAÇÃO */}
                <h3 className="text-center font-bold tracking-[0.2em] text-gray-300 mt-6 mb-6 border-b border-gray-600 pb-2">
                  CARACTERÍSTICAS DE ALIMENTACIÓN
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
                  {/* Eléctricas */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-bold text-gray-400 mb-2">Eléctricas</label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="bg-gray-800 px-3 py-1.5 rounded font-mono text-sm border border-gray-600 inline-block outline-none focus:bg-gray-700 cursor-text min-w-[50px] text-center shadow-inner"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleUpdateChapa('elet_v', e.currentTarget.textContent)}
                      >
                        {activeMachine.elet_v || ''}
                      </span>
                      <span className="text-gray-400 text-[10px] font-bold">V</span>

                      <span
                        className="bg-gray-800 px-3 py-1.5 rounded font-mono text-sm border border-gray-600 inline-block outline-none focus:bg-gray-700 cursor-text min-w-[50px] text-center shadow-inner ml-2"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleUpdateChapa('elet_hz', e.currentTarget.textContent)}
                      >
                        {activeMachine.elet_hz || ''}
                      </span>
                      <span className="text-gray-400 text-[10px] font-bold">Hz</span>

                      <span
                        className="bg-gray-800 px-3 py-1.5 rounded font-mono text-sm border border-gray-600 inline-block outline-none focus:bg-gray-700 cursor-text min-w-[50px] text-center shadow-inner ml-2"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleUpdateChapa('elet_kw', e.currentTarget.textContent)}
                      >
                        {activeMachine.elet_kw || ''}
                      </span>
                      <span className="text-gray-400 text-[10px] font-bold">Kw</span>
                    </div>
                  </div>

                  {/* Neumáticas */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-bold text-gray-400 mb-2">
                      Neumáticas (Aire)
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className="bg-gray-800 px-3 py-1.5 rounded font-mono text-sm border border-gray-600 inline-block outline-none focus:bg-gray-700 cursor-text min-w-[60px] text-center shadow-inner"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleUpdateChapa('pneu_kgcm2', e.currentTarget.textContent)}
                      >
                        {activeMachine.pneu_kgcm2 || ''}
                      </span>
                      <span className="text-gray-400 text-[10px] font-bold">Kg/cm²</span>
                    </div>
                  </div>

                  {/* Hidráulicas */}
                  <div className="flex flex-col">
                    <label className="block text-xs font-bold text-gray-400 mb-2">
                      Hidráulicas (Agua)
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="bg-gray-800 px-3 py-1.5 rounded font-mono text-sm border border-gray-600 inline-block outline-none focus:bg-gray-700 cursor-text min-w-[60px] text-center shadow-inner"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleUpdateChapa('hidr_kgcm2', e.currentTarget.textContent)}
                      >
                        {activeMachine.hidr_kgcm2 || ''}
                      </span>
                      <span className="text-gray-400 text-[10px] font-bold">Kg/cm²</span>

                      <span
                        className="bg-gray-800 px-3 py-1.5 rounded font-mono text-sm border border-gray-600 inline-block outline-none focus:bg-gray-700 cursor-text min-w-[60px] text-center shadow-inner ml-2"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleUpdateChapa('hidr_lh', e.currentTarget.textContent)}
                      >
                        {activeMachine.hidr_lh || ''}
                      </span>
                      <span className="text-gray-400 text-[10px] font-bold">l/h</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 mt-6 text-center italic opacity-70">
                  Clique nos visores escuros para editar os valores da máquina.
                </p>
              </div>

              {/* === HISTÓRICO DE RELATÓRIOS === */}
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

                {/* Aqui entrará a Árvore de Relatórios no próximo passo */}
                {relatorios.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 rounded border border-dashed border-gray-200">
                    <i className="fa-solid fa-file-signature text-3xl mb-3 opacity-50"></i>
                    <p className="text-sm">
                      Ainda não existem registos de manutenção para esta máquina.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(
                      relatorios.reduce((acc, rep) => {
                        const [ano, mesNum] = rep.data.split('-')
                        const mesNome = MESES[parseInt(mesNum, 10) - 1]
                        if (!acc[ano]) acc[ano] = {}
                        if (!acc[ano][mesNome]) acc[ano][mesNome] = []
                        acc[ano][mesNome].push(rep)
                        return acc
                      }, {})
                    )
                      .sort(([anoA], [anoB]) => anoB - anoA)
                      .map(([ano, meses]) => (
                        <details key={ano} className="group" open>
                          <summary className="flex items-center text-gray-700 font-semibold cursor-pointer hover:bg-gray-100 p-2 rounded list-none [&::-webkit-details-marker]:hidden">
                            <i className="fa-solid fa-chevron-right transition-transform group-open:rotate-90 w-4 text-gray-400 text-[11px] text-center mr-1"></i>
                            <i className="fa-solid fa-folder text-blue-400 mr-2"></i> {ano}
                          </summary>
                          <div className="pl-6 border-l border-gray-200 ml-2 mt-1 space-y-1 mb-2">
                            {Object.entries(meses)
                              .sort(([mesA], [mesB]) => MESES.indexOf(mesB) - MESES.indexOf(mesA))
                              .map(([mes, listaRels]) => (
                                <details key={mes} className="group/mes" open>
                                  <summary className="flex items-center text-gray-700 cursor-pointer hover:bg-gray-100 p-2 rounded list-none [&::-webkit-details-marker]:hidden">
                                    <i className="fa-solid fa-chevron-right transition-transform group-open/mes:rotate-90 w-4 text-gray-400 text-[11px] text-center mr-1"></i>
                                    <i className="fa-solid fa-folder text-yellow-500 mr-2"></i>{' '}
                                    {mes}
                                  </summary>
                                  <div className="pl-6 border-l border-gray-200 ml-2 mt-1 space-y-1">
                                    {listaRels.map((rel) => (
                                      <div
                                        key={rel.id}
                                        className="flex items-center justify-between text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 p-2 rounded transition group/file"
                                      >
                                        <div
                                          className="flex items-center cursor-pointer flex-1 min-w-0"
                                          onClick={() => handleAbrirRelatorio(rel)}
                                        >
                                          <i className="fa-solid fa-file-pdf text-red-500 mr-2"></i>
                                          <span className="truncate">
                                            Relatório {rel.data.split('-').reverse().join('-')} -{' '}
                                            {rel.titulo}
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => handleApagarRelatorio(rel.id)}
                                          className="opacity-0 group-hover/file:opacity-100 text-gray-400 hover:text-red-600 px-2 transition"
                                          title="Eliminar"
                                        >
                                          <i className="fa-solid fa-trash text-xs"></i>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              ))}
                          </div>
                        </details>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODAIS ================= */}
      {/* Modal Nova Empresa */}
      {isEmpresaModalOpen && (
        <div className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h3 className="font-bold text-lg mb-4 text-gray-800">
              <i className="fa-solid fa-building mr-2 text-blue-600"></i>Adicionar Empresa
            </h3>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Nome da empresa
            </label>
            <input
              ref={inputEmpresaRef}
              value={novaEmpresaNome}
              onChange={(e) => {
                setNovaEmpresaNome(e.target.value)
                setErroEmpresa('')
              }}
              placeholder="Ex: Cerâmica Oliveira"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2 outline-none focus:border-blue-500"
            />
            {erroEmpresa && (
              <p className="text-red-500 text-xs font-semibold mb-4">{erroEmpresa}</p>
            )}

            <div className={`flex justify-end gap-2 ${!erroEmpresa && 'mt-4'}`}>
              <button
                onClick={() => {
                  setEmpresaModalOpen(false)
                  setErroEmpresa('')
                  setNovaEmpresaNome('')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddEmpresa}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Máquina */}
      {isMaquinaModalOpen && (
        <div className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h3 className="font-bold text-lg mb-4 text-gray-800">
              <i className="fa-solid fa-gear mr-2 text-blue-600"></i>Adicionar Máquina
            </h3>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Nome / Designação
            </label>
            <input
              ref={inputMaquinaRef}
              value={novaMaquinaNome}
              onChange={(e) => {
                setNovaMaquinaNome(e.target.value)
                setErroMaquina('')
              }}
              placeholder="Ex: Cravadeira SOMME 2"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-2 outline-none focus:border-blue-500"
            />
            {erroMaquina && (
              <p className="text-red-500 text-xs font-semibold mb-4">{erroMaquina}</p>
            )}

            <div className={`flex justify-end gap-2 ${!erroMaquina && 'mt-4'}`}>
              <button
                onClick={() => {
                  setMaquinaModalOpen(false)
                  setErroMaquina('')
                  setNovaMaquinaNome('')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMaquina}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FOLHA A4 ================= */}
      {isA4ModalOpen && relatorioAtual && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-[80] overflow-y-auto pb-10 print:static print:bg-white print:overflow-visible print:pb-0 print:p-0">
          {/* Barra Superior Escura */}
          <div className="fixed top-0 left-0 right-0 bg-gray-800 text-white p-3 flex justify-between items-center shadow-lg z-[90] print:hidden">
            {' '}
            <div>
              <button
                onClick={() => setA4ModalOpen(false)}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm mr-4 transition"
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
              </button>
              <span className="text-sm text-gray-300 font-semibold">
                {relatorioAtual.id ? 'Editar Registo Existente' : 'Novo Registo'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportarPDF}
                className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm font-bold shadow transition"
              >
                <i className="fa-solid fa-file-pdf mr-2"></i>Exportar PDF
              </button>
              <button
                onClick={handleSaveRelatorio}
                className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded text-sm font-bold shadow transition"
              >
                <i className="fa-solid fa-floppy-disk mr-2"></i>Guardar
              </button>
            </div>
          </div>

          {/*
            O Papel A4 em si — PRINT TABLE HACK
            Em ecrã: continua flexbox normal (folha-a4 + flex flex-col).
            Em impressão: a classe .folha-a4 (definida no main.css)
            transforma este container em display:table, e os filhos
            marcados como -header / -body / -footer-spacer / -footer-real
            assumem os papéis de tabela que o Chromium sabe paginar
            corretamente, repetindo cabeçalho e rodapé em cada página.
          */}
          <div className="folha-a4 w-[210mm] min-h-[297mm] bg-white shadow-2xl mx-auto mt-20 flex flex-col p-[20mm] relative">
            {/* ===== CABEÇALHO — repete em todas as páginas ===== */}
            <div className="folha-a4-header">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Agrafametal, Lda.</h1>
                <div className="bg-blue-50 border-t border-b border-blue-200 py-1 mb-6 group cursor-text">
                  <p className="text-[11px] font-semibold text-gray-600 tracking-wide">
                    <span>NIF 514 304 197 — </span>
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => handleSaveSubtitulo(e.currentTarget.textContent)}
                      className="inline-block min-w-[4rem] outline-none hover:bg-blue-100 focus:bg-white px-1"
                    >
                      {configSubtitulo}
                    </span>
                  </p>
                </div>
                <input
                  ref={tituloRef}
                  defaultValue={relatorioAtual.titulo}
                  type="text"
                  className="w-full text-center text-lg font-bold text-blue-900 uppercase bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-blue-500 pb-1"
                  placeholder="TÍTULO DA INTERVENÇÃO"
                />
                <p className="text-[10px] text-gray-400 mt-2">
                  Data: {relatorioAtual.data.split('-').reverse().join('-')}
                </p>
              </div>

              {/* Barra de Ferramentas de Texto — não aparece na impressão */}
              <div className="flex flex-wrap items-center gap-1 border border-gray-200 bg-gray-50 rounded-t-md p-1.5 shadow-sm print:hidden">
                {' '}
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('bold')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-bold"></i>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('italic')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-italic"></i>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('underline')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-underline"></i>
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('justifyLeft')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-align-left"></i>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('justifyCenter')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-align-center"></i>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('justifyRight')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-align-right"></i>
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('insertUnorderedList')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-list-ul"></i>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('insertOrderedList')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 hover:text-blue-700 transition"
                >
                  <i className="fa-solid fa-list-ol"></i>
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => inserirSimbolo('✓')}
                  className="w-8 h-8 rounded text-green-600 hover:bg-gray-200 transition font-bold"
                >
                  ✓
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => inserirSimbolo('➤')}
                  className="w-8 h-8 rounded text-blue-600 hover:bg-gray-200 transition font-bold"
                >
                  ➤
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => inserirSimbolo('✗')}
                  className="w-8 h-8 rounded text-red-600 hover:bg-gray-200 transition font-bold"
                >
                  ✗
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('indent')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 transition"
                >
                  <i className="fa-solid fa-indent"></i>
                </button>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyCmd('outdent')}
                  className="w-8 h-8 rounded text-gray-600 hover:bg-gray-200 transition"
                >
                  <i className="fa-solid fa-outdent"></i>
                </button>
              </div>
            </div>

            {/* ===== CORPO — flui livremente entre páginas ===== */}
            <div className="folha-a4-body border border-t-0 border-gray-200 flex-grow relative print:border-0">
              <div
                ref={editorRef}
                className="absolute inset-0 p-4 text-[13px] leading-relaxed text-gray-800 outline-none overflow-y-auto print:static print:h-auto print:overflow-visible print:p-0 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ol]:list-decimal"
                contentEditable
                suppressContentEditableWarning
                onKeyDown={handleEditorKeyDown}
              ></div>
            </div>

            {/*
              ===== ESPAÇADOR DO RODAPÉ =====
              Invisível em ecrã. Em impressão vira table-footer-group:
              reserva o espaço exato do rodapé real em cada página para
              o texto nunca lhe bater por cima. Ajusta o h-[40mm] se
              o rodapé real (moradas + texto legal) mudar de tamanho.
            */}
            <div className="hidden folha-a4-footer-spacer">
              <div className="h-[40mm]"></div>
            </div>

            {/*
              ===== RODAPÉ REAL =====
              Em ecrã: fica colado ao fundo da folha (mt-auto).
              Em impressão: torna-se fixed e repete-se fisicamente
              no fundo de TODAS as páginas (ver .folha-a4-footer-real
              no main.css).
            */}
            <div className="folha-a4-footer-real mt-auto pt-4 border-t-2 border-gray-800">
              <div className="flex justify-between text-[10px] font-bold text-gray-800 mb-4">
                <div className="w-1/2">
                  <p className="italic mb-1 text-[11px] text-gray-500">Morada:</p>
                  <p>Rua Novos Mares, 28</p>
                  <p>3830-660 Gafanha da Nazaré</p>
                  <p>Telm - 962 303 861 - 935 990 243</p>
                </div>
                <div className="w-1/2 text-right">
                  <p className="italic mb-1 text-[11px] text-gray-500">Oficina:</p>
                  <p>Travessa D. Duarte, 4</p>
                  <p>3830 - 743 Gafanha da Nazaré</p>
                </div>
              </div>
              <p className="text-[8px] text-justify text-gray-500 leading-tight">
                Todas as Máquinas, independentemente do tipo ou fabricante, têm peças de desgaste
                que é necessário substituir regularmente, para manter um bom nível de fiabilidade e
                eficiência energética do equipamento, minimizando assim os custos de manutenção.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST (NOTIFICAÇÃO) ================= */}
      {toast && (
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
      )}
    </div>
  )
}
