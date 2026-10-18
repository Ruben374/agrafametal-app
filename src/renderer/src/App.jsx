import { useState, useEffect, useRef, useMemo } from 'react'
import logoSimbolo from './assets/logo-simbolo.svg'

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

// Ordenação alfabética em português ("Água" junto do "A", "Máquina 2" antes de "Máquina 10")
const collator = new Intl.Collator('pt-PT', { sensitivity: 'base', numeric: true })
const ordenarPorNome = (a, b) => collator.compare(a.nome, b.nome)

// Pesquisa sem acentos nem maiúsculas: "maquina" encontra "Máquina"
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const MODOS_DADOS = {
  portatil: 'Portátil — dados no disco',
  instalado: 'Instalado — dados neste computador',
  desenvolvimento: 'Desenvolvimento — dados neste computador'
}

// Estilos comuns (os tons vêm todos da paleta em main.css)
const BTN_PRIMARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-brand-700 hover:bg-brand-800 text-white text-base font-semibold shadow-sm transition'
const BTN_SECUNDARIO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-base font-medium text-slate-700 hover:bg-slate-100 transition'
const BTN_PERIGO =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-danger-600 hover:bg-danger-700 text-white text-base font-semibold shadow-sm transition'
const INPUT =
  'w-full border border-slate-300 rounded-md px-3 py-2.5 text-base text-slate-900 bg-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 placeholder:text-slate-400'

/*
  Campo editável da chapa metálica.
  - Grava ao sair do campo (blur) ou ao carregar Enter
  - Escape anula a alteração
  Usa <input> controlado em vez de contentEditable: o Enter já não cria
  linhas novas e o React não se baralha com o texto escrito pelo utilizador.
*/
function CampoChapa({ valor, onGuardar, className = '', placeholder = '—', ariaLabel }) {
  const [texto, setTexto] = useState(valor ?? '')
  const [valorOriginal, setValorOriginal] = useState(valor ?? '')

  // Se o valor vier alterado da BD (ex.: depois de gravar), atualiza o campo
  if ((valor ?? '') !== valorOriginal) {
    setValorOriginal(valor ?? '')
    setTexto(valor ?? '')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur() // o blur grava
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setTexto(valorOriginal)
      // espera o React aplicar o valor antigo antes de sair do campo
      const el = e.currentTarget
      setTimeout(() => el.blur(), 0)
    }
  }

  return (
    <input
      type="text"
      value={texto}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => setTexto(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={(e) => onGuardar(e.currentTarget.value)}
      className={`bg-transparent outline-none placeholder:text-slate-500 cursor-text tabular-nums ${className}`}
    />
  )
}

/* Janela de confirmação própria (substitui o window.confirm, que no Electron
   em Windows deixa os campos de texto sem conseguirem receber foco) */
function ConfirmModal({ pedido, onResponder }) {
  const btnRef = useRef(null)
  useEffect(() => {
    if (pedido) setTimeout(() => btnRef.current?.focus(), 50)
  }, [pedido])
  if (!pedido) return null
  return (
    <div
      className="fixed inset-0 modal-backdrop z-[100] flex items-center justify-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onResponder(false)}
      onMouseDown={(e) => e.target === e.currentTarget && onResponder(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animar-entrada"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex gap-4">
          <div
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${pedido.perigo ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-700'}`}
          >
            <i
              className={`fa-solid ${pedido.perigo ? 'fa-triangle-exclamation' : 'fa-circle-question'} text-lg`}
            ></i>
          </div>
          <div className="min-w-0">
            {pedido.titulo && (
              <h3 className="text-lg font-bold text-slate-900 mb-1">{pedido.titulo}</h3>
            )}
            <p className="text-base text-slate-700 whitespace-pre-line break-words">
              {pedido.mensagem}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={() => onResponder(false)} className={BTN_SECUNDARIO}>
            Cancelar
          </button>
          <button
            ref={btnRef}
            onClick={() => onResponder(true)}
            className={pedido.perigo ? BTN_PERIGO : BTN_PRIMARIO}
          >
            {pedido.textoBotao || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* Modal simples com um campo de texto (adicionar empresa, adicionar máquina, renomear).
   É um <form>: Enter confirma, Esc / clique fora cancela. */
function ModalNome({
  titulo,
  icone,
  subtitulo,
  rotulo,
  valor,
  onChange,
  erro,
  placeholder,
  textoBotao,
  inputRef,
  onConfirmar,
  onCancelar
}) {
  return (
    <div
      className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
      onMouseDown={(e) => e.target === e.currentTarget && onCancelar()}
    >
      <form
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animar-entrada"
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault()
          onConfirmar()
        }}
      >
        <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
          <i className={`fa-solid ${icone} text-brand-600`}></i>
          {titulo}
        </h3>
        {subtitulo && <p className="text-sm text-slate-500 mt-1 truncate">{subtitulo}</p>}
        <label className="block text-sm font-semibold text-slate-600 mt-5 mb-1.5">{rotulo}</label>
        <input
          ref={inputRef}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={INPUT}
        />
        {erro && (
          <p className="text-danger-600 text-sm font-semibold mt-2">
            <i className="fa-solid fa-circle-exclamation mr-1.5"></i>
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancelar} className={BTN_SECUNDARIO}>
            Cancelar
          </button>
          <button type="submit" className={BTN_PRIMARIO}>
            {textoBotao}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  // 1. ESTADO DA APLICAÇÃO (Ligado ao SQLite)
  const [empresas, setEmpresas] = useState([])
  const [activeCompanyId, setActiveCompanyId] = useState(null)
  const [activeMachineId, setActiveMachineId] = useState(null)

  // Controlo de Pastas Abertas/Fechadas na Sidebar
  const [openFolders, setOpenFolders] = useState({})
  const [pesquisa, setPesquisa] = useState('')
  const estadoProntoRef = useRef(false) // só grava o estado depois de o restaurar

  // Controlo dos Modais
  const [isEmpresaModalOpen, setEmpresaModalOpen] = useState(false)
  const [isMaquinaModalOpen, setMaquinaModalOpen] = useState(false)
  const [empresaRenomear, setEmpresaRenomear] = useState(null) // { id, nome }
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [appInfo, setAppInfo] = useState(null) // != null -> janela "Acerca" aberta

  // Campos dos formulários
  const [novaEmpresaNome, setNovaEmpresaNome] = useState('')
  const [novaMaquinaNome, setNovaMaquinaNome] = useState('')
  const [nomeRenomear, setNomeRenomear] = useState('')
  const [pendingCompanyId, setPendingCompanyId] = useState(null)

  // === ESTADOS DOS RELATÓRIOS ===
  const [relatorios, setRelatorios] = useState([])
  const [isA4ModalOpen, setA4ModalOpen] = useState(false)
  const [relatorioAtual, setRelatorioAtual] = useState(null) // Guarda os dados do relatório que está aberto

  // Estados de erro para os modais
  const [erroEmpresa, setErroEmpresa] = useState('')
  const [erroMaquina, setErroMaquina] = useState('')
  const [erroRenomear, setErroRenomear] = useState('')

  // Referências para os campos de input
  const inputEmpresaRef = useRef(null)
  const inputMaquinaRef = useRef(null)
  const inputRenomearRef = useRef(null)
  const inputPesquisaRef = useRef(null)
  const aGravarRef = useRef(false)

  // Referências para o Relatório A4
  const editorRef = useRef(null)
  const tituloRef = useRef(null)
  const corpoInicialRef = useRef('')
  const [tituloTexto, setTituloTexto] = useState('') // cópia do título para a impressão
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
  const toastTimerRef = useRef(null)

  const mostrarToast = (mensagem, tipo = 'sucesso') => {
    setToast({ mensagem, tipo })
    // Cancela o temporizador anterior para não fechar o toast novo antes do tempo
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), tipo === 'erro' ? 6000 : 3500)
  }

  // Confirmações (substituem o window.confirm)
  const [pedidoConfirmacao, setPedidoConfirmacao] = useState(null)
  const pedirConfirmacao = (mensagem, opcoes = {}) =>
    new Promise((resolve) => setPedidoConfirmacao({ mensagem, ...opcoes, resolve }))
  const responderConfirmacao = (resposta) => {
    pedidoConfirmacao?.resolve(resposta)
    setPedidoConfirmacao(null)
  }

  const carregarRelatorios = async (id) => {
    try {
      const dados = await window.api.getRelatorios(id)
      setRelatorios(dados)
    } catch (error) {
      mostrarToast('Erro ao carregar relatórios: ' + error.message, 'erro')
    }
  }

  const carregarDados = async () => {
    try {
      const dados = await window.api.getEmpresas()
      setEmpresas(dados)

      const config = await window.api.getConfig()
      if (config.cabecalho_subtitulo) setConfigSubtitulo(config.cabecalho_subtitulo)

      setOpenFolders((prev) => {
        const novo = { ...prev }
        dados.forEach((emp) => {
          if (!(emp.id in novo)) novo[emp.id] = true // só abre por defeito empresas novas
        })
        return novo
      })
      return dados
    } catch (error) {
      mostrarToast('Erro ao carregar dados: ' + error.message, 'erro')
      return []
    }
  }

  // 2. ARRANQUE: carrega os dados e repõe o estado da última sessão
  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const [dados, config] = await Promise.all([
          window.api.getEmpresas(),
          window.api.getConfig()
        ])
        if (!ativo) return
        setEmpresas(dados)
        if (config.cabecalho_subtitulo) setConfigSubtitulo(config.cabecalho_subtitulo)

        let pastasGuardadas = {}
        try {
          pastasGuardadas = JSON.parse(config.pastas_abertas || '{}') || {}
        } catch {
          pastasGuardadas = {}
        }
        const pastas = {}
        dados.forEach((emp) => {
          pastas[emp.id] = emp.id in pastasGuardadas ? !!pastasGuardadas[emp.id] : true
        })
        setOpenFolders(pastas)

        // Volta a abrir a última máquina vista (se ainda existir)
        const ultima = Number(config.ultima_maquina)
        const empresaDaUltima = ultima && dados.find((e) => e.maquinas.some((m) => m.id === ultima))
        if (empresaDaUltima) {
          setActiveCompanyId(empresaDaUltima.id)
          setActiveMachineId(ultima)
          setOpenFolders((prev) => ({ ...prev, [empresaDaUltima.id]: true }))
        }
      } catch (error) {
        mostrarToast('Erro ao carregar dados: ' + error.message, 'erro')
      } finally {
        estadoProntoRef.current = true
      }
    })()
    return () => {
      ativo = false
    }
  }, [])

  // Grava a máquina aberta e as pastas abertas, para a próxima sessão
  useEffect(() => {
    if (!estadoProntoRef.current) return
    window.api
      .setConfig('ultima_maquina', activeMachineId ? String(activeMachineId) : '')
      .catch(() => {})
  }, [activeMachineId])

  useEffect(() => {
    if (!estadoProntoRef.current) return
    window.api.setConfig('pastas_abertas', JSON.stringify(openFolders)).catch(() => {})
  }, [openFolders])

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

  useEffect(() => {
    if (empresaRenomear) {
      setTimeout(() => {
        inputRenomearRef.current?.focus()
        inputRenomearRef.current?.select()
      }, 100)
    }
  }, [empresaRenomear])

  // Sempre que a máquina ativa muda, carrega os relatórios dela
  // (a flag "ativo" ignora respostas antigas se o utilizador mudar de máquina rapidamente)
  useEffect(() => {
    if (!activeMachineId) return
    let ativo = true
    window.api
      .getRelatorios(activeMachineId)
      .then((dados) => ativo && setRelatorios(dados))
      .catch((error) => mostrarToast('Erro ao carregar relatórios: ' + error.message, 'erro'))
    return () => {
      ativo = false
    }
  }, [activeMachineId])

  // Foco seguro e injeção de texto para a Folha A4
  useEffect(() => {
    if (isA4ModalOpen && editorRef.current && relatorioAtual) {
      // Injeta o conteúdo contornando a limitação do dangerouslySetInnerHTML no mount
      editorRef.current.innerHTML = relatorioAtual.corpo || ''
      // guarda o HTML já normalizado pelo browser, para comparar ao sair
      corpoInicialRef.current = editorRef.current.innerHTML
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
      setErroEmpresa('Indique um nome para a empresa.')
      return
    }

    if (aGravarRef.current) return // evita duplicados com Enter carregado duas vezes
    aGravarRef.current = true
    try {
      setErroEmpresa('')
      await window.api.addEmpresa(novaEmpresaNome)
      setNovaEmpresaNome('')
      setEmpresaModalOpen(false)
      await carregarDados()
      mostrarToast('Empresa adicionada', 'sucesso')
    } catch (error) {
      setErroEmpresa('Erro do sistema: ' + error.message)
    } finally {
      aGravarRef.current = false
    }
  }

  const fecharModalEmpresa = () => {
    setEmpresaModalOpen(false)
    setErroEmpresa('')
    setNovaEmpresaNome('')
  }

  const fecharModalMaquina = () => {
    setMaquinaModalOpen(false)
    setErroMaquina('')
    setNovaMaquinaNome('')
  }

  const abrirModalMaquina = (empresaId) => {
    setPendingCompanyId(empresaId)
    setMaquinaModalOpen(true)
  }

  const handleAddMaquina = async () => {
    if (!novaMaquinaNome.trim()) {
      setErroMaquina('Indique um nome para a máquina.')
      return
    }

    if (aGravarRef.current) return
    aGravarRef.current = true
    try {
      setErroMaquina('')
      const nova = await window.api.addMaquina(pendingCompanyId, novaMaquinaNome)
      setNovaMaquinaNome('')
      setMaquinaModalOpen(false)
      await carregarDados()
      setOpenFolders((prev) => ({ ...prev, [pendingCompanyId]: true })) // mostra a máquina nova
      selecionarMaquina(pendingCompanyId, nova.id)
      mostrarToast('Máquina adicionada', 'sucesso')
    } catch (error) {
      setErroMaquina('Erro do sistema: ' + error.message)
    } finally {
      aGravarRef.current = false
    }
  }

  // --- Renomear / remover empresa ---
  const abrirRenomearEmpresa = (empresa) => {
    setEmpresaRenomear({ id: empresa.id, nome: empresa.nome })
    setNomeRenomear(empresa.nome)
    setErroRenomear('')
  }

  const fecharRenomearEmpresa = () => {
    setEmpresaRenomear(null)
    setErroRenomear('')
    setNomeRenomear('')
  }

  const handleRenomearEmpresa = async () => {
    const nome = nomeRenomear.trim()
    if (!nome) {
      setErroRenomear('Indique um nome para a empresa.')
      return
    }
    if (nome === empresaRenomear.nome) {
      fecharRenomearEmpresa() // nada mudou
      return
    }
    if (aGravarRef.current) return
    aGravarRef.current = true
    try {
      await window.api.updateEmpresa(empresaRenomear.id, nome)
      fecharRenomearEmpresa()
      await carregarDados()
      mostrarToast('Empresa renomeada', 'sucesso')
    } catch (error) {
      setErroRenomear('Erro do sistema: ' + error.message)
    } finally {
      aGravarRef.current = false
    }
  }

  const handleDeleteEmpresa = async (empresa) => {
    const n = empresa.maquinas.length
    const mensagem =
      n === 0
        ? `Remover a empresa «${empresa.nome}»? Esta ação não pode ser desfeita.`
        : `Remover a empresa «${empresa.nome}» e ${n === 1 ? 'a sua máquina' : `as suas ${n} máquinas`}, incluindo todos os registos de manutenção? Esta ação não pode ser desfeita.`
    const ok = await pedirConfirmacao(mensagem, {
      titulo: 'Remover empresa',
      textoBotao: 'Remover empresa',
      perigo: true
    })
    if (!ok) return
    try {
      await window.api.deleteEmpresa(empresa.id)
      if (activeCompanyId === empresa.id) {
        setActiveMachineId(null)
        setActiveCompanyId(null)
        setRelatorios([])
      }
      setOpenFolders((prev) => {
        const novo = { ...prev }
        delete novo[empresa.id]
        return novo
      })
      await carregarDados()
      mostrarToast('Empresa removida', 'sucesso')
    } catch (error) {
      mostrarToast('Erro ao remover empresa: ' + error.message, 'erro')
    }
  }

  const handleDeleteMaquina = async () => {
    const ok = await pedirConfirmacao(
      `Remover a máquina «${activeMachine?.nome}» e todos os seus registos? Esta ação não pode ser desfeita.`,
      { titulo: 'Remover máquina', textoBotao: 'Remover máquina', perigo: true }
    )
    if (!ok) return
    try {
      await window.api.deleteMaquina(activeMachineId)
      setActiveMachineId(null)
      setActiveCompanyId(null)
      setRelatorios([]) // Limpa a lista de relatórios do ecrã
      await carregarDados()
      mostrarToast('Máquina removida', 'sucesso')
    } catch (error) {
      mostrarToast('Erro ao remover máquina: ' + error.message, 'erro')
    }
  }

  // --- Cópias de segurança e "Acerca" ---
  const handleBackup = async () => {
    setMenuOpen(false)
    try {
      const r = await window.api.fazerBackup()
      if (r.sucesso) {
        const nome = r.caminho.split(/[\\/]/).pop()
        mostrarToast(`Cópia de segurança guardada: ${nome}`, 'sucesso')
      }
    } catch (error) {
      mostrarToast('Erro ao fazer a cópia: ' + error.message, 'erro')
    }
  }

  const handleRestaurar = async () => {
    setMenuOpen(false)
    try {
      const escolha = await window.api.escolherRestauro()
      if (escolha.cancelado) return
      const ok = await pedirConfirmacao(
        `Restaurar a cópia «${escolha.nome}»?\n` +
          `Contém ${escolha.empresas} empresa(s), ${escolha.maquinas} máquina(s) e ${escolha.relatorios} registo(s).\n\n` +
          'Os dados atuais serão substituídos por esta cópia. Antes disso, é guardada automaticamente uma cópia dos dados atuais na pasta das cópias de segurança.',
        { titulo: 'Restaurar cópia de segurança', textoBotao: 'Restaurar', perigo: true }
      )
      if (!ok) return
      await window.api.restaurarBackup(escolha.caminho)
      setActiveMachineId(null)
      setActiveCompanyId(null)
      setRelatorios([])
      setPesquisa('')
      setOpenFolders({})
      await carregarDados()
      mostrarToast('Cópia de segurança restaurada', 'sucesso')
    } catch (error) {
      mostrarToast(
        error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''),
        'erro'
      )
    }
  }

  const abrirAcerca = async () => {
    setMenuOpen(false)
    try {
      setAppInfo(await window.api.getAppInfo())
    } catch (error) {
      mostrarToast('Erro: ' + error.message, 'erro')
    }
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
    setTituloTexto(`MANUTENÇÃO ${activeMachine.nome.toUpperCase()}`)
    setA4ModalOpen(true)
  }
  // === FUNÇÕES DA FOLHA A4 ===
  const applyCmd = (cmd, value = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  const handleSaveSubtitulo = async (novoSubtitulo) => {
    const texto = novoSubtitulo.replace(/\s+/g, ' ').trim()
    if (texto === configSubtitulo) return // nada mudou: não grava nem mostra aviso
    try {
      setConfigSubtitulo(texto)
      await window.api.setConfig('cabecalho_subtitulo', texto)
      mostrarToast('Cabeçalho atualizado', 'sucesso')
    } catch (error) {
      mostrarToast('Erro ao guardar cabeçalho: ' + error.message, 'erro')
    }
  }

  // Enter/Escape no subtítulo do cabeçalho (é contentEditable, por isso o Enter criaria uma linha nova)
  const handleSubtituloKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.currentTarget.textContent = configSubtitulo
      e.currentTarget.blur()
    }
  }

  // Deteta alterações por guardar na folha A4
  const temAlteracoesPorGuardar = () => {
    if (!relatorioAtual) return false
    const titulo = tituloRef.current?.value ?? relatorioAtual.titulo
    const corpo = editorRef.current?.innerHTML ?? corpoInicialRef.current
    return titulo !== (relatorioAtual.titulo || '') || corpo !== corpoInicialRef.current
  }

  const handleFecharA4 = async () => {
    if (temAlteracoesPorGuardar()) {
      const sair = await pedirConfirmacao(
        'Tem alterações por guardar neste registo. Sair sem guardar?',
        { titulo: 'Alterações por guardar', textoBotao: 'Sair sem guardar', perigo: true }
      )
      if (!sair) return
    }
    setA4ModalOpen(false)
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
    setTituloTexto(rel.titulo || '')
    setA4ModalOpen(true)
  }

  const handleApagarRelatorio = async (id) => {
    const ok = await pedirConfirmacao('Eliminar este registo de manutenção?', {
      titulo: 'Eliminar registo',
      textoBotao: 'Eliminar',
      perigo: true
    })
    if (!ok) return
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
      // Grava só o campo alterado (evita que duas edições seguidas se sobreponham)
      await window.api.updateCampoMaquina(activeMachine.id, campo, valor)
      await carregarDados()
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

  // Lista da barra lateral: ordenada e filtrada pela pesquisa
  const termo = normalizar(pesquisa)
  const empresasVisiveis = useMemo(() => {
    const ordenadas = [...empresas]
      .sort(ordenarPorNome)
      .map((e) => ({ ...e, maquinas: [...e.maquinas].sort(ordenarPorNome) }))
    if (!termo)
      return ordenadas.map((e) => ({ empresa: e, maquinas: e.maquinas, forcarAberta: false }))
    return ordenadas
      .map((e) => {
        const nomeCorresponde = normalizar(e.nome).includes(termo)
        const maquinasCorrespondem = e.maquinas.filter((m) => normalizar(m.nome).includes(termo))
        if (!nomeCorresponde && maquinasCorrespondem.length === 0) return null
        return {
          empresa: e,
          // se o nome da empresa corresponde, mostra as máquinas todas
          maquinas:
            nomeCorresponde && maquinasCorrespondem.length === 0
              ? e.maquinas
              : maquinasCorrespondem,
          forcarAberta: maquinasCorrespondem.length > 0
        }
      })
      .filter(Boolean)
  }, [empresas, termo])

  // Helper para obter a máquina selecionada atual
  const activeCompany = empresas.find((e) => e.id === activeCompanyId)
  const activeMachine = activeCompany?.maquinas.find((m) => m.id === activeMachineId)
  // Só mostra relatórios da máquina ativa (evita ver por instantes os da máquina anterior)
  const relatoriosMaquina = activeMachine
    ? relatorios.filter((r) => r.maquina_id === activeMachine.id)
    : []

  return (
    <div className="h-screen flex text-slate-800 bg-slate-100 overflow-hidden print:block print:h-auto print:overflow-visible print:bg-white">
      {/* ================= SIDEBAR ================= */}
      <aside className="w-72 xl:w-80 bg-white border-r border-slate-200 flex flex-col h-full z-10 shrink-0 print:hidden">
        <div className="px-4 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img src={logoSimbolo} alt="" className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-brand-900 tracking-tight leading-tight">
                Agrafametal
              </h1>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                Gestão de Equipamentos
              </p>
            </div>
          </div>

          {/* Pesquisa */}
          <div className="relative mt-4">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
            <input
              ref={inputPesquisaRef}
              type="text"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  if (pesquisa) setPesquisa('')
                  else e.currentTarget.blur()
                }
              }}
              placeholder="Pesquisar…"
              aria-label="Pesquisar empresa ou máquina"
              className="w-full pl-9 pr-9 py-2 rounded-md border border-slate-300 bg-slate-50 text-[15px] text-slate-900 outline-none focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 placeholder:text-slate-400"
            />
            {pesquisa && (
              <button
                onClick={() => {
                  setPesquisa('')
                  inputPesquisaRef.current?.focus()
                }}
                title="Limpar pesquisa (Esc)"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="Empresas e máquinas">
          {empresas.length === 0 && (
            <div className="text-center text-slate-500 text-[15px] px-4 py-10">
              <div className="mb-3">
                <i className="fa-solid fa-building text-3xl text-slate-300"></i>
              </div>
              Ainda não há empresas.
              <br />
              Comece por adicionar uma.
            </div>
          )}
          {empresas.length > 0 && empresasVisiveis.length === 0 && (
            <div className="text-center text-slate-500 text-[15px] px-4 py-10">
              <div className="mb-3">
                <i className="fa-solid fa-magnifying-glass text-2xl text-slate-300"></i>
              </div>
              Nenhum resultado para «{pesquisa.trim()}».
            </div>
          )}

          {empresasVisiveis.map(({ empresa, maquinas, forcarAberta }) => {
            const aberta = forcarAberta || !!openFolders[empresa.id]
            const temMaquinaAtiva = empresa.id === activeCompanyId
            return (
              <div key={empresa.id} className="mb-0.5">
                {/* Linha da Empresa */}
                <div className="group flex items-center rounded-md hover:bg-slate-100 focus-within:bg-slate-100 transition">
                  <button
                    onClick={() => toggleFolder(empresa.id)}
                    aria-expanded={aberta}
                    title={empresa.nome}
                    className="flex items-center flex-1 min-w-0 px-2 py-2 text-left text-[15px] font-semibold text-slate-800 rounded-md"
                  >
                    <i
                      className={`fa-solid fa-chevron-down tree-caret text-[11px] text-slate-400 w-4 shrink-0 ${!aberta ? 'collapsed' : ''}`}
                    ></i>
                    <i
                      className={`fa-solid fa-building w-5 text-center mr-2 shrink-0 ${temMaquinaAtiva ? 'text-brand-600' : 'text-slate-400'}`}
                    ></i>
                    <span className="truncate">{empresa.nome}</span>
                    <span
                      className="ml-auto pl-2 shrink-0 group-hover:hidden group-focus-within:hidden"
                      title={`${empresa.maquinas.length} máquina(s)`}
                    >
                      <span className="inline-block min-w-[1.6rem] text-center text-xs font-semibold tabular-nums text-slate-600 bg-slate-100 group-hover:bg-white rounded-full px-1.5 py-0.5">
                        {empresa.maquinas.length}
                      </span>
                    </span>
                  </button>

                  {/* Ações da empresa: aparecem ao passar o rato ou com o teclado */}
                  <div className="hidden group-hover:flex group-focus-within:flex items-center pr-1 shrink-0">
                    <button
                      title="Adicionar máquina"
                      aria-label={`Adicionar máquina a ${empresa.nome}`}
                      onClick={() => abrirModalMaquina(empresa.id)}
                      className="w-8 h-8 rounded text-brand-600 hover:bg-brand-100"
                    >
                      <i className="fa-solid fa-plus text-sm"></i>
                    </button>
                    <button
                      title="Renomear empresa"
                      aria-label={`Renomear ${empresa.nome}`}
                      onClick={() => abrirRenomearEmpresa(empresa)}
                      className="w-8 h-8 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    >
                      <i className="fa-solid fa-pen text-sm"></i>
                    </button>
                    <button
                      title="Remover empresa"
                      aria-label={`Remover ${empresa.nome}`}
                      onClick={() => handleDeleteEmpresa(empresa)}
                      className="w-8 h-8 rounded text-slate-500 hover:text-danger-600 hover:bg-danger-50"
                    >
                      <i className="fa-solid fa-trash text-sm"></i>
                    </button>
                  </div>
                </div>

                {/* Lista de Máquinas */}
                {aberta && (
                  <div className="pl-7 pr-1 pb-1 space-y-0.5">
                    {maquinas.length === 0 ? (
                      <button
                        onClick={() => abrirModalMaquina(empresa.id)}
                        className="w-full text-left text-sm text-slate-500 hover:text-brand-700 px-2 py-1.5 rounded-md hover:bg-brand-50"
                      >
                        <i className="fa-solid fa-plus mr-2 text-xs"></i>Adicionar a primeira
                        máquina
                      </button>
                    ) : (
                      maquinas.map((maquina) => {
                        const isAtiva = maquina.id === activeMachineId
                        return (
                          <button
                            key={maquina.id}
                            onClick={() => selecionarMaquina(empresa.id, maquina.id)}
                            title={maquina.nome}
                            aria-current={isAtiva ? 'page' : undefined}
                            className={`w-full flex items-center px-2 py-2 rounded-md text-left text-[15px] transition ${isAtiva ? 'bg-brand-700 text-white font-semibold shadow-sm' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-800'}`}
                          >
                            <i
                              className={`fa-solid fa-gear w-5 text-center mr-2 shrink-0 text-sm ${isAtiva ? 'text-accent-300' : 'text-slate-400'}`}
                            ></i>
                            <span className="truncate">{maquina.nome}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="relative p-3 border-t border-slate-200 bg-slate-50 flex gap-2">
          <button
            onClick={() => setEmpresaModalOpen(true)}
            className={`${BTN_PRIMARIO} flex-1 min-w-0 px-3`}
          >
            <i className="fa-solid fa-folder-plus"></i>
            <span className="truncate">Adicionar Empresa</span>
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="Mais opções"
            aria-label="Mais opções"
            aria-expanded={isMenuOpen}
            className="w-11 shrink-0 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <i className="fa-solid fa-ellipsis-vertical text-lg"></i>
          </button>

          {/* Menu "Mais opções" */}
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onMouseDown={() => setMenuOpen(false)}></div>
              <div
                role="menu"
                onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}
                className="absolute bottom-full right-3 mb-2 z-30 w-72 bg-white rounded-lg border border-slate-200 shadow-xl py-1.5 animar-entrada"
              >
                {[
                  ['fa-floppy-disk', 'Fazer cópia de segurança', 'backup'],
                  ['fa-clock-rotate-left', 'Restaurar cópia de segurança', 'restaurar'],
                  ['fa-circle-info', 'Acerca da aplicação', 'acerca']
                ].map(([icone, texto, acao], i) => (
                  <button
                    key={acao}
                    role="menuitem"
                    autoFocus={i === 0}
                    onClick={() => {
                      if (acao === 'backup') handleBackup()
                      else if (acao === 'restaurar') handleRestaurar()
                      else abrirAcerca()
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[15px] text-slate-700 hover:bg-slate-100 focus:bg-slate-100 outline-none"
                  >
                    <i className={`fa-solid ${icone} w-5 text-center text-brand-600`}></i>
                    {texto}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 min-w-0 flex flex-col h-full bg-slate-100 relative print:hidden">
        {/* Header Superior */}
        <header className="min-h-16 py-2 border-b border-slate-200 flex items-center px-5 lg:px-8 gap-4 justify-between bg-white shrink-0 print:hidden">
          <div className="min-w-0">
            <h2 className="text-xl lg:text-2xl font-bold text-slate-900 truncate leading-tight">
              {activeMachine ? activeMachine.nome : 'Nenhuma máquina selecionada'}
            </h2>
            <p className="text-sm text-slate-500 truncate">
              {activeCompany ? (
                <>
                  <i className="fa-solid fa-building mr-1.5 text-slate-400"></i>
                  {activeCompany.nome}
                </>
              ) : (
                'Selecione uma máquina no menu à esquerda'
              )}
            </p>
          </div>
          {activeMachine && (
            <button
              onClick={handleDeleteMaquina}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-danger-600 hover:bg-danger-50 hover:text-danger-700 transition whitespace-nowrap shrink-0"
            >
              <i className="fa-solid fa-trash"></i>Remover máquina
            </button>
          )}
        </header>

        {/* Área de Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 lg:p-8 print:hidden">
          {!activeMachine ? (
            /* Estado Vazio */
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <img src={logoSimbolo} alt="" className="w-24 h-24 mb-5 drop-shadow-sm" />
              <p className="text-2xl font-bold text-slate-800">Agrafametal</p>
              <p className="text-base text-slate-500 mt-1 mb-6">
                Gestão de equipamentos e registos de manutenção
              </p>
              <p className="text-base text-slate-600 max-w-md">
                {empresas.length === 0
                  ? 'Comece por adicionar a primeira empresa (cliente) no botão «Adicionar Empresa», em baixo à esquerda.'
                  : 'Escolha uma máquina na lista à esquerda, ou adicione uma nova empresa.'}
              </p>
            </div>
          ) : (
            /* Estado Preenchido: Chapa Metálica e Relatórios */
            <div className="max-w-5xl mx-auto">
              {/* === CHAPA DE CARACTERÍSTICAS === */}
              <div
                key={activeMachine.id}
                className="@container bg-gradient-to-br from-slate-700 to-slate-900 text-slate-200 border-2 border-slate-500 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] rounded-lg p-5 @lg:p-7 mb-8 relative"
              >
                {/* Parafusos visuais nos cantos */}
                <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-slate-400 shadow-inner"></div>
                <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-slate-400 shadow-inner"></div>
                <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-slate-400 shadow-inner"></div>
                <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-slate-400 shadow-inner"></div>

                {/* BLOCO 1: IDENTIFICAÇÃO */}
                <h3 className="text-center font-bold tracking-[0.2em] text-slate-300 mb-6 border-b border-slate-600 pb-2 text-sm @lg:text-base">
                  CARACTERÍSTICAS TÉCNICAS
                </h3>

                {/* 2 colunas em ecrãs estreitos, 4 quando há espaço (container query) */}
                <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-x-6 gap-y-4 mb-8">
                  {[
                    ['marca', 'MARCA'],
                    ['modelo', 'MODELO'],
                    ['serial', 'N/SERIE'],
                    ['ano_fab', 'AÑO FAB.']
                  ].map(([campo, rotulo]) => (
                    <div key={campo} className="min-w-0">
                      <label className="block text-xs tracking-wider text-slate-400 font-semibold mb-1">
                        {rotulo}
                      </label>
                      <CampoChapa
                        ariaLabel={rotulo}
                        valor={activeMachine[campo]}
                        onGuardar={(v) => handleUpdateChapa(campo, v)}
                        className="w-full font-mono text-lg font-bold text-white focus:bg-white/10 hover:bg-white/5 rounded transition-colors px-2 py-1 -ml-2"
                      />
                    </div>
                  ))}
                </div>

                {/* BLOCO 2: ALIMENTAÇÃO */}
                <h3 className="text-center font-bold tracking-[0.2em] text-slate-300 mt-6 mb-6 border-b border-slate-600 pb-2 text-sm @lg:text-base">
                  CARACTERÍSTICAS DE ALIMENTACIÓN
                </h3>

                <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6 pb-2">
                  {[
                    {
                      titulo: 'Eléctricas',
                      campos: [
                        ['elet_v', 'V'],
                        ['elet_hz', 'Hz'],
                        ['elet_kw', 'Kw']
                      ]
                    },
                    { titulo: 'Neumáticas (Aire)', campos: [['pneu_kgcm2', 'Kg/cm²']] },
                    {
                      titulo: 'Hidráulicas (Agua)',
                      campos: [
                        ['hidr_kgcm2', 'Kg/cm²'],
                        ['hidr_lh', 'l/h']
                      ]
                    }
                  ].map((grupo) => (
                    <div key={grupo.titulo} className="flex flex-col">
                      <label className="block text-sm font-bold text-slate-400 mb-2">
                        {grupo.titulo}
                      </label>
                      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                        {grupo.campos.map(([campo, unidade]) => (
                          <div key={campo} className="flex items-center gap-1.5 whitespace-nowrap">
                            <CampoChapa
                              ariaLabel={`${grupo.titulo} ${unidade}`}
                              valor={activeMachine[campo]}
                              onGuardar={(v) => handleUpdateChapa(campo, v)}
                              placeholder=""
                              className="bg-slate-800 px-2 py-1.5 rounded font-mono text-base text-white border border-slate-600 focus:bg-slate-700 focus:border-accent-400 w-[5rem] text-center shadow-inner"
                            />
                            <span className="text-slate-400 text-xs font-bold">{unidade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-400 mt-6 text-center italic">
                  Clique num valor para o editar. Enter grava, Esc anula.
                </p>
              </div>

              {/* === HISTÓRICO DE RELATÓRIOS === */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:p-6">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <i className="fa-solid fa-folder-open text-accent-500"></i> Documentos de
                    Manutenção
                    {relatoriosMaquina.length > 0 && (
                      <span className="text-sm font-semibold tabular-nums text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                        {relatoriosMaquina.length}
                      </span>
                    )}
                  </h3>

                  <button onClick={handleAbrirNovoRelatorio} className={BTN_PRIMARIO}>
                    <i className="fa-solid fa-file-circle-plus"></i> Criar Registo Diário
                  </button>
                </div>

                {relatoriosMaquina.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <i className="fa-solid fa-file-signature text-3xl mb-3 text-slate-300"></i>
                    <p className="text-base">
                      Ainda não existem registos de manutenção para esta máquina.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(
                      relatoriosMaquina.reduce((acc, rep) => {
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
                          <summary className="flex items-center text-base text-slate-800 font-semibold cursor-pointer hover:bg-slate-100 p-2 rounded-md list-none [&::-webkit-details-marker]:hidden">
                            <i className="fa-solid fa-chevron-right transition-transform group-open:rotate-90 w-4 text-slate-400 text-xs text-center mr-1.5"></i>
                            <i className="fa-solid fa-folder text-brand-400 mr-2"></i>
                            <span className="tabular-nums">{ano}</span>
                          </summary>
                          <div className="pl-6 border-l border-slate-200 ml-3 mt-1 space-y-1 mb-2">
                            {Object.entries(meses)
                              .sort(([mesA], [mesB]) => MESES.indexOf(mesB) - MESES.indexOf(mesA))
                              .map(([mes, listaRels]) => (
                                <details key={mes} className="group/mes" open>
                                  <summary className="flex items-center text-[15px] text-slate-700 font-medium cursor-pointer hover:bg-slate-100 p-2 rounded-md list-none [&::-webkit-details-marker]:hidden">
                                    <i className="fa-solid fa-chevron-right transition-transform group-open/mes:rotate-90 w-4 text-slate-400 text-xs text-center mr-1.5"></i>
                                    <i className="fa-solid fa-folder text-accent-400 mr-2"></i>
                                    {mes}
                                  </summary>
                                  <div className="pl-6 border-l border-slate-200 ml-3 mt-1 space-y-0.5">
                                    {listaRels.map((rel) => (
                                      <div
                                        key={rel.id}
                                        className="flex items-center justify-between text-[15px] text-slate-700 hover:bg-brand-50 hover:text-brand-800 rounded-md transition group/file"
                                      >
                                        <button
                                          className="flex items-center text-left flex-1 min-w-0 p-2 rounded-md"
                                          onClick={() => handleAbrirRelatorio(rel)}
                                        >
                                          <i className="fa-solid fa-file-lines text-brand-500 mr-2.5"></i>
                                          <span className="tabular-nums text-slate-500 mr-2 shrink-0">
                                            {rel.data.split('-').reverse().join('-')}
                                          </span>
                                          <span className="truncate">{rel.titulo}</span>
                                        </button>
                                        <button
                                          onClick={() => handleApagarRelatorio(rel.id)}
                                          className="opacity-40 group-hover/file:opacity-100 focus:opacity-100 w-9 h-9 rounded text-slate-500 hover:text-danger-600 hover:bg-danger-50 transition shrink-0"
                                          title="Eliminar registo"
                                          aria-label="Eliminar registo"
                                        >
                                          <i className="fa-solid fa-trash text-sm"></i>
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
      {isEmpresaModalOpen && (
        <ModalNome
          titulo="Adicionar Empresa"
          icone="fa-building"
          rotulo="Nome da empresa"
          valor={novaEmpresaNome}
          onChange={(v) => {
            setNovaEmpresaNome(v)
            setErroEmpresa('')
          }}
          erro={erroEmpresa}
          placeholder="Ex: Cerâmica Oliveira, Lda."
          textoBotao="Adicionar"
          inputRef={inputEmpresaRef}
          onConfirmar={handleAddEmpresa}
          onCancelar={fecharModalEmpresa}
        />
      )}

      {isMaquinaModalOpen && (
        <ModalNome
          titulo="Adicionar Máquina"
          icone="fa-gear"
          subtitulo={empresas.find((e) => e.id === pendingCompanyId)?.nome}
          rotulo="Nome / Designação"
          valor={novaMaquinaNome}
          onChange={(v) => {
            setNovaMaquinaNome(v)
            setErroMaquina('')
          }}
          erro={erroMaquina}
          placeholder="Ex: Cravadeira SOMME 2"
          textoBotao="Adicionar"
          inputRef={inputMaquinaRef}
          onConfirmar={handleAddMaquina}
          onCancelar={fecharModalMaquina}
        />
      )}

      {empresaRenomear && (
        <ModalNome
          titulo="Renomear Empresa"
          icone="fa-pen"
          subtitulo={`Nome atual: ${empresaRenomear.nome}`}
          rotulo="Novo nome"
          valor={nomeRenomear}
          onChange={(v) => {
            setNomeRenomear(v)
            setErroRenomear('')
          }}
          erro={erroRenomear}
          placeholder="Nome da empresa"
          textoBotao="Guardar"
          inputRef={inputRenomearRef}
          onConfirmar={handleRenomearEmpresa}
          onCancelar={fecharRenomearEmpresa}
        />
      )}

      {/* ================= ACERCA ================= */}
      {appInfo && (
        <div
          className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center p-4"
          onKeyDown={(e) => e.key === 'Escape' && setAppInfo(null)}
          onMouseDown={(e) => e.target === e.currentTarget && setAppInfo(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animar-entrada"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-4 pb-5 border-b border-slate-200">
              <img src={logoSimbolo} alt="" className="w-14 h-14" />
              <div>
                <h3 className="text-2xl font-bold text-brand-900 leading-tight">Agrafametal</h3>
                <p className="text-sm text-slate-500">
                  Gestão de equipamentos e registos de manutenção
                </p>
              </div>
            </div>
            <dl className="mt-5 space-y-4 text-base">
              <div className="flex gap-4">
                <dt className="w-36 shrink-0 text-slate-500">Versão</dt>
                <dd className="font-semibold text-slate-900 tabular-nums">{appInfo.versao}</dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-36 shrink-0 text-slate-500">Modo</dt>
                <dd className="font-semibold text-slate-900">
                  {MODOS_DADOS[appInfo.modo] || appInfo.modo}
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-36 shrink-0 text-slate-500">Pasta de dados</dt>
                <dd className="min-w-0">
                  <code className="block text-sm text-slate-800 bg-slate-100 rounded px-2 py-1.5 break-all select-text">
                    {appInfo.pastaDados}
                  </code>
                  <button
                    onClick={() => window.api.abrirPastaDados()}
                    className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-900 hover:underline"
                  >
                    <i className="fa-solid fa-folder-open mr-1.5"></i>Abrir pasta
                  </button>
                </dd>
              </div>
            </dl>
            <p className="text-sm text-slate-500 mt-5 bg-slate-50 border border-slate-200 rounded-md p-3">
              <i className="fa-solid fa-circle-info mr-1.5 text-brand-500"></i>
              Faça cópias de segurança com regularidade (menu{' '}
              <i className="fa-solid fa-ellipsis-vertical mx-0.5"></i> → «Fazer cópia de
              segurança»).
            </p>
            <div className="flex justify-end mt-6">
              <button autoFocus onClick={() => setAppInfo(null)} className={BTN_PRIMARIO}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL FOLHA A4 ================= */}
      {isA4ModalOpen && relatorioAtual && (
        <div
          className="fixed inset-0 bg-brand-950/90 z-[80] overflow-y-auto pb-10 print:static print:bg-white print:overflow-visible print:pb-0 print:p-0"
          onKeyDown={(e) => {
            // Ctrl+S guarda; Esc volta (pergunta se houver alterações)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
              e.preventDefault()
              handleSaveRelatorio()
            } else if (e.key === 'Escape' && !pedidoConfirmacao) {
              e.preventDefault()
              handleFecharA4()
            }
          }}
        >
          {/* Barra Superior Escura */}
          <div className="fixed top-0 left-0 right-0 bg-brand-900 text-white px-4 py-3 flex justify-between items-center gap-2 shadow-lg z-[90] print:hidden">
            <div className="flex items-center min-w-0">
              <button
                onClick={handleFecharA4}
                className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md text-[15px] font-medium mr-4 transition shrink-0"
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
              </button>
              <span className="hidden md:inline text-[15px] text-brand-100 font-semibold truncate">
                {relatorioAtual.id ? 'Editar registo existente' : 'Novo registo'}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleExportarPDF}
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-md text-[15px] font-semibold transition"
              >
                <i className="fa-solid fa-file-pdf mr-2 text-accent-300"></i>Exportar PDF
              </button>
              <button
                onClick={handleSaveRelatorio}
                title="Guardar (Ctrl+S)"
                className="bg-ok-600 hover:bg-ok-700 px-4 lg:px-6 py-2 rounded-md text-[15px] font-bold shadow transition"
              >
                <i className="fa-solid fa-floppy-disk mr-2"></i>Guardar
              </button>
            </div>
          </div>

          {/*
            O Papel A4 em si — PRINT TABLE
            Usa uma <table> verdadeira (thead/tbody/tfoot): o Chromium só repete
            o cabeçalho e reserva o espaço do rodapé em cada página com tabelas
            reais (com divs em display:table o texto ficava por baixo do rodapé).
            Em ecrã as partes da tabela são mostradas como blocos/flex normais.
          */}
          <div className="folha-a4-pagina w-[210mm] max-w-[calc(100%-1rem)] min-h-[297mm] bg-white shadow-2xl mx-auto mt-20 flex flex-col p-[12mm] lg:p-[20mm] relative">
            <table className="folha-a4 flex flex-col flex-grow w-full border-collapse">
              {/* ===== CABEÇALHO — repete em todas as páginas ===== */}
              <thead className="folha-a4-header block">
                <tr className="block">
                  <td className="block p-0">
                    <div className="text-center mb-6">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <img src={logoSimbolo} alt="" className="w-11 h-11" />
                        <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
                          Agrafametal, Lda.
                        </h1>
                      </div>
                      <div className="bg-brand-50 border-t border-b border-brand-200 py-1 mb-6 group cursor-text">
                        <p className="text-[11px] font-semibold text-slate-600 tracking-wide">
                          <span>NIF 514 304 197 — </span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => handleSaveSubtitulo(e.currentTarget.textContent)}
                            onKeyDown={handleSubtituloKeyDown}
                            className="inline-block min-w-[4rem] outline-none hover:bg-brand-100 focus:bg-white px-1"
                          >
                            {configSubtitulo}
                          </span>
                        </p>
                      </div>
                      <input
                        ref={tituloRef}
                        defaultValue={relatorioAtual.titulo}
                        type="text"
                        onKeyDown={(e) => {
                          // Enter no título passa para o texto do relatório
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            editorRef.current?.focus()
                          }
                        }}
                        onChange={(e) => setTituloTexto(e.target.value)}
                        className="w-full text-center text-lg font-bold text-brand-800 uppercase bg-transparent outline-none border-b border-dashed border-slate-300 focus:border-brand-500 pb-1 print:hidden"
                        placeholder="TÍTULO DA INTERVENÇÃO"
                      />
                      {/* Na impressão usa texto normal: o valor de um <input> não aparece
                          nas cópias do cabeçalho repetidas nas páginas seguintes */}
                      <p className="hidden print:block text-center text-lg font-bold text-brand-800 uppercase pb-1 border-b border-dashed border-slate-300">
                        {tituloTexto}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-2 tabular-nums">
                        Data: {relatorioAtual.data.split('-').reverse().join('-')}
                      </p>
                    </div>

                    {/* Barra de Ferramentas de Texto — não aparece na impressão */}
                    <div className="flex flex-wrap items-center gap-1 border border-slate-200 bg-slate-50 rounded-t-md p-1.5 shadow-sm print:hidden">
                      {[
                        ['fa-bold', 'bold', 'Negrito'],
                        ['fa-italic', 'italic', 'Itálico'],
                        ['fa-underline', 'underline', 'Sublinhado'],
                        null,
                        ['fa-align-left', 'justifyLeft', 'Alinhar à esquerda'],
                        ['fa-align-center', 'justifyCenter', 'Centrar'],
                        ['fa-align-right', 'justifyRight', 'Alinhar à direita'],
                        null,
                        ['fa-list-ul', 'insertUnorderedList', 'Lista com marcas'],
                        ['fa-list-ol', 'insertOrderedList', 'Lista numerada'],
                        null
                      ].map((b, i) =>
                        b ? (
                          <button
                            key={b[1]}
                            title={b[2]}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyCmd(b[1])}
                            className="w-9 h-9 rounded text-slate-600 hover:bg-slate-200 hover:text-brand-700 transition"
                          >
                            <i className={`fa-solid ${b[0]}`}></i>
                          </button>
                        ) : (
                          <div key={`sep${i}`} className="w-px h-5 bg-slate-300 mx-1"></div>
                        )
                      )}
                      {[
                        ['✓', 'text-ok-600', 'Inserir visto'],
                        ['➤', 'text-brand-600', 'Inserir seta'],
                        ['✗', 'text-danger-600', 'Inserir cruz']
                      ].map(([simbolo, cor, titulo]) => (
                        <button
                          key={simbolo}
                          title={titulo}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => inserirSimbolo(simbolo)}
                          className={`w-9 h-9 rounded ${cor} hover:bg-slate-200 transition font-bold`}
                        >
                          {simbolo}
                        </button>
                      ))}
                      <button
                        title="Aumentar avanço"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyCmd('indent')}
                        className="w-9 h-9 rounded text-slate-600 hover:bg-slate-200 transition"
                      >
                        <i className="fa-solid fa-indent"></i>
                      </button>
                      <button
                        title="Diminuir avanço"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyCmd('outdent')}
                        className="w-9 h-9 rounded text-slate-600 hover:bg-slate-200 transition"
                      >
                        <i className="fa-solid fa-outdent"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </thead>

              {/* ===== CORPO — flui livremente entre páginas ===== */}
              <tbody className="folha-a4-body flex flex-col flex-grow border border-t-0 border-slate-200 print:border-0">
                <tr className="flex flex-col flex-grow">
                  <td className="block flex-grow relative p-0 min-h-[80mm]">
                    <div
                      ref={editorRef}
                      className="absolute inset-0 p-4 text-[14px] leading-relaxed text-slate-900 outline-none overflow-y-auto print:static print:h-auto print:overflow-visible print:p-0 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ol]:list-decimal"
                      contentEditable
                      suppressContentEditableWarning
                      onKeyDown={handleEditorKeyDown}
                    ></div>
                  </td>
                </tr>
              </tbody>

              {/*
              ===== ESPAÇADOR DO RODAPÉ =====
              Invisível em ecrã. Em impressão vira table-footer-group:
              reserva o espaço exato do rodapé real em cada página para
              o texto nunca lhe bater por cima. Ajusta o h-[40mm] se
              o rodapé real (moradas + texto legal) mudar de tamanho.
            */}
              <tfoot className="hidden folha-a4-footer-spacer">
                <tr>
                  <td className="p-0">
                    <div className="h-[40mm]"></div>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/*
              ===== RODAPÉ REAL =====
              Em ecrã: fica colado ao fundo da folha (mt-auto).
              Em impressão: torna-se fixed e repete-se fisicamente
              no fundo de TODAS as páginas (ver .folha-a4-footer-real
              no main.css).
            */}
            <div className="folha-a4-footer-real mt-auto pt-4 border-t-2 border-brand-900">
              <div className="flex justify-between text-[10px] font-bold text-slate-800 mb-4">
                <div className="w-1/2">
                  <p className="italic mb-1 text-[11px] text-slate-500">Morada:</p>
                  <p>Rua Novos Mares, 28</p>
                  <p>3830-660 Gafanha da Nazaré</p>
                  <p>Telm - 962 303 861 - 935 990 243</p>
                </div>
                <div className="w-1/2 text-right">
                  <p className="italic mb-1 text-[11px] text-slate-500">Oficina:</p>
                  <p>Travessa D. Duarte, 4</p>
                  <p>3830 - 743 Gafanha da Nazaré</p>
                </div>
              </div>
              <p className="text-[8px] text-justify text-slate-500 leading-tight">
                Todas as Máquinas, independentemente do tipo ou fabricante, têm peças de desgaste
                que é necessário substituir regularmente, para manter um bom nível de fiabilidade e
                eficiência energética do equipamento, minimizando assim os custos de manutenção.
              </p>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal pedido={pedidoConfirmacao} onResponder={responderConfirmacao} />

      {/* ================= TOAST (NOTIFICAÇÃO) ================= */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[110] max-w-[min(32rem,calc(100%-3rem))] px-4 py-3 rounded-lg shadow-xl text-white text-[15px] font-semibold flex items-center gap-3 animar-entrada print:hidden ${
            toast.tipo === 'erro' ? 'bg-danger-600' : 'bg-brand-900'
          }`}
        >
          <i
            className={`fa-solid ${toast.tipo === 'erro' ? 'fa-triangle-exclamation' : 'fa-circle-check text-ok-400'}`}
          ></i>
          <span className="break-words min-w-0">{toast.mensagem}</span>
        </div>
      )}
    </div>
  )
}
