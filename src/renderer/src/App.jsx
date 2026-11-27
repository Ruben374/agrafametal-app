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

// Data de hoje no fuso horário do PC, no formato do <input type="date"> (AAAA-MM-DD)
const hojeLocal = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
// AAAA-MM-DD -> DD-MM-AAAA
const formatarData = (data) => (data ? data.split('-').reverse().join('-') : '—')
// Tira o prefixo técnico que o Electron junta às mensagens de erro do processo principal
const limparErro = (error) =>
  String(error?.message ?? error).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

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
function CampoChapa({
  valor,
  onGuardar,
  className = '',
  placeholder = '—',
  ariaLabel,
  bloqueado = false
}) {
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
      readOnly={bloqueado}
      tabIndex={bloqueado ? -1 : 0}
      onBlur={(e) => !bloqueado && onGuardar(e.currentTarget.value)}
      className={`bg-transparent outline-none placeholder:text-slate-500 tabular-nums ${bloqueado ? 'cursor-default' : 'cursor-text'} ${className}`}
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
              className={`fa-solid ${pedido.perigo ? 'fa-triangle-exclamation' : pedido.soOk ? 'fa-circle-info' : 'fa-circle-question'} text-lg`}
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
          {!pedido.soOk && (
            <button onClick={() => onResponder(false)} className={BTN_SECUNDARIO}>
              Cancelar
            </button>
          )}
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
  onCancelar,
  senha, // se vier definido, mostra o campo "Senha"
  onChangeSenha
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
        {senha !== undefined && (
          <>
            <label className="block text-sm font-semibold text-slate-600 mt-4 mb-1.5">
              <i className="fa-solid fa-lock mr-1.5 text-slate-400"></i>Senha
            </label>
            <input
              type="password"
              value={senha}
              autoComplete="off"
              onChange={(e) => onChangeSenha(e.target.value)}
              aria-label="Senha"
              className={INPUT}
            />
          </>
        )}
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

/* Pede a senha antes de uma alteração/eliminação.
   pedido = { titulo, mensagem, textoBotao, perigo, acao(senha) }
   A ação é feita aqui dentro: se a senha estiver errada, o erro aparece no próprio
   modal e o utilizador pode tentar outra vez. Enter confirma, Esc / clique fora cancela. */
function ModalSenha({ pedido, onConcluir }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aProcessar, setAProcessar] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const confirmar = async () => {
    if (aProcessar) return
    if (!senha) {
      setErro('Introduza a senha.')
      inputRef.current?.focus()
      return
    }
    setAProcessar(true)
    try {
      await pedido.acao(senha)
      onConcluir(true)
    } catch (error) {
      setErro(limparErro(error))
      setSenha('')
      setAProcessar(false)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  return (
    <div
      className="fixed inset-0 modal-backdrop z-[100] flex items-center justify-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onConcluir(false)}
      onMouseDown={(e) => e.target === e.currentTarget && onConcluir(false)}
    >
      <form
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animar-entrada"
        role="alertdialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <div className="flex gap-4">
          <div
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${pedido.perigo ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-700'}`}
          >
            <i
              className={`fa-solid ${pedido.perigo ? 'fa-triangle-exclamation' : 'fa-lock'} text-lg`}
            ></i>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{pedido.titulo}</h3>
            <p className="text-base text-slate-700 whitespace-pre-line break-words">
              {pedido.mensagem}
            </p>
            <label className="block text-sm font-semibold text-slate-600 mt-4 mb-1.5">Senha</label>
            <input
              ref={inputRef}
              type="password"
              value={senha}
              autoComplete="off"
              aria-label="Senha"
              onChange={(e) => {
                setSenha(e.target.value)
                setErro('')
              }}
              className={INPUT}
            />
            {erro && (
              <p role="alert" className="text-danger-600 text-sm font-semibold mt-2">
                <i className="fa-solid fa-circle-exclamation mr-1.5"></i>
                {erro}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={() => onConcluir(false)} className={BTN_SECUNDARIO}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={aProcessar}
            className={`${pedido.perigo ? BTN_PERIGO : BTN_PRIMARIO} disabled:opacity-60`}
          >
            {pedido.textoBotao || 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* Alterar a senha: senha atual + nova senha (duas vezes) */
function ModalAlterarSenha({ onFechar, onSucesso }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const atualRef = useRef(null)

  useEffect(() => {
    setTimeout(() => atualRef.current?.focus(), 50)
  }, [])

  const gravar = async () => {
    if (!atual) return setErro('Introduza a senha atual.')
    if (nova.length < 6) return setErro('A nova senha tem de ter pelo menos 6 caracteres.')
    if (nova !== confirmar) return setErro('A confirmação não coincide com a nova senha.')
    try {
      await window.api.alterarSenha(atual, nova)
      onSucesso()
    } catch (error) {
      setErro(limparErro(error))
    }
  }

  const campo = (rotulo, valor, setValor, ref) => (
    <>
      <label className="block text-sm font-semibold text-slate-600 mt-4 mb-1.5">{rotulo}</label>
      <input
        ref={ref}
        type="password"
        value={valor}
        autoComplete="off"
        aria-label={rotulo}
        onChange={(e) => {
          setValor(e.target.value)
          setErro('')
        }}
        className={INPUT}
      />
    </>
  )

  return (
    <div
      className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <form
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animar-entrada"
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault()
          gravar()
        }}
      >
        <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
          <i className="fa-solid fa-key text-brand-600"></i>Alterar senha
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          A senha é pedida para alterar ou apagar dados.
        </p>
        {campo('Senha atual', atual, setAtual, atualRef)}
        {campo('Nova senha (mínimo 6 caracteres)', nova, setNova)}
        {campo('Confirmar nova senha', confirmar, setConfirmar)}
        {erro && (
          <p role="alert" className="text-danger-600 text-sm font-semibold mt-3">
            <i className="fa-solid fa-circle-exclamation mr-1.5"></i>
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onFechar} className={BTN_SECUNDARIO}>
            Cancelar
          </button>
          <button type="submit" className={BTN_PRIMARIO}>
            Guardar nova senha
          </button>
        </div>
      </form>
    </div>
  )
}

/* ===== FOLHA A4 (desenho original) =====
   Rodapé comum à folha no ecrã e à folha só para impressão.
   Em ecrã fica colado ao fundo da folha (mt-auto); em impressão torna-se fixed e
   repete-se no fundo de TODAS as páginas (ver .folha-a4-footer-real no main.css). */
function RodapeFolha() {
  return (
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
        Todas as Máquinas, independentemente do tipo ou fabricante, têm peças de desgaste que é
        necessário substituir regularmente, para manter um bom nível de fiabilidade e eficiência
        energética do equipamento, minimizando assim os custos de manutenção.
      </p>
    </div>
  )
}

/* Folha só para impressão (usada pelo ícone "Imprimir" da lista de registos).
   Invisível no ecrã; na impressão sai exatamente igual à folha aberta. */
function FolhaImpressao({ rel, subtitulo }) {
  return (
    <div className="hidden print:block">
      <div className="folha-a4-pagina folha-original w-[210mm] min-h-[297mm] bg-white mx-auto flex flex-col p-[20mm] relative">
        <table className="folha-a4 flex flex-col flex-grow w-full border-collapse">
          <thead className="folha-a4-header block">
            <tr className="block">
              <td className="block p-0">
                <div className="text-center mb-6">
                  <h1 className="text-3xl font-extrabold text-gray-900 mb-1">Agrafametal, Lda.</h1>
                  <div className="bg-blue-50 border-t border-b border-blue-200 py-1 mb-6">
                    <p className="text-[11px] font-semibold text-gray-600 tracking-wide">
                      <span>NIF 514 304 197 — </span>
                      <span className="inline-block min-w-[4rem] px-1">{subtitulo}</span>
                    </p>
                  </div>
                  <p className="text-center text-lg font-bold text-blue-900 uppercase pb-1 border-b border-dashed border-gray-300">
                    {rel.titulo}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2">Data: {formatarData(rel.data)}</p>
                </div>
              </td>
            </tr>
          </thead>
          <tbody className="folha-a4-body flex flex-col flex-grow border border-t-0 border-gray-200 print:border-0">
            <tr className="flex flex-col flex-grow">
              <td className="block flex-grow relative p-0">
                <div
                  className="report-editor text-[13px] leading-relaxed text-gray-800 p-0 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ol]:list-decimal"
                  dangerouslySetInnerHTML={{ __html: rel.corpo || '' }}
                ></div>
              </td>
            </tr>
          </tbody>
          <tfoot className="hidden folha-a4-footer-spacer">
            <tr>
              <td className="p-0">
                <div className="h-[40mm]"></div>
              </td>
            </tr>
          </tfoot>
        </table>
        <RodapeFolha />
      </div>
    </div>
  )
}

/* ===== TIPOS DE MANUTENÇÃO (etiqueta colorida) ===== */
const TIPOS_MANUTENCAO = ['Preventiva', 'Corretiva', 'Inspeção', 'Instalação', 'Outro']
const COR_TIPO = {
  Preventiva: 'bg-brand-50 text-brand-700 border-brand-200',
  Corretiva: 'bg-accent-50 text-accent-700 border-accent-200',
  Inspeção: 'bg-ok-50 text-ok-700 border-ok-200',
  Instalação: 'bg-slate-100 text-slate-700 border-slate-300'
}
function BadgeTipo({ tipo }) {
  if (!tipo) return null
  return (
    <span
      className={`inline-block shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${COR_TIPO[tipo] || 'bg-slate-100 text-slate-600 border-slate-300'}`}
    >
      {tipo}
    </span>
  )
}

// Botão redondo «+» ao lado do título da página
function BotaoMais({ titulo, onClick }) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className="shrink-0 w-10 h-10 rounded-full bg-brand-700 hover:bg-brand-800 text-white shadow-md flex items-center justify-center transition"
    >
      <i className="fa-solid fa-plus text-lg"></i>
    </button>
  )
}

const formatarTamanho = (bytes) => {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
const formatarDataHora = (ms) =>
  new Date(ms).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const iconeFicheiro = (nome, pasta) => {
  if (pasta) return 'fa-folder text-accent-500'
  const ext = nome.split('.').pop().toLowerCase()
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) return 'fa-file-excel text-ok-600'
  if (ext === 'pdf') return 'fa-file-pdf text-danger-600'
  if (['doc', 'docx', 'odt', 'txt'].includes(ext)) return 'fa-file-word text-brand-600'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic'].includes(ext))
    return 'fa-file-image text-accent-600'
  return 'fa-file text-slate-400'
}

/* ===== VISTA DA EMPRESA: os 12 meses do ano =====
   Todos os meses aparecem sempre. Mês passado sem registos (de qualquer máquina
   da empresa) fica a vermelho; mês atual sem registos fica "em curso"; meses futuros
   e meses antes de a empresa existir na aplicação ficam neutros. */
function VistaEmpresa({ empresa, versao, onAbrirRegisto, onErro }) {
  const hoje = hojeLocal()
  const anoAtual = Number(hoje.slice(0, 4))
  const mesAtual = Number(hoje.slice(5, 7))
  const [ano, setAno] = useState(anoAtual)
  const [resumo, setResumo] = useState(null)
  const [mesSel, setMesSel] = useState(mesAtual)
  const [registos, setRegistos] = useState([])
  const [ordem, setOrdem] = useState({ coluna: 'data', asc: false })

  // Mudar de empresa: volta ao ano e mês atuais
  const [empresaAnterior, setEmpresaAnterior] = useState(empresa.id)
  if (empresaAnterior !== empresa.id) {
    setEmpresaAnterior(empresa.id)
    setAno(anoAtual)
    setMesSel(mesAtual)
  }

  useEffect(() => {
    let ativo = true
    window.api
      .getResumoMensal(empresa.id, ano)
      .then((r) => ativo && setResumo(r))
      .catch((e) => onErro(limparErro(e)))
    return () => {
      ativo = false
    }
  }, [empresa.id, ano, versao]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ativo = true
    window.api
      .getRegistosMes(empresa.id, ano, mesSel)
      .then((r) => ativo && setRegistos(r))
      .catch((e) => onErro(limparErro(e)))
    return () => {
      ativo = false
    }
  }, [empresa.id, ano, mesSel, versao]) // eslint-disable-line react-hooks/exhaustive-deps

  const mudarAno = (delta) => {
    const novo = ano + delta
    setAno(novo)
    setMesSel(novo === anoAtual ? mesAtual : 12)
  }

  const estadoMes = (mes) => {
    const total = resumo?.meses[mes - 1] ?? 0
    if (total > 0) return 'feito'
    const chave = `${ano}-${String(mes).padStart(2, '0')}`
    if (ano > anoAtual || (ano === anoAtual && mes > mesAtual)) return 'futuro'
    if (resumo && chave < resumo.criadaEm.slice(0, 7)) return 'antes'
    if (ano === anoAtual && mes === mesAtual) return 'curso'
    return 'falta'
  }

  const ESTILO_MES = {
    feito: 'bg-ok-50 border-ok-200 text-ok-700 hover:border-ok-400',
    falta: 'bg-danger-50 border-danger-300 border-dashed text-danger-700 hover:border-danger-500',
    curso: 'bg-warn-50 border-warn-300 text-warn-600 hover:border-accent-400',
    futuro: 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300',
    antes: 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
  }
  const ICONE_MES = {
    feito: 'fa-folder-open',
    falta: 'fa-folder-minus',
    curso: 'fa-folder',
    futuro: 'fa-folder',
    antes: 'fa-folder'
  }
  const textoMes = (estado, total) =>
    estado === 'feito'
      ? `${total} ${total === 1 ? 'registo' : 'registos'}`
      : estado === 'falta'
        ? 'Sem registos'
        : estado === 'curso'
          ? 'Em curso'
          : '—'

  const colunas = [
    ['id', 'Nº'],
    ['data', 'Data'],
    ['maquina_nome', 'Máquina'],
    ['tipo_manutencao', 'Tipo'],
    ['tecnico', 'Técnico'],
    ['titulo', 'Título']
  ]
  const ordenados = useMemo(() => {
    const lista = [...registos]
    const { coluna, asc } = ordem
    lista.sort((a, b) => {
      const va = a[coluna] ?? ''
      const vb = b[coluna] ?? ''
      const r =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : collator.compare(String(va), String(vb))
      return asc ? r : -r
    })
    return lista
  }, [registos, ordem])

  const ordenarPor = (coluna) =>
    setOrdem((o) => ({ coluna, asc: o.coluna === coluna ? !o.asc : coluna !== 'data' }))

  const emFalta = resumo
    ? Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => estadoMes(m) === 'falta').length
    : 0

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-calendar-days text-accent-500"></i>Manutenções por mês
          </h3>
          <div className="flex items-center gap-1" role="group" aria-label="Ano">
            <button
              onClick={() => mudarAno(-1)}
              disabled={!resumo || ano <= resumo.anoMin}
              title="Ano anterior"
              aria-label="Ano anterior"
              className="w-9 h-9 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <span className="w-16 text-center text-lg font-bold tabular-nums text-slate-900">
              {ano}
            </span>
            <button
              onClick={() => mudarAno(1)}
              disabled={ano >= anoAtual}
              title="Ano seguinte"
              aria-label="Ano seguinte"
              className="w-9 h-9 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-2.5">
          {MESES.map((nome, i) => {
            const mes = i + 1
            const estado = estadoMes(mes)
            const total = resumo?.meses[i] ?? 0
            const selecionado = mes === mesSel
            return (
              <button
                key={nome}
                onClick={() => setMesSel(mes)}
                aria-pressed={selecionado}
                title={
                  estado === 'falta' ? `${nome} ${ano}: sem registos de manutenção` : undefined
                }
                className={`text-left rounded-lg border-2 px-3 py-2.5 transition ${ESTILO_MES[estado]} ${selecionado ? 'ring-2 ring-brand-500 ring-offset-1' : ''}`}
              >
                <div className="flex items-center gap-2 font-semibold text-[15px]">
                  <i className={`fa-solid ${ICONE_MES[estado]} text-sm`}></i>
                  <span className="truncate">{nome}</span>
                </div>
                <div className="text-xs font-medium mt-0.5 tabular-nums">
                  {textoMes(estado, total)}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-xs text-slate-500">
          <span>
            <i className="fa-solid fa-square text-ok-200 mr-1.5"></i>Com registos
          </span>
          <span>
            <i className="fa-solid fa-square text-danger-200 mr-1.5"></i>Mês sem registos
          </span>
          <span>
            <i className="fa-solid fa-square text-warn-100 mr-1.5"></i>Mês atual (em curso)
          </span>
          <span>
            <i className="fa-solid fa-square text-slate-200 mr-1.5"></i>Futuro / antes de a empresa
            ser registada
          </span>
          {emFalta > 0 && (
            <span className="ml-auto font-semibold text-danger-700">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
              {emFalta} {emFalta === 1 ? 'mês' : 'meses'} sem registos em {ano}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-folder-open text-accent-500"></i>
          {MESES[mesSel - 1]} {ano}
        </h3>
        {ordenados.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <i className="fa-solid fa-file-circle-xmark text-3xl mb-3 text-slate-300"></i>
            <p className="text-base">Nenhuma máquina desta empresa tem registos neste mês.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-[14px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {colunas.map(([chave, titulo]) => (
                      <th
                        key={chave}
                        className="text-left font-semibold px-3 py-2 whitespace-nowrap"
                      >
                        <button
                          onClick={() => ordenarPor(chave)}
                          className="inline-flex items-center gap-1.5 hover:text-slate-900"
                        >
                          {titulo}
                          <i
                            className={`fa-solid text-[10px] ${ordem.coluna === chave ? (ordem.asc ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort text-slate-300'}`}
                          ></i>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((r) => (
                    <tr
                      key={r.id}
                      onDoubleClick={() => onAbrirRegisto(r)}
                      className="border-t border-slate-100 hover:bg-brand-50 cursor-default"
                    >
                      <td className="px-3 py-2 tabular-nums">
                        <button
                          onClick={() => onAbrirRegisto(r)}
                          className="font-semibold text-brand-600 hover:text-brand-800 hover:underline"
                        >
                          {String(r.id).padStart(5, '0')}
                        </button>
                      </td>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                        {formatarData(r.data)}
                      </td>
                      <td className="px-3 py-2 max-w-[12rem] truncate" title={r.maquina_nome}>
                        {r.maquina_nome}
                      </td>
                      <td className="px-3 py-2">
                        <BadgeTipo tipo={r.tipo_manutencao} />
                      </td>
                      <td className="px-3 py-2 max-w-[9rem] truncate">{r.tecnico || '—'}</td>
                      <td className="px-3 py-2 max-w-[18rem] truncate" title={r.titulo}>
                        {r.titulo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-500 mt-2 tabular-nums">
              {ordenados.length} {ordenados.length === 1 ? 'registo' : 'registos'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/* ===== DOCUMENTOS DO REGISTO (pasta no disco + folha de custos) ===== */
function SecaoDocumentos({ registoId, versao, pedirSenha, mostrarToast }) {
  const [info, setInfo] = useState(null)
  const [aTrabalhar, setATrabalhar] = useState(false)

  const carregar = async () => {
    if (!registoId) return
    try {
      setInfo(await window.api.listarDocumentos(registoId))
    } catch (e) {
      mostrarToast(limparErro(e), 'erro')
    }
  }

  useEffect(() => {
    if (!registoId) return
    let ativo = true
    window.api
      .listarDocumentos(registoId)
      .then((r) => ativo && setInfo(r))
      .catch((e) => mostrarToast(limparErro(e), 'erro'))
    return () => {
      ativo = false
    }
  }, [registoId, versao]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ao voltar à janela (ex.: depois de gravar no Excel) atualiza a lista
  useEffect(() => {
    const aoFocar = () => carregar()
    window.addEventListener('focus', aoFocar)
    return () => window.removeEventListener('focus', aoFocar)
  }, [registoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const executar = async (fn) => {
    if (aTrabalhar) return
    setATrabalhar(true)
    try {
      await fn()
    } catch (e) {
      mostrarToast(limparErro(e), 'erro')
    } finally {
      setATrabalhar(false)
      carregar()
    }
  }

  const folha = () =>
    executar(async () => {
      const r = await window.api.folhaCustos(registoId)
      if (r.aviso) mostrarToast(r.aviso, 'aviso')
      else if (r.criada)
        mostrarToast(
          r.usouModelo
            ? 'Folha de custos criada a partir do modelo (modelo_custos.xlsx)'
            : 'Folha de custos criada',
          'sucesso'
        )
    })
  const adicionar = () =>
    executar(async () => {
      const r = await window.api.adicionarDocumentos(registoId)
      if (r.adicionados)
        mostrarToast(
          r.adicionados === 1 ? 'Documento adicionado' : `${r.adicionados} documentos adicionados`,
          'sucesso'
        )
    })
  const abrirPasta = () => executar(() => window.api.abrirPastaRegisto(registoId))
  const abrir = (nome) => executar(() => window.api.abrirDocumento(registoId, nome))
  const remover = async (nome) => {
    const ok = await pedirSenha({
      titulo: 'Remover documento',
      mensagem: `Remover «${nome}» deste registo?\nO ficheiro é movido para a pasta «registos\\_eliminados».`,
      textoBotao: 'Remover',
      perigo: true,
      acao: (senha) => window.api.removerDocumento(registoId, nome, senha)
    })
    if (ok) {
      mostrarToast('Documento removido', 'sucesso')
      carregar()
    }
  }

  const ficheiros = info?.ficheiros ?? []
  const BTN = `${BTN_SECUNDARIO} border border-slate-300 bg-white py-2 text-sm disabled:opacity-50`

  if (!registoId) {
    return (
      <p className="text-sm text-slate-500">
        <i className="fa-solid fa-circle-info mr-1.5 text-brand-500"></i>
        Grave o registo («Aplicar» ou «Gravar») para poder anexar documentos e criar a folha de
        custos.
      </p>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={folha}
          disabled={aTrabalhar}
          className={`${BTN_PRIMARIO} py-2 text-sm disabled:opacity-50`}
        >
          <i className="fa-solid fa-file-excel"></i>
          {info?.folhaCustos ? 'Abrir folha de custos' : 'Criar folha de custos'}
        </button>
        <button onClick={adicionar} disabled={aTrabalhar} className={BTN}>
          <i className="fa-solid fa-paperclip"></i>Adicionar ficheiros…
        </button>
        <button onClick={abrirPasta} disabled={aTrabalhar} className={BTN}>
          <i className="fa-solid fa-folder-open"></i>Abrir pasta
        </button>
      </div>
      {ficheiros.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-md px-3 py-3">
          Ainda não há documentos neste registo.
        </p>
      ) : (
        <ul className="border border-slate-200 rounded-md divide-y divide-slate-100">
          {ficheiros.map((f) => (
            <li
              key={f.nome}
              className="flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-slate-50 group/doc"
              onDoubleClick={() => abrir(f.nome)}
            >
              <i className={`fa-solid ${iconeFicheiro(f.nome, f.pasta)} w-4 text-center`}></i>
              <button
                onClick={() => abrir(f.nome)}
                className="flex-1 min-w-0 truncate text-left text-slate-800 hover:text-brand-700 hover:underline"
                title={f.nome}
              >
                {f.nome}
              </button>
              <span className="text-slate-400 tabular-nums w-16 text-right shrink-0">
                {formatarTamanho(f.tamanho)}
              </span>
              <span className="text-slate-400 tabular-nums w-32 text-right shrink-0 hidden md:block">
                {formatarDataHora(f.modificado)}
              </span>
              <button
                onClick={() => remover(f.nome)}
                title="Remover (pede a senha)"
                aria-label={`Remover ${f.nome}`}
                className="opacity-40 group-hover/doc:opacity-100 focus:opacity-100 w-8 h-8 rounded text-slate-500 hover:text-danger-600 hover:bg-danger-50 shrink-0"
              >
                <i className="fa-solid fa-trash text-xs"></i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ===== CONFIGURAÇÃO DE CUSTOS (valores por defeito das folhas novas) ===== */
const CAMPOS_CUSTOS = [
  ['custo_preco_hora', 'Preço por hora (mão de obra)', '€/h'],
  ['custo_perc_extra', 'Acréscimo das horas extra', '%'],
  ['custo_preco_hora_oficina', 'Preço por hora (oficina)', '€/h'],
  ['custo_preco_hora_viagem', 'Preço por hora de viagem', '€/h'],
  ['custo_preco_km', 'Preço por quilómetro', '€/km'],
  ['custo_perc_urgencia', 'Taxa de urgência', '%'],
  ['custo_iva', 'IVA', '%']
]
function ModalConfigCustos({ onFechar, onSucesso }) {
  const [valores, setValores] = useState(null)
  const [temModelo, setTemModelo] = useState(false)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)

  useEffect(() => {
    window.api
      .getConfigCustos()
      .then(({ temModelo, ...v }) => {
        setTemModelo(temModelo)
        setValores(
          Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n).replace('.', ',')]))
        )
      })
      .catch((e) => setErro(limparErro(e)))
  }, [])

  const gravar = async () => {
    if (aGravar) return
    if (!senha) return setErro('Introduza a senha.')
    setAGravar(true)
    try {
      await window.api.setConfigCustos(valores, senha)
      onSucesso()
    } catch (e) {
      setErro(limparErro(e))
      setSenha('')
      setAGravar(false)
    }
  }

  return (
    <div
      className="fixed inset-0 modal-backdrop z-[60] flex items-center justify-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onFechar()}
      onMouseDown={(e) => e.target === e.currentTarget && onFechar()}
    >
      <form
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 animar-entrada max-h-[calc(100vh-2rem)] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault()
          gravar()
        }}
      >
        <h3 className="font-bold text-xl text-slate-900 flex items-center gap-2">
          <i className="fa-solid fa-calculator text-brand-600"></i>Configuração de custos
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Valores que aparecem já preenchidos nas folhas de custos novas. As folhas já criadas não
          mudam.
        </p>
        {temModelo && (
          <p className="text-sm text-brand-800 bg-brand-50 border border-brand-100 rounded-md p-3 mt-3">
            <i className="fa-solid fa-file-excel mr-1.5"></i>
            Está a ser usado o modelo próprio <b>modelo_custos.xlsx</b> (pasta de dados). Estes
            valores só entram nas células do modelo que tenham o nome certo.
          </p>
        )}
        {!valores ? (
          <p className="text-slate-500 mt-5">A carregar…</p>
        ) : (
          <div className="mt-4 space-y-3">
            {CAMPOS_CUSTOS.map(([chave, rotulo, unidade]) => (
              <label key={chave} className="flex items-center gap-3">
                <span className="flex-1 min-w-0 text-[15px] text-slate-700">{rotulo}</span>
                <input
                  value={valores[chave]}
                  inputMode="decimal"
                  onChange={(e) => {
                    setValores((v) => ({ ...v, [chave]: e.target.value }))
                    setErro('')
                  }}
                  className={`${INPUT.replace('w-full ', '')} w-28 shrink-0 text-right tabular-nums py-2`}
                />
                <span className="w-10 shrink-0 text-sm text-slate-500">{unidade}</span>
              </label>
            ))}
          </div>
        )}
        <label className="block text-sm font-semibold text-slate-600 mt-5 mb-1.5">
          <i className="fa-solid fa-lock mr-1.5 text-slate-400"></i>Senha
        </label>
        <input
          type="password"
          value={senha}
          autoComplete="off"
          aria-label="Senha"
          onChange={(e) => {
            setSenha(e.target.value)
            setErro('')
          }}
          className={INPUT}
        />
        {erro && (
          <p role="alert" className="text-danger-600 text-sm font-semibold mt-2">
            <i className="fa-solid fa-circle-exclamation mr-1.5"></i>
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onFechar} className={BTN_SECUNDARIO}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valores || aGravar}
            className={`${BTN_PRIMARIO} disabled:opacity-60`}
          >
            Guardar
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
  const [senhaRenomear, setSenhaRenomear] = useState('')

  // Senha / edição protegida
  const [chapaDesbloqueada, setChapaDesbloqueada] = useState(null) // id da máquina desbloqueada
  const [isAlterarSenhaOpen, setAlterarSenhaOpen] = useState(false)
  const [isConfigCustosOpen, setConfigCustosOpen] = useState(false)

  // Onde estão os dados (sempre visível no rodapé da barra lateral)
  const [infoDados, setInfoDados] = useState(null)
  const [ocupado, setOcupado] = useState(null) // texto do aviso «a trabalhar…»
  const [versaoRegistos, setVersaoRegistos] = useState(0) // atualiza a vista da empresa
  const voltarEmpresaRef = useRef(false) // registo aberto a partir da vista da empresa

  // Folha A4: modo, data escolhida pelo utilizador e impressão a partir da lista
  const [modoFolha, setModoFolha] = useState('novo') // 'novo' | 'leitura' | 'edicao'
  const [dataRegisto, setDataRegisto] = useState('')
  const [tecnicoRegisto, setTecnicoRegisto] = useState('')
  const [tipoRegisto, setTipoRegisto] = useState('Preventiva')
  const [relImprimir, setRelImprimir] = useState(null)
  const dataRef = useRef(null)
  const subtituloRef = useRef(null)

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
    toastTimerRef.current = setTimeout(() => setToast(null), tipo === 'sucesso' ? 3500 : 7000)
  }

  // Confirmações (substituem o window.confirm)
  const [pedidoConfirmacao, setPedidoConfirmacao] = useState(null)
  const pedirConfirmacao = (mensagem, opcoes = {}) =>
    new Promise((resolve) => setPedidoConfirmacao({ mensagem, ...opcoes, resolve }))
  const responderConfirmacao = (resposta) => {
    pedidoConfirmacao?.resolve(resposta)
    setPedidoConfirmacao(null)
  }

  // Pedidos de senha (alterar / apagar): resolve true quando a ação foi feita
  const [pedidoSenha, setPedidoSenha] = useState(null)
  const pedidoSenhaIdRef = useRef(0)
  const pedirSenha = (opcoes) =>
    new Promise((resolve) => {
      pedidoSenhaIdRef.current += 1
      setPedidoSenha({ ...opcoes, id: pedidoSenhaIdRef.current, resolve })
    })
  const concluirPedidoSenha = (resultado) => {
    pedidoSenha?.resolve(resultado)
    setPedidoSenha(null)
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
      try {
        const info = await window.api.getAppInfo()
        if (!ativo) return
        setInfoDados(info)
        if (info.bdNova) {
          setPedidoConfirmacao({
            titulo: 'Base de dados nova',
            mensagem: `Foi criada uma base de dados nova (sem dados) em:\n${info.pastaDados}\n\nSe esperava ver os seus dados, feche a aplicação e confirme que está a abrir o programa certo, com a pasta «dados» ao lado.`,
            textoBotao: 'OK',
            soOk: true,
            resolve: () => {}
          })
        }
      } catch {
        // não é crítico
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
      // registo novo: primeiro a data; registo existente abre só para leitura
      if (!relatorioAtual.id) {
        setTimeout(() => (relatorioAtual.data ? editorRef : dataRef).current?.focus(), 100)
      }
    }
  }, [isA4ModalOpen, relatorioAtual])

  // Imprimir a partir da lista: espera a folha de impressão ser montada e abre a impressão
  useEffect(() => {
    if (!relImprimir) return
    const t = setTimeout(async () => {
      try {
        const r = await window.api.imprimir()
        if (!r.sucesso && r.motivo && r.motivo !== 'cancelled') {
          mostrarToast('Não foi possível imprimir: ' + r.motivo, 'erro')
        }
      } catch (error) {
        mostrarToast('Erro ao imprimir: ' + limparErro(error), 'erro')
      } finally {
        setRelImprimir(null)
      }
    }, 80)
    return () => clearTimeout(t)
  }, [relImprimir])

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
      const nova = await window.api.addEmpresa(novaEmpresaNome)
      setNovaEmpresaNome('')
      setEmpresaModalOpen(false)
      await carregarDados()
      selecionarEmpresa(nova.id)
      if (nova.aviso) mostrarToast(nova.aviso, 'aviso')
      else mostrarToast('Empresa adicionada', 'sucesso')
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

  // --- Renomear / remover empresa (pedem senha) ---
  const abrirRenomearEmpresa = (empresa) => {
    setEmpresaRenomear({ id: empresa.id, nome: empresa.nome })
    setNomeRenomear(empresa.nome)
    setSenhaRenomear('')
    setErroRenomear('')
  }

  const fecharRenomearEmpresa = () => {
    setEmpresaRenomear(null)
    setErroRenomear('')
    setNomeRenomear('')
    setSenhaRenomear('')
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
    if (!senhaRenomear) {
      setErroRenomear('Introduza a senha.')
      return
    }
    if (aGravarRef.current) return
    aGravarRef.current = true
    try {
      const r = await window.api.updateEmpresa(empresaRenomear.id, nome, senhaRenomear)
      fecharRenomearEmpresa()
      await carregarDados()
      if (r?.aviso) mostrarToast(r.aviso, 'aviso')
      else mostrarToast('Empresa renomeada', 'sucesso')
    } catch (error) {
      setErroRenomear(limparErro(error))
      setSenhaRenomear('')
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
    const ok = await pedirSenha({
      titulo: 'Remover empresa',
      mensagem,
      textoBotao: 'Remover empresa',
      perigo: true,
      acao: (senha) => window.api.deleteEmpresa(empresa.id, senha)
    })
    if (!ok) return
    if (activeCompanyId === empresa.id) {
      trancarChapa()
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
  }

  const handleDeleteMaquina = async () => {
    const id = activeMachineId
    const ok = await pedirSenha({
      titulo: 'Remover máquina',
      mensagem: `Remover a máquina «${activeMachine?.nome}» e todos os seus registos? Esta ação não pode ser desfeita.`,
      textoBotao: 'Remover máquina',
      perigo: true,
      acao: (senha) => window.api.deleteMaquina(id, senha)
    })
    if (!ok) return
    trancarChapa()
    setActiveMachineId(null)
    setActiveCompanyId(null)
    setRelatorios([]) // Limpa a lista de relatórios do ecrã
    await carregarDados()
    mostrarToast('Máquina removida', 'sucesso')
  }

  // --- Chapa: só se edita depois de «Editar» + senha ---
  const trancarChapa = () => {
    if (chapaDesbloqueada != null) window.api.bloquear('maquina').catch(() => {})
    setChapaDesbloqueada(null)
  }

  const handleEditarChapa = async () => {
    if (!activeMachine) return
    const id = activeMachine.id
    const ok = await pedirSenha({
      titulo: 'Editar características',
      mensagem: `Introduza a senha para editar as características da máquina «${activeMachine.nome}».`,
      textoBotao: 'Desbloquear',
      acao: (senha) => window.api.desbloquear('maquina', id, senha)
    })
    if (ok) setChapaDesbloqueada(id)
  }

  const handleConcluirChapa = () => {
    // sai do campo em edição primeiro: o blur grava o valor antes de voltar a trancar
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setTimeout(trancarChapa, 0)
  }

  // --- Cópias de segurança, senha e "Acerca" ---
  const handleBackup = async () => {
    setMenuOpen(false)
    try {
      const pedido = window.api.fazerBackup()
      // o aviso só aparece depois de escolher o ficheiro (enquanto o zip é criado)
      const t = setTimeout(() => setOcupado('A criar a cópia de segurança…'), 400)
      const r = await pedido.finally(() => {
        clearTimeout(t)
        setOcupado(null)
      })
      if (r.sucesso) {
        const nome = r.caminho.split(/[\\/]/).pop()
        mostrarToast(`Cópia de segurança guardada: ${nome}`, 'sucesso')
      }
    } catch (error) {
      setOcupado(null)
      mostrarToast('Erro ao fazer a cópia: ' + limparErro(error), 'erro')
    }
  }

  const handleRestaurar = async () => {
    setMenuOpen(false)
    let escolha
    try {
      escolha = await window.api.escolherRestauro()
    } catch (error) {
      mostrarToast(limparErro(error), 'erro')
      return
    }
    if (escolha.cancelado) return
    const conteudo =
      `Contém ${escolha.empresas} empresa(s), ${escolha.maquinas} máquina(s) e ${escolha.relatorios} registo(s)` +
      (escolha.tipo === 'zip' ? ` e ${escolha.ficheiros} documento(s).` : '.')
    const aviso =
      escolha.tipo === 'zip'
        ? 'Os dados atuais e as pastas dos registos serão substituídos por esta cópia.'
        : 'Os dados atuais serão substituídos por esta cópia (cópia antiga, sem documentos: as pastas dos registos ficam como estão).'
    const ok = await pedirSenha({
      titulo: 'Restaurar cópia de segurança',
      mensagem:
        `Restaurar a cópia «${escolha.nome}»?\n${conteudo}\n\n${aviso} ` +
        'Antes disso, é guardada automaticamente uma cópia dos dados atuais na pasta das cópias de segurança.',
      textoBotao: 'Restaurar',
      perigo: true,
      acao: async (senha) => {
        setOcupado('A restaurar a cópia de segurança…')
        try {
          await window.api.restaurarBackup(escolha.caminho, senha)
        } finally {
          setOcupado(null)
        }
      }
    })
    if (!ok) return
    setChapaDesbloqueada(null)
    setActiveMachineId(null)
    setActiveCompanyId(null)
    setRelatorios([])
    setPesquisa('')
    setOpenFolders({})
    setVersaoRegistos((v) => v + 1)
    await carregarDados()
    mostrarToast('Cópia de segurança restaurada', 'sucesso')
  }

  const abrirAcerca = async () => {
    setMenuOpen(false)
    try {
      setAppInfo(await window.api.getAppInfo())
    } catch (error) {
      mostrarToast('Erro: ' + limparErro(error), 'erro')
    }
  }

  // === FOLHA A4 (registos) ===
  // modoFolha: 'novo' (escreve-se à vontade até guardar), 'leitura' (registo existente),
  // 'edicao' (registo existente desbloqueado com a senha)
  const handleAbrirNovoRelatorio = () => {
    if (!activeMachine) return
    setRelatorioAtual({
      id: null, // null significa que é novo e ainda não está no SQLite
      data: '', // a data tem de ser escolhida pelo utilizador
      tecnico: '',
      tipo_manutencao: 'Preventiva',
      titulo: `MANUTENÇÃO ${activeMachine.nome.toUpperCase()}`,
      corpo: ''
    })
    setTituloTexto(`MANUTENÇÃO ${activeMachine.nome.toUpperCase()}`)
    setDataRegisto('')
    setTecnicoRegisto('')
    setTipoRegisto('Preventiva')
    setModoFolha('novo')
    setA4ModalOpen(true)
  }

  const handleAbrirRelatorio = (rel) => {
    setRelatorioAtual(rel)
    setTituloTexto(rel.titulo || '')
    setDataRegisto(rel.data || '')
    setTecnicoRegisto(rel.tecnico || '')
    setTipoRegisto(rel.tipo_manutencao || 'Preventiva')
    setModoFolha('leitura')
    setA4ModalOpen(true)
  }

  // Abrir um registo a partir da tabela da vista da empresa
  const abrirRegistoDaEmpresa = async (linha) => {
    try {
      const rel = await window.api.getRelatorio(linha.id)
      if (!rel) return mostrarToast('O registo já não existe.', 'erro')
      voltarEmpresaRef.current = true
      selecionarMaquina(activeCompanyId, linha.maquina_id)
      handleAbrirRelatorio(rel)
    } catch (error) {
      mostrarToast(limparErro(error), 'erro')
    }
  }

  // Fecha a folha; se veio da vista da empresa, volta para lá
  const fecharFolha = () => {
    setA4ModalOpen(false)
    if (voltarEmpresaRef.current) {
      voltarEmpresaRef.current = false
      trancarChapa()
      setActiveMachineId(null)
    }
  }

  const handleEditarRegisto = async () => {
    if (!relatorioAtual?.id) return
    const id = relatorioAtual.id
    const ok = await pedirSenha({
      titulo: 'Editar registo',
      mensagem: 'Introduza a senha para alterar este registo de manutenção.',
      textoBotao: 'Desbloquear',
      acao: (senha) => window.api.desbloquear('relatorio', id, senha)
    })
    if (!ok) return
    setModoFolha('edicao')
    setTimeout(() => editorRef.current?.focus(), 50)
  }

  const applyCmd = (cmd, value = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  // O subtítulo do cabeçalho é comum a todos os registos: alterá-lo pede a senha
  const handleSaveSubtitulo = async (novoSubtitulo) => {
    const texto = novoSubtitulo.replace(/\s+/g, ' ').trim()
    if (texto === configSubtitulo) return // nada mudou: não grava nem mostra aviso
    const repor = () => {
      if (subtituloRef.current) subtituloRef.current.textContent = configSubtitulo
    }
    if (!texto) {
      repor()
      return
    }
    const ok = await pedirSenha({
      titulo: 'Alterar cabeçalho',
      mensagem: `O cabeçalho de todos os registos passa a ser:\n«${texto}»`,
      textoBotao: 'Guardar',
      acao: (senha) => window.api.setConfig('cabecalho_subtitulo', texto, senha)
    })
    if (ok) {
      setConfigSubtitulo(texto)
      mostrarToast('Cabeçalho atualizado', 'sucesso')
    } else {
      repor()
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
    if (!relatorioAtual || modoFolha === 'leitura') return false
    const titulo = tituloRef.current?.value ?? relatorioAtual.titulo
    const corpo = editorRef.current?.innerHTML ?? corpoInicialRef.current
    return (
      titulo !== (relatorioAtual.titulo || '') ||
      corpo !== corpoInicialRef.current ||
      dataRegisto !== (relatorioAtual.data || '') ||
      tecnicoRegisto !== (relatorioAtual.tecnico || '') ||
      tipoRegisto !== (relatorioAtual.tipo_manutencao || 'Preventiva')
    )
  }

  const handleFecharA4 = async () => {
    if (temAlteracoesPorGuardar()) {
      const sair = await pedirConfirmacao(
        'Tem alterações por guardar neste registo. Sair sem guardar?',
        { titulo: 'Alterações por guardar', textoBotao: 'Sair sem guardar', perigo: true }
      )
      if (!sair) return
    }
    if (relatorioAtual?.id) window.api.bloquear('relatorio').catch(() => {})
    fecharFolha()
  }

  const exigirData = () => {
    if (dataRegisto) return true
    mostrarToast('Escolha primeiro a data da intervenção.', 'erro')
    dataRef.current?.focus()
    return false
  }

  // manterAberto = «Aplicar»: grava e continua no registo (para anexar documentos, etc.)
  const handleSaveRelatorio = async (manterAberto = false) => {
    if (!activeMachine || !relatorioAtual || modoFolha === 'leitura') return
    if (!exigirData()) return
    if (dataRegisto > hojeLocal()) {
      mostrarToast('A data da intervenção não pode ser no futuro.', 'erro')
      return
    }

    const titulo = tituloRef.current?.value.trim() || 'REGISTO SEM TÍTULO'
    const corpo = editorRef.current?.innerHTML || ''
    const dadosGuardar = {
      ...relatorioAtual,
      data: dataRegisto,
      titulo,
      corpo,
      tecnico: tecnicoRegisto.trim(),
      tipo_manutencao: tipoRegisto,
      manterAberto
    }

    try {
      const r = await window.api.saveRelatorio(activeMachine.id, dadosGuardar)
      if (r?.aviso) mostrarToast(r.aviso, 'aviso')
      else
        mostrarToast(manterAberto ? 'Registo guardado' : 'Registo guardado com sucesso!', 'sucesso')
      delete dadosGuardar.manterAberto
      if (manterAberto) {
        // continua aberto, agora como registo existente desbloqueado
        if (tituloRef.current) tituloRef.current.value = titulo
        setRelatorioAtual({ ...dadosGuardar, id: r.id })
        setTecnicoRegisto(dadosGuardar.tecnico)
        setModoFolha('edicao')
      } else {
        fecharFolha()
      }
      setVersaoRegistos((v) => v + 1)

      // Atualiza a lista de relatórios no ecrã silenciosamente
      const novosRels = await window.api.getRelatorios(activeMachine.id)
      setRelatorios(novosRels)
    } catch (error) {
      mostrarToast('Erro ao guardar documento: ' + limparErro(error), 'erro')
    }
  }

  const handleApagarRelatorio = async (rel) => {
    const ok = await pedirSenha({
      titulo: 'Eliminar registo',
      mensagem: `Eliminar o registo de ${formatarData(rel.data)} («${rel.titulo}»)? Esta ação não pode ser desfeita.`,
      textoBotao: 'Eliminar',
      perigo: true,
      acao: (senha) => window.api.deleteRelatorio(rel.id, senha)
    })
    if (!ok) return
    mostrarToast('Registo eliminado', 'sucesso')
    setVersaoRegistos((v) => v + 1)
    carregarRelatorios(activeMachine.id)
  }

  // Impressão: abre a janela de impressão do sistema (mesmo resultado que o PDF)
  const imprimirPagina = async () => {
    try {
      const r = await window.api.imprimir()
      if (!r.sucesso && r.motivo && r.motivo !== 'cancelled') {
        mostrarToast('Não foi possível imprimir: ' + r.motivo, 'erro')
      }
    } catch (error) {
      mostrarToast('Erro ao imprimir: ' + limparErro(error), 'erro')
    }
  }

  const handleImprimir = async () => {
    if (!exigirData()) return
    // o título impresso vem do texto atual do campo
    setTituloTexto(tituloRef.current?.value ?? tituloTexto)
    await imprimirPagina()
  }

  // Imprimir diretamente da lista: monta a folha só para impressão e abre a janela de impressão
  const handleImprimirDaLista = (rel) => setRelImprimir(rel)

  const handleExportarPDF = async () => {
    if (!exigirData()) return
    const titulo = tituloRef.current?.value.trim() || 'relatorio'
    try {
      const resultado = await window.api.exportarPDF(titulo)
      if (resultado.sucesso) {
        mostrarToast('PDF exportado com sucesso!', 'sucesso')
      }
      // Se o utilizador cancelar o diálogo, "sucesso" vem false — não mostramos erro nenhum, é escolha dele
    } catch (error) {
      mostrarToast('Erro ao exportar PDF: ' + limparErro(error), 'erro')
    }
  }

  // Grava as alterações feitas diretamente na Chapa Metálica (só com a chapa desbloqueada)
  const handleUpdateChapa = async (campo, valorText) => {
    if (!activeMachine || chapaDesbloqueada !== activeMachine.id) return

    let valor = valorText.trim()
    if (valor === '-') valor = ''

    if (activeMachine[campo] === valor || (!activeMachine[campo] && valor === '')) return

    try {
      // Grava só o campo alterado (evita que duas edições seguidas se sobreponham)
      const r = await window.api.updateCampoMaquina(activeMachine.id, campo, valor)
      await carregarDados()
      if (r?.aviso) mostrarToast(r.aviso, 'aviso')
      else mostrarToast('Alteração guardada', 'sucesso')
    } catch (error) {
      mostrarToast('Erro ao guardar: ' + limparErro(error), 'erro')
    }
  }

  const toggleFolder = (id) => {
    setOpenFolders((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Clique numa empresa: mostra a vista da empresa (meses); clicar outra vez fecha a pasta
  const selecionarEmpresa = (companyId) => {
    if (activeCompanyId === companyId && !activeMachineId) {
      toggleFolder(companyId)
      return
    }
    trancarChapa()
    setActiveCompanyId(companyId)
    setActiveMachineId(null)
    setOpenFolders((prev) => ({ ...prev, [companyId]: true }))
  }

  const selecionarMaquina = (companyId, machineId) => {
    if (machineId !== activeMachineId) trancarChapa() // mudar de máquina volta a trancar a chapa
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
  const chapaEditavel = !!activeMachine && chapaDesbloqueada === activeMachine.id
  // Folha A4: registo novo ou desbloqueado -> editável; só se escreve depois de haver data
  const folhaEditavel = modoFolha !== 'leitura'
  const podeEscrever = folhaEditavel && !!dataRegisto
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
                    onClick={() => selecionarEmpresa(empresa.id)}
                    aria-expanded={aberta}
                    aria-current={temMaquinaAtiva && !activeMachineId ? 'page' : undefined}
                    title={`${empresa.nome} — ver os meses`}
                    className={`flex items-center flex-1 min-w-0 px-2 py-2 text-left text-[15px] font-semibold rounded-md ${temMaquinaAtiva && !activeMachineId ? 'text-brand-800 bg-brand-50' : 'text-slate-800'}`}
                  >
                    <i
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFolder(empresa.id)
                      }}
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
                  ['fa-calculator', 'Configuração de custos', 'custos'],
                  ['fa-key', 'Alterar senha', 'senha'],
                  ['fa-circle-info', 'Acerca da aplicação', 'acerca']
                ].map(([icone, texto, acao], i) => (
                  <button
                    key={acao}
                    role="menuitem"
                    autoFocus={i === 0}
                    onClick={() => {
                      if (acao === 'backup') handleBackup()
                      else if (acao === 'restaurar') handleRestaurar()
                      else if (acao === 'senha') {
                        setMenuOpen(false)
                        setAlterarSenhaOpen(true)
                      } else if (acao === 'custos') {
                        setMenuOpen(false)
                        setConfigCustosOpen(true)
                      } else abrirAcerca()
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
        {/* Onde estão os dados: sempre visível (evita trabalhar sem querer noutra base de dados) */}
        {infoDados && (
          <button
            onClick={() => window.api.abrirPastaDados()}
            title={`${MODOS_DADOS[infoDados.modo] || infoDados.modo}\n${infoDados.pastaDados}\n(clique para abrir a pasta)`}
            className={`flex items-center gap-2 px-3 py-1.5 text-left text-xs border-t ${infoDados.somenteLeitura ? 'bg-danger-50 border-danger-100 text-danger-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
          >
            <i
              className={`fa-solid ${infoDados.modo === 'portatil' ? 'fa-hard-drive' : 'fa-desktop'} shrink-0`}
            ></i>
            <span className="font-semibold shrink-0">
              {infoDados.modo === 'portatil'
                ? 'Portátil'
                : infoDados.modo === 'instalado'
                  ? 'Instalado'
                  : 'Desenvolvimento'}
              {infoDados.somenteLeitura ? ' (só consulta)' : ''}
            </span>
            <span className="truncate min-w-0" dir="rtl">
              &lrm;{infoDados.pastaDados}
            </span>
          </button>
        )}
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 min-w-0 flex flex-col h-full bg-slate-100 relative print:hidden">
        {/* Header Superior */}
        <header className="min-h-16 py-2 border-b border-slate-200 flex items-center px-5 lg:px-8 gap-4 justify-between bg-white shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            {activeMachine ? (
              <BotaoMais titulo="Novo registo" onClick={handleAbrirNovoRelatorio} />
            ) : activeCompany ? (
              <BotaoMais
                titulo="Nova máquina"
                onClick={() => abrirModalMaquina(activeCompany.id)}
              />
            ) : (
              <BotaoMais titulo="Nova empresa" onClick={() => setEmpresaModalOpen(true)} />
            )}
            <div className="min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-slate-900 truncate leading-tight">
                {activeMachine
                  ? activeMachine.nome
                  : activeCompany
                    ? activeCompany.nome
                    : 'Nenhuma máquina selecionada'}
              </h2>
              <p className="text-sm text-slate-500 truncate">
                {activeMachine ? (
                  <button
                    onClick={() => selecionarEmpresa(activeCompany.id)}
                    className="hover:text-brand-700 hover:underline"
                    title="Ver os meses desta empresa"
                  >
                    <i className="fa-solid fa-building mr-1.5 text-slate-400"></i>
                    {activeCompany.nome}
                  </button>
                ) : activeCompany ? (
                  <>
                    <i className="fa-solid fa-building mr-1.5 text-slate-400"></i>Empresa ·{' '}
                    {activeCompany.maquinas.length}{' '}
                    {activeCompany.maquinas.length === 1 ? 'máquina' : 'máquinas'}
                  </>
                ) : (
                  'Selecione uma empresa ou máquina no menu à esquerda'
                )}
              </p>
            </div>
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

        {infoDados?.somenteLeitura && (
          <div className="bg-danger-600 text-white text-sm font-semibold px-5 py-2 flex items-center gap-2 shrink-0">
            <i className="fa-solid fa-lock"></i>
            Modo só de consulta: o disco não permite escrita. Pode ver os dados, mas nenhuma
            alteração é gravada.
          </div>
        )}

        {/* Área de Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 lg:p-8 print:hidden">
          {!activeMachine && activeCompany ? (
            <VistaEmpresa
              empresa={activeCompany}
              versao={versaoRegistos}
              onAbrirRegisto={abrirRegistoDaEmpresa}
              onErro={(m) => mostrarToast(m, 'erro')}
            />
          ) : !activeMachine ? (
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
                  : 'Escolha uma empresa (para ver os meses) ou uma máquina na lista à esquerda.'}
              </p>
            </div>
          ) : (
            /* Estado Preenchido: Chapa Metálica e Relatórios */
            <div className="max-w-5xl mx-auto">
              {/* === CHAPA DE CARACTERÍSTICAS === (protegida: «Editar» pede a senha) */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p
                  className={`text-[15px] flex items-center gap-2 ${chapaEditavel ? 'text-accent-700 font-semibold' : 'text-slate-600'}`}
                >
                  <i
                    className={`fa-solid ${chapaEditavel ? 'fa-lock-open text-accent-500' : 'fa-lock text-slate-400'}`}
                  ></i>
                  {chapaEditavel
                    ? 'Edição desbloqueada: clique num valor para o alterar.'
                    : 'Características protegidas por senha.'}
                </p>
                {chapaEditavel ? (
                  <button onClick={handleConcluirChapa} className={`${BTN_PRIMARIO} py-2`}>
                    <i className="fa-solid fa-check"></i>Concluir
                  </button>
                ) : (
                  <button
                    onClick={handleEditarChapa}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm transition"
                  >
                    <i className="fa-solid fa-pen"></i>Editar
                  </button>
                )}
              </div>
              <div
                key={activeMachine.id}
                className={`@container bg-gradient-to-br from-slate-700 to-slate-900 text-slate-200 border-2 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] rounded-lg p-5 @lg:p-7 mb-8 relative transition ${chapaEditavel ? 'border-accent-400 ring-4 ring-accent-300/50' : 'border-slate-500'}`}
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
                    ['serial', 'N.º SÉRIE'],
                    ['ano_fab', 'ANO FAB.'],
                    ['cidade', 'CIDADE'],
                    ['pais', 'PAÍS']
                  ].map(([campo, rotulo]) => (
                    <div key={campo} className="min-w-0">
                      <label className="block text-xs tracking-wider text-slate-400 font-semibold mb-1">
                        {rotulo}
                      </label>
                      <CampoChapa
                        ariaLabel={rotulo}
                        valor={activeMachine[campo]}
                        onGuardar={(v) => handleUpdateChapa(campo, v)}
                        bloqueado={!chapaEditavel}
                        className={`w-full font-mono text-lg font-bold text-white rounded transition-colors px-2 py-1 -ml-2 ${chapaEditavel ? 'bg-white/5 hover:bg-white/10 focus:bg-white/15' : ''}`}
                      />
                    </div>
                  ))}
                </div>

                {/* BLOCO 2: ALIMENTAÇÃO */}
                <h3 className="text-center font-bold tracking-[0.2em] text-slate-300 mt-6 mb-6 border-b border-slate-600 pb-2 text-sm @lg:text-base">
                  CARACTERÍSTICAS DE ALIMENTAÇÃO
                </h3>

                <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6 pb-2">
                  {[
                    {
                      titulo: 'Elétricas',
                      campos: [
                        ['elet_v', 'V'],
                        ['elet_hz', 'Hz'],
                        ['elet_kw', 'kW']
                      ]
                    },
                    { titulo: 'Pneumáticas (Ar)', campos: [['pneu_kgcm2', 'Kg/cm²']] },
                    {
                      titulo: 'Hidráulicas (Água)',
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
                              bloqueado={!chapaEditavel}
                              className={`px-2 py-1.5 rounded font-mono text-base text-white border w-[5rem] text-center shadow-inner ${chapaEditavel ? 'bg-slate-800 border-accent-400/60 focus:bg-slate-700 focus:border-accent-300' : 'bg-slate-800/60 border-slate-600'}`}
                            />
                            <span className="text-slate-400 text-xs font-bold">{unidade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-400 mt-6 text-center italic">
                  {chapaEditavel
                    ? 'Clique num valor para o editar. Enter grava, Esc anula. No fim, carregue em «Concluir».'
                    : 'Para alterar estes valores, carregue em «Editar» (pede a senha).'}
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
                                            {formatarData(rel.data)}
                                          </span>
                                          <span className="truncate mr-2">{rel.titulo}</span>
                                          <BadgeTipo tipo={rel.tipo_manutencao} />
                                        </button>
                                        <button
                                          onClick={() => handleImprimirDaLista(rel)}
                                          className="opacity-60 group-hover/file:opacity-100 focus:opacity-100 w-9 h-9 rounded text-slate-500 hover:text-brand-700 hover:bg-brand-100 transition shrink-0"
                                          title="Imprimir"
                                          aria-label={`Imprimir registo de ${formatarData(rel.data)}`}
                                        >
                                          <i className="fa-solid fa-print text-sm"></i>
                                        </button>
                                        <button
                                          onClick={() => handleApagarRelatorio(rel)}
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
          senha={senhaRenomear}
          onChangeSenha={(v) => {
            setSenhaRenomear(v)
            setErroRenomear('')
          }}
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

      {/* ================= MODAL FOLHA A4 (desenho original) ================= */}
      {isA4ModalOpen && relatorioAtual && (
        <div
          className="fixed inset-0 bg-gray-900/90 z-[80] overflow-y-auto pb-10 print:static print:bg-white print:overflow-visible print:pb-0 print:p-0"
          onKeyDown={(e) => {
            // Ctrl+S guarda; Ctrl+P imprime; Esc volta (pergunta se houver alterações)
            if (pedidoSenha || pedidoConfirmacao) return
            const tecla = e.key.toLowerCase()
            if ((e.ctrlKey || e.metaKey) && tecla === 's') {
              e.preventDefault()
              if (folhaEditavel) handleSaveRelatorio(false)
            } else if ((e.ctrlKey || e.metaKey) && tecla === 'p') {
              e.preventDefault()
              handleImprimir()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              handleFecharA4()
            }
          }}
        >
          {/* Barra Superior Escura */}
          <div className="fixed top-0 left-0 right-0 bg-slate-900/95 backdrop-blur text-white px-4 py-3 flex justify-between items-center gap-2 border-b border-white/10 shadow-lg z-[90] print:hidden">
            <div className="flex items-center min-w-0">
              <button
                onClick={handleFecharA4}
                className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-md text-sm font-medium mr-4 transition shrink-0"
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>Voltar
              </button>
              <span className="hidden md:inline text-sm text-slate-300 font-semibold truncate">
                {modoFolha === 'novo'
                  ? 'Novo Registo'
                  : modoFolha === 'edicao'
                    ? 'Editar Registo Existente'
                    : 'Registo (só leitura)'}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              {modoFolha === 'leitura' && (
                <button
                  onClick={handleEditarRegisto}
                  title="Alterar este registo (pede a senha)"
                  className="bg-accent-500 hover:bg-accent-400 text-slate-900 px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition"
                >
                  <i className="fa-solid fa-pen mr-2"></i>Editar
                </button>
              )}
              <button
                onClick={handleImprimir}
                disabled={!dataRegisto}
                title="Imprimir (Ctrl+P)"
                className="bg-white/10 hover:bg-white/20 ring-1 ring-inset ring-white/15 px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-print mr-2"></i>Imprimir
              </button>
              <button
                onClick={handleExportarPDF}
                disabled={!dataRegisto}
                className="bg-white/10 hover:bg-white/20 ring-1 ring-inset ring-white/15 px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <i className="fa-solid fa-file-pdf mr-2"></i>Exportar PDF
              </button>
              {folhaEditavel && (
                <button
                  onClick={() => handleSaveRelatorio(true)}
                  disabled={!dataRegisto}
                  title="Grava e continua no registo"
                  className="bg-white/10 hover:bg-white/20 ring-1 ring-inset ring-white/15 px-4 py-2 rounded-md text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-check mr-2"></i>Aplicar
                </button>
              )}
              {folhaEditavel && (
                <button
                  onClick={() => handleSaveRelatorio(false)}
                  disabled={!dataRegisto}
                  title="Grava e fecha (Ctrl+S)"
                  className="bg-brand-500 hover:bg-brand-400 px-4 lg:px-6 py-2 rounded-md text-sm font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="fa-solid fa-floppy-disk mr-2"></i>Gravar
                </button>
              )}
            </div>
          </div>

          {/*
            O Papel A4 em si — PRINT TABLE
            Usa uma <table> verdadeira (thead/tbody/tfoot): o Chromium só repete
            o cabeçalho e reserva o espaço do rodapé em cada página com tabelas
            reais (com divs em display:table o texto ficava por baixo do rodapé).
            Em ecrã as partes da tabela são mostradas como blocos/flex normais.
          */}
          {/* Dados do registo e documentos — só no ecrã, não sai na impressão */}
          <details
            open
            className="print:hidden w-[210mm] max-w-[calc(100%-1rem)] mx-auto mt-20 mb-4 bg-white rounded-lg shadow-xl group/docs"
          >
            <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none">
              <i className="fa-solid fa-chevron-right text-xs text-slate-400 transition-transform group-open/docs:rotate-90"></i>
              <span className="font-bold text-slate-900">
                <i className="fa-solid fa-paperclip mr-2 text-brand-600"></i>Documentos e custos
              </span>
              {modoFolha === 'leitura' && (
                <span className="ml-auto flex items-center gap-3 text-sm text-slate-600 min-w-0">
                  <span className="truncate">
                    <i className="fa-solid fa-user-gear mr-1.5 text-slate-400"></i>
                    {tecnicoRegisto || 'Técnico não indicado'}
                  </span>
                  <BadgeTipo tipo={tipoRegisto} />
                </span>
              )}
            </summary>
            <div className="px-5 pb-4 pt-1 border-t border-slate-100">
              {folhaEditavel && (
                <div className="grid sm:grid-cols-2 gap-3 mb-4 mt-3">
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-500 mb-1">Técnico</span>
                    <input
                      value={tecnicoRegisto}
                      onChange={(e) => setTecnicoRegisto(e.target.value)}
                      placeholder="Nome do técnico"
                      className={`${INPUT} py-2`}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-semibold text-slate-500 mb-1">
                      Tipo de manutenção
                    </span>
                    <select
                      value={tipoRegisto}
                      onChange={(e) => setTipoRegisto(e.target.value)}
                      className={`${INPUT} py-2`}
                    >
                      {[
                        ...TIPOS_MANUTENCAO,
                        ...(TIPOS_MANUTENCAO.includes(tipoRegisto) ? [] : [tipoRegisto])
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className={folhaEditavel ? '' : 'mt-3'}>
                <SecaoDocumentos
                  registoId={relatorioAtual.id}
                  versao={versaoRegistos}
                  pedirSenha={pedirSenha}
                  mostrarToast={mostrarToast}
                />
              </div>
            </div>
          </details>

          <div className="folha-a4-pagina folha-original w-[210mm] max-w-[calc(100%-1rem)] min-h-[297mm] bg-white shadow-2xl mx-auto flex flex-col p-[12mm] lg:p-[20mm] relative">
            {/* Data da intervenção (obrigatória) — controlo de ecrã, não sai na impressão */}
            {folhaEditavel && (
              <div
                className={`print:hidden mb-5 flex flex-wrap items-center justify-center gap-2 rounded border px-3 py-2 text-sm ${dataRegisto ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-amber-400 bg-amber-50 text-amber-900'}`}
              >
                <label htmlFor="data-intervencao" className="font-semibold">
                  <i className="fa-regular fa-calendar mr-1.5"></i>Data da intervenção:
                </label>
                <input
                  id="data-intervencao"
                  ref={dataRef}
                  type="date"
                  value={dataRegisto}
                  max={hojeLocal()}
                  required
                  onChange={(e) => {
                    const v = e.target.value
                    if (v && v > hojeLocal()) {
                      mostrarToast('A data da intervenção não pode ser no futuro.', 'erro')
                      return
                    }
                    setDataRegisto(v)
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-800 bg-white outline-none focus:border-blue-500"
                />
              </div>
            )}

            <table className="folha-a4 flex flex-col flex-grow w-full border-collapse">
              {/* ===== CABEÇALHO — repete em todas as páginas ===== */}
              <thead className="folha-a4-header block">
                <tr className="block">
                  <td className="block p-0">
                    <div className="text-center mb-6">
                      <h1 className="text-3xl font-extrabold text-gray-900 mb-1">
                        Agrafametal, Lda.
                      </h1>
                      <div className="bg-blue-50 border-t border-b border-blue-200 py-1 mb-6 group cursor-text">
                        <p className="text-[11px] font-semibold text-gray-600 tracking-wide">
                          <span>NIF 514 304 197 — </span>
                          <span
                            ref={subtituloRef}
                            contentEditable
                            suppressContentEditableWarning
                            title="Alterar o cabeçalho (pede a senha)"
                            onBlur={(e) => handleSaveSubtitulo(e.currentTarget.textContent)}
                            onKeyDown={handleSubtituloKeyDown}
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
                        readOnly={!podeEscrever}
                        onKeyDown={(e) => {
                          // Enter no título passa para o texto do relatório
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            editorRef.current?.focus()
                          }
                        }}
                        onChange={(e) => setTituloTexto(e.target.value)}
                        className={`w-full text-center text-lg font-bold text-blue-900 uppercase bg-transparent outline-none border-b border-dashed border-gray-300 focus:border-blue-500 pb-1 print:hidden ${!podeEscrever ? 'cursor-default' : ''}`}
                        placeholder="TÍTULO DA INTERVENÇÃO"
                      />
                      {/* Na impressão usa texto normal: o valor de um <input> não aparece
                          nas cópias do cabeçalho repetidas nas páginas seguintes */}
                      <p className="hidden print:block text-center text-lg font-bold text-blue-900 uppercase pb-1 border-b border-dashed border-gray-300">
                        {tituloTexto}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-2">
                        Data: {formatarData(dataRegisto)}
                      </p>
                    </div>

                    {/* Barra de Ferramentas de Texto — não aparece na impressão */}
                    <div
                      className={`flex flex-wrap items-center gap-1 border border-gray-200 bg-gray-50 rounded-t-md p-1.5 shadow-sm print:hidden ${!podeEscrever ? 'opacity-40 pointer-events-none' : ''}`}
                      aria-disabled={!podeEscrever}
                    >
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
                  </td>
                </tr>
              </thead>

              {/* ===== CORPO — flui livremente entre páginas ===== */}
              <tbody className="folha-a4-body flex flex-col flex-grow border border-t-0 border-gray-200 print:border-0">
                <tr className="flex flex-col flex-grow">
                  <td className="block flex-grow relative p-0 min-h-[80mm]">
                    <div
                      ref={editorRef}
                      className="report-editor absolute inset-0 p-4 text-[13px] leading-relaxed text-gray-800 outline-none overflow-y-auto print:static print:h-auto print:overflow-visible print:p-0 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ol]:list-decimal"
                      contentEditable={podeEscrever}
                      suppressContentEditableWarning
                      onKeyDown={handleEditorKeyDown}
                    ></div>
                    {folhaEditavel && !dataRegisto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 text-gray-500 text-sm font-semibold print:hidden">
                        <span>
                          <i className="fa-regular fa-calendar mr-2"></i>Escolha primeiro a data da
                          intervenção
                        </span>
                      </div>
                    )}
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

            <RodapeFolha />
          </div>
        </div>
      )}

      {/* Folha só para impressão (ícone «Imprimir» da lista de registos) */}
      {relImprimir && !isA4ModalOpen && (
        <FolhaImpressao rel={relImprimir} subtitulo={configSubtitulo} />
      )}

      {pedidoSenha && (
        <ModalSenha key={pedidoSenha.id} pedido={pedidoSenha} onConcluir={concluirPedidoSenha} />
      )}

      {isAlterarSenhaOpen && (
        <ModalAlterarSenha
          onFechar={() => setAlterarSenhaOpen(false)}
          onSucesso={() => {
            setAlterarSenhaOpen(false)
            mostrarToast('Senha alterada', 'sucesso')
          }}
        />
      )}

      {isConfigCustosOpen && (
        <ModalConfigCustos
          onFechar={() => setConfigCustosOpen(false)}
          onSucesso={() => {
            setConfigCustosOpen(false)
            mostrarToast('Configuração de custos guardada', 'sucesso')
          }}
        />
      )}

      <ConfirmModal pedido={pedidoConfirmacao} onResponder={responderConfirmacao} />

      {/* A trabalhar (cópia de segurança / restauro) */}
      {ocupado && (
        <div className="fixed inset-0 z-[120] modal-backdrop flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl px-6 py-5 flex items-center gap-4 animar-entrada">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-brand-600"></i>
            <div>
              <p className="font-semibold text-slate-900">{ocupado}</p>
              <p className="text-sm text-slate-500">
                Pode demorar alguns minutos se houver muitos documentos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST (NOTIFICAÇÃO) ================= */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[110] max-w-[min(32rem,calc(100%-3rem))] px-4 py-3 rounded-lg shadow-xl text-white text-[15px] font-semibold flex items-center gap-3 animar-entrada print:hidden ${
            toast.tipo === 'erro'
              ? 'bg-danger-600'
              : toast.tipo === 'aviso'
                ? 'bg-warn-600'
                : 'bg-brand-900'
          }`}
        >
          <i
            className={`fa-solid ${toast.tipo === 'sucesso' ? 'fa-circle-check text-ok-400' : 'fa-triangle-exclamation'}`}
          ></i>
          <span className="break-words min-w-0">{toast.mensagem}</span>
        </div>
      )}
    </div>
  )
}
