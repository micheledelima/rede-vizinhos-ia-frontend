import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { bairrosBlumenau } from './data/bairrosBlumenau'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
const API_URL = `${API_BASE_URL}/api/alertas`

const categorias = [
  { value: 'Movimentação suspeita', label: 'Movimentação suspeita' },
  { value: 'Comportamento incomum', label: 'Comportamento incomum' },
  { value: 'Tentativa de golpe', label: 'Tentativa de golpe' },
  { value: 'Pedido de apoio comunitário', label: 'Pedido de apoio comunitário' },
  { value: 'Aviso geral', label: 'Aviso geral' },
  { value: 'Informação preventiva', label: 'Informação preventiva' },
]

const niveisAtencao = {
  Baixo: 'Baixo',
  Médio: 'Médio',
  Alto: 'Alto',
}

const niveis = Object.entries(niveisAtencao).map(([value, label]) => ({ value, label }))

const formularioInicial = {
  mensagem: '',
  cidade: 'Blumenau',
  bairro: '',
  referenciaLocalOriginal: '',
}

const filtrosIniciais = {
  cidade: 'Blumenau',
  bairro: '',
  rua: '',
  categoria: '',
  nivelAtencao: '',
}

function categoriaLabel(categoria) {
  return categorias.find((item) => item.value === categoria)?.label ?? categoria
}

function localizacaoTitulo(alerta) {
  if (alerta.cidade && alerta.bairro) return `${alerta.bairro} - ${alerta.cidade}`
  return alerta.bairro || alerta.cidade || 'Região não informada'
}

function nivelClass(nivel) {
  const normalizado = nivel
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return `level-${normalizado}`
}

function getConfiancaSituacaoClass(confianca) {
  const normalizada = confianca
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  switch (normalizada) {
    case 'alta':
      return 'confidence-high'
    case 'media':
      return 'confidence-medium'
    case 'baixa':
      return 'confidence-low'
    default:
      return 'confidence-neutral'
  }
}

function estaProcessando(alerta) {
  return ['Pendente', 'Processando'].includes(alerta.statusProcessamento)
}

function analiseConcluida(alerta) {
  return alerta.statusProcessamento === 'Concluido'
}

function mensagemConfiancaInformacao(alerta) {
  const quantidade = alerta.quantidadeRelatosSemelhantes ?? 0

  if (quantidade === 0) return 'Ainda não há outros relatos semelhantes nesta região.'
  if (quantidade === 1) return 'Existe outro relato semelhante nesta região.'
  return `Existem ${quantidade} outros relatos semelhantes nesta região.`
}

function conteudoTratadoAlerta(alerta) {
  return (
    alerta.mensagemTratada ||
    alerta.resumo ||
    alerta.orientacaoPreventiva ||
    alerta.textoCorrigido ||
    'Informação tratada pela IA indisponível.'
  )
}

function criarQueryString(valores) {
  const params = new URLSearchParams()

  Object.entries(valores).forEach(([chave, valor]) => {
    if (valor?.trim()) {
      params.set(chave, valor.trim())
    }
  })

  return params.toString()
}

function App() {
  const [telaAtual, setTelaAtual] = useState('home')
  const [alertas, setAlertas] = useState([])
  const [resumo, setResumo] = useState({
    totalAlertas: 0,
    totalPorCategoria: {},
    totalPorNivelAtencao: {},
  })
  const [resumoRegiao, setResumoRegiao] = useState({
    totalAlertas: 0,
    totalPorNivelAtencao: {},
    totalPorCategoria: {},
    ultimosAlertas: [],
  })
  const [filtros, setFiltros] = useState(filtrosIniciais)
  const [formulario, setFormulario] = useState(formularioInicial)
  const [mensagemStatus, setMensagemStatus] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const filtrosAtivos = useMemo(() => {
    return Object.fromEntries(
      Object.entries(filtros).filter(([, valor]) => valor.trim() !== ''),
    )
  }, [filtros])

  const carregarDados = useCallback(async (filtrosConsulta, silencioso = false) => {
    if (!silencioso) {
      setCarregando(true)
    }

    try {
      const queryAlertas = criarQueryString(filtrosConsulta)
      const queryRegiao = criarQueryString({
        cidade: filtrosConsulta.cidade,
        bairro: filtrosConsulta.bairro,
      })

      const [alertasResponse, resumoResponse] = await Promise.all([
        fetch(queryAlertas ? `${API_URL}?${queryAlertas}` : API_URL),
        fetch(`${API_URL}/resumo`),
      ])

      if (!alertasResponse.ok || !resumoResponse.ok) {
        throw new Error('Erro ao carregar dados')
      }

      setAlertas(await alertasResponse.json())
      setResumo(await resumoResponse.json())

      const resumoRegiaoResponse = await fetch(
        queryRegiao ? `${API_URL}/resumo-regiao?${queryRegiao}` : `${API_URL}/resumo-regiao`,
      )

      if (!resumoRegiaoResponse.ok) {
        throw new Error('Erro ao carregar resumo por regiao')
      }

      setResumoRegiao(await resumoRegiaoResponse.json())
    } catch {
      setMensagemStatus('Nao foi possivel conectar com a API. Verifique se o backend esta rodando.')
    } finally {
      if (!silencioso) {
        setCarregando(false)
      }
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => carregarDados(filtrosIniciais), 0)
    return () => window.clearTimeout(timeoutId)
  }, [carregarDados])

  const temAlertaEmProcessamento = alertas.some(estaProcessando)

  useEffect(() => {
    if (!temAlertaEmProcessamento) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      carregarDados(filtros, true)
    }, 4000)

    return () => window.clearInterval(intervalId)
  }, [temAlertaEmProcessamento, filtros, carregarDados])

  function alterarCampo(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }))
  }

  function alterarFiltro(campo, valor) {
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }))
  }

  function aplicarFiltros(event) {
    event.preventDefault()
    carregarDados(filtros)
  }

  function limparFiltros() {
    setFiltros(filtrosIniciais)
    carregarDados(filtrosIniciais)
  }

  async function registrarAlerta(event) {
    event.preventDefault()
    setSalvando(true)
    setMensagemStatus('')

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagemOriginal: formulario.mensagem,
          cidade: 'Blumenau',
          bairro: formulario.bairro,
          referenciaLocalOriginal: formulario.referenciaLocalOriginal,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao registrar alerta')
      }

      setFormulario(formularioInicial)
      setMensagemStatus('Alerta registrado. A analise da IA esta em processamento.')
      await carregarDados(filtros)
      setTelaAtual('alertas')
    } catch {
      setMensagemStatus('Nao foi possivel registrar o alerta agora.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M3 11.5 12 4l9 7.5" />
              <path d="M5.5 10.5V20h13v-9.5" />
            </svg>
          </span>
          <div>
            <h1>Rede de Vizinhos</h1>
            <span>Blumenau/SC</span>
          </div>
        </div>

        <nav className="tab-nav" aria-label="Navegação principal">
          <button className={telaAtual === 'home' ? 'active' : ''} onClick={() => setTelaAtual('home')}>
            Home
          </button>
          <button className={telaAtual === 'novo' ? 'active' : ''} onClick={() => setTelaAtual('novo')}>
            Novo alerta
          </button>
          <button className={telaAtual === 'alertas' ? 'active' : ''} onClick={() => setTelaAtual('alertas')}>
            Alertas
          </button>
        </nav>
      </header>

      <div className="app-content">
        {mensagemStatus && <p className="status-message">{mensagemStatus}</p>}

        {telaAtual === 'home' && (
          <Home resumo={resumo} carregando={carregando} irParaNovo={() => setTelaAtual('novo')} />
        )}

        {telaAtual === 'novo' && (
          <NovoAlerta
            formulario={formulario}
            salvando={salvando}
            alterarCampo={alterarCampo}
            registrarAlerta={registrarAlerta}
          />
        )}

        {telaAtual === 'alertas' && (
          <Alertas
            alertas={alertas}
            resumoRegiao={resumoRegiao}
            filtros={filtros}
            filtrosAtivos={filtrosAtivos}
            alterarFiltro={alterarFiltro}
            aplicarFiltros={aplicarFiltros}
            limparFiltros={limparFiltros}
            carregando={carregando}
            recarregar={() => carregarDados(filtros)}
          />
        )}
      </div>
    </main>
  )
}

function Home({ resumo, carregando, irParaNovo }) {
  return (
    <section className="screen home-screen">
      <div className="home-heading">
        <div>
          <span className="community-badge">● Comunidade ativa</span>
          <h2>Olá, vizinho.</h2>
          <p>Acompanhe e compartilhe situações que merecem atenção em Blumenau/SC.</p>
        </div>
        <button className="primary-button register-button" type="button" onClick={irParaNovo}>
          + Registrar alerta
        </button>
      </div>

      <PainelResumo resumo={resumo} carregando={carregando} />
    </section>
  )
}

function PainelResumo({ resumo, carregando }) {
  return (
    <section className="summary-panel" aria-label="Painel de resumo">
      <article className="summary-feature">
        <span className="panel-badge">Painel da semana</span>
        <h3>
          Tecnologia para apoiar,
          <br />
          <em>vizinhos para cuidar.</em>
        </h3>
        <p>A IA ajuda a organizar e resumir os relatos para apoiar a comunicação e o cuidado entre a comunidade.</p>
        <div className="feature-total">
          <span>Total de alertas</span>
          <strong>{resumo.totalAlertas ?? 0}</strong>
        </div>
      </article>

      <div className="summary-overview">
        <article className="status-card">
          <div>
            <span>Status</span>
            <span className="live-status">● {carregando ? 'Atualizando' : 'Ao vivo'}</span>
          </div>
          <h3>{resumo.totalAlertas ? 'A comunidade está de olho.' : 'Tudo certo por aqui.'}</h3>
          <p>Os relatos da comunidade aparecem aqui assim que são processados.</p>
        </article>

        <div className="home-metrics">
          {categorias.slice(0, 2).map((categoria) => (
            <article className="metric-card" key={categoria.value}>
              <span>{categoria.label}</span>
              <strong>{resumo.totalPorCategoria?.[categoria.value] ?? 0}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="home-metrics home-metrics-secondary">
        {categorias.slice(2).map((categoria) => (
          <article className="metric-card" key={categoria.value}>
            <span>{categoria.label}</span>
            <strong>{resumo.totalPorCategoria?.[categoria.value] ?? 0}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

function NovoAlerta({ formulario, salvando, alterarCampo, registrarAlerta }) {
  return (
    <section className="screen form-screen">
      <div className="section-heading">
        <h2>Novo alerta</h2>
        <p>Descreva a situação. A categoria e o nível de risco serão definidos pela análise da IA.</p>
      </div>

      <form className="form-panel" onSubmit={registrarAlerta}>
        <label className="full-field">
          <span className="field-heading">
            <span>Mensagem do alerta *</span>
            <span>{formulario.mensagem.length}/1000 (mínimo 5)</span>
          </span>
          <textarea
            value={formulario.mensagem}
            onChange={(event) => alterarCampo('mensagem', event.target.value)}
            minLength={5}
            maxLength={1000}
            rows={7}
            required
            placeholder="Carro parado há muito tempo observando as casas..."
          />
        </label>

        <label>
          Cidade
          <input value="Blumenau" readOnly disabled />
        </label>

        <label>
          Bairro *
          <select
            value={formulario.bairro}
            onChange={(event) => alterarCampo('bairro', event.target.value)}
            required
          >
            <option value="">Selecione o bairro</option>
            {bairrosBlumenau.map((bairro) => (
              <option key={bairro} value={bairro}>
                {bairro}
              </option>
            ))}
          </select>
        </label>

        <label className="full-field">
          <span className="field-heading">
            <span>Rua ou ponto de referência</span>
            <span>{formulario.referenciaLocalOriginal.length}/240 · opcional</span>
          </span>
          <input
            value={formulario.referenciaLocalOriginal}
            onChange={(event) => alterarCampo('referenciaLocalOriginal', event.target.value)}
            maxLength={240}
            placeholder="Próximo ao mercado, perto da escola, Rua 2 de Setembro..."
          />
        </label>

        <div className="form-submit">
          <button className="primary-button" type="submit" disabled={salvando}>
            {salvando ? 'Registrando...' : 'Salvar alerta'}
          </button>
        </div>
      </form>

      <p className="screen-footer">Blumenau/SC — Comunicação preventiva entre vizinhos</p>
    </section>
  )
}

function Alertas({
  alertas,
  resumoRegiao,
  filtros,
  filtrosAtivos,
  alterarFiltro,
  aplicarFiltros,
  limparFiltros,
  carregando,
  recarregar,
}) {
  return (
    <section className="screen">
      <div className="list-header">
        <div className="section-heading">
          <h2>Alertas cadastrados</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => recarregar()} disabled={carregando}>
          Atualizar
        </button>
      </div>

      <form className="filters-panel" onSubmit={aplicarFiltros}>
        <label>
          Cidade
          <input
            value={filtros.cidade}
            onChange={(event) => alterarFiltro('cidade', event.target.value)}
            placeholder="Ex.: Blumenau"
            disabled
          />
        </label>

        <label>
          Bairro
          <select
            value={filtros.bairro}
            onChange={(event) => alterarFiltro('bairro', event.target.value)}
          >
            <option value="">Todos</option>
            {bairrosBlumenau.map((bairro) => (
              <option key={bairro} value={bairro}>
                {bairro}
              </option>
            ))}
          </select>
        </label>

        <label>
          Rua
          <input
            value={filtros.rua}
            onChange={(event) => alterarFiltro('rua', event.target.value)}
            placeholder="Ex.: Rua Jose Deeke"
          />
        </label>

        <label>
          Categoria
          <select value={filtros.categoria} onChange={(event) => alterarFiltro('categoria', event.target.value)}>
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.value} value={categoria.value}>
                {categoria.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Nível de risco
          <select value={filtros.nivelAtencao} onChange={(event) => alterarFiltro('nivelAtencao', event.target.value)}>
            <option value="">Todos</option>
            {niveis.map((nivel) => (
              <option key={nivel.value} value={nivel.value}>
                {nivel.label}
              </option>
            ))}
          </select>
        </label>

        <div className="filter-actions">
          <button className="primary-button" type="submit">
            Aplicar filtros
          </button>
          <button className="secondary-button" type="button" onClick={limparFiltros}>
            Limpar
          </button>
        </div>
      </form>

      <SituacaoPorRegiao resumoRegiao={resumoRegiao} filtrosAtivos={filtrosAtivos} />

      <div className="cards-list">
        {alertas.length === 0 && (
          <p className="empty-state">
            {carregando ? 'Carregando alertas...' : 'Nenhum alerta encontrado.'}
          </p>
        )}

        {alertas.map((alerta) => (
          <article className="alert-card" key={alerta.id}>
            <div className="alert-meta">
              {estaProcessando(alerta) ? (
                <span className="processing-badge">IA analisando...</span>
              ) : alerta.statusProcessamento === 'Erro' ? (
                <span className="processing-error-badge">Falha na análise</span>
              ) : (
                <>
                  <span className={`level ${nivelClass(alerta.nivelAtencao)}`}>
                    Nível de risco: {niveisAtencao[alerta.nivelAtencao] ?? alerta.nivelAtencao}
                  </span>
                  <span>{categoriaLabel(alerta.categoria)}</span>
                </>
              )}
            </div>

            <h3>{localizacaoTitulo(alerta)}</h3>
            {estaProcessando(alerta) && alerta.referenciaLocalOriginal && (
              <div className="location-details">
                <span>{alerta.referenciaLocalOriginal}</span>
                <span>Referência aguardando ajuste da IA.</span>
              </div>
            )}
            {analiseConcluida(alerta) && alerta.referenciaLocalTratada && (
              <div className="location-details">
                <strong>Referência ajustada</strong>
                <span>{alerta.referenciaLocalTratada}</span>
              </div>
            )}
            {analiseConcluida(alerta) && (
              <div className={`confidence-box ${getConfiancaSituacaoClass(alerta.confiancaSituacao)}`}>
                <strong>Confiança da informação: {alerta.confiancaSituacao || 'Baixa'}</strong>
                <span>Indica se existem outros relatos parecidos na mesma região.</span>
                <span>{mensagemConfiancaInformacao(alerta)}</span>
              </div>
            )}
            {alerta.statusProcessamento === 'Erro' && (
              <p className="processing-error">
                Não foi possível concluir o tratamento automático. Revisão recomendada.
              </p>
            )}
            {(alerta.possuiDadosSensiveis || alerta.precisaRevisaoHumana) && (
              <span className="review-badge">Revisão recomendada</span>
            )}
            {estaProcessando(alerta) && (
              <div className="original-message">
                <p>{alerta.mensagemOriginal}</p>
                <span>Mensagem original aguardando tratamento da IA.</span>
              </div>
            )}
            {analiseConcluida(alerta) && (
              <>
                <p className="treated-message">{conteudoTratadoAlerta(alerta)}</p>
                {alerta.resumo && alerta.resumo !== conteudoTratadoAlerta(alerta) && (
                  <p className="alert-summary">{alerta.resumo}</p>
                )}
                {alerta.orientacaoPreventiva && (
                  <p className="preventive-guidance">
                    <strong>Orientação preventiva:</strong> {alerta.orientacaoPreventiva}
                  </p>
                )}
              </>
            )}
            <time dateTime={alerta.criadoEm}>
              {new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(alerta.criadoEm))}
            </time>
          </article>
        ))}
      </div>
    </section>
  )
}

function SituacaoPorRegiao({ resumoRegiao, filtrosAtivos }) {
  const regiaoSelecionada = filtrosAtivos.bairro
    ? `Blumenau · ${filtrosAtivos.bairro}`
    : 'Blumenau · Todos os bairros'

  return (
    <section className="region-panel">
      <div className="summary-title">
        <h2>Situação por região</h2>
        <span>{regiaoSelecionada}</span>
      </div>

      <div className="risk-explanation">
        <h3>Nível de risco</h3>
        <p>Indica a criticidade da situação e o grau de atenção recomendado para a comunidade.</p>
      </div>

      <div className="metrics-grid region-metrics">
        <article className="metric-card total region-total">
          <span>Total</span>
          <strong>{resumoRegiao.totalAlertas ?? 0}</strong>
        </article>

        {[...niveis].reverse().map((nivel) => (
          <article className={`metric-card attention-${nivelClass(nivel.value).replace('level-', '')}`} key={nivel.value}>
            <span>Risco {nivel.label.toLowerCase()}</span>
            <strong>{resumoRegiao.totalPorNivelAtencao?.[nivel.value] ?? 0}</strong>
          </article>
        ))}
      </div>

      <div className="region-breakdown">
        <div className="breakdown-list">
          <h3>Por categoria</h3>
          {categorias.map((categoria) => (
            <div key={categoria.value}>
              <span>{categoria.label}</span>
              <strong>{resumoRegiao.totalPorCategoria?.[categoria.value] ?? 0}</strong>
            </div>
          ))}
        </div>

        <div className="breakdown-list">
          <h3>Por confiança da informação</h3>
          <p className="breakdown-help">Indica se existem outros relatos parecidos na mesma região.</p>
          {['Baixa', 'Média', 'Alta'].map((confianca) => (
            <div className={getConfiancaSituacaoClass(confianca)} key={confianca}>
              <span>Confiança da informação: {confianca.toLowerCase()}</span>
              <strong>{resumoRegiao.totalPorConfiancaSituacao?.[confianca] ?? 0}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="recent-list">
        <h3>Ultimos alertas da regiao</h3>
        {resumoRegiao.ultimosAlertas?.length ? (
          resumoRegiao.ultimosAlertas.map((alerta) => (
            <article key={alerta.id}>
              <strong>{localizacaoTitulo(alerta)}</strong>
              <span>
                {estaProcessando(alerta)
                  ? 'IA analisando...'
                  : alerta.statusProcessamento === 'Erro'
                    ? 'Revisão recomendada'
                    : `${categoriaLabel(alerta.categoria)} · Nível de risco: ${niveisAtencao[alerta.nivelAtencao]}`}
              </span>
            </article>
          ))
        ) : (
          <p>Nenhum alerta encontrado para esta regiao.</p>
        )}
      </div>
    </section>
  )
}

export default App
