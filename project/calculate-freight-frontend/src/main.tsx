import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type JobStatus = 'idle' | 'uploading' | 'waiting' | 'active' | 'completed' | 'failed' | 'error'
type Tool = 'freights' | 'marketing'

interface CreatedJob {
  jobId: string
  status: JobStatus
  message: string
}

interface StatusResponse {
  id: string
  status: JobStatus
  progress: number | object
  failedReason: string | null
  result: { rowsCount: number; fileName: string } | null
}

interface EmailLog {
  nome?: string
  email: string
  status: 'waiting' | 'sent' | 'failed' | 'skipped'
  message: string
  errorCode?: string
}

interface EmailJobStatus {
  id: string
  status: 'waiting' | 'active' | 'completed' | 'failed'
  sent: number
  failed: number
  skipped?: number
  total: number
  logs: EmailLog[]
  error: string | null
}

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const marketingImageRef = useRef<HTMLInputElement | null>(null)
  const [token, setToken] = useState(() => localStorage.getItem('mk-auth-token') || '')
  const [loginEmail, setLoginEmail] = useState('mktoyseantique@gmail.com')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginMessage, setLoginMessage] = useState('')
  const [activeTool, setActiveTool] = useState<Tool>('freights')

  const [originCep, setOriginCep] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [job, setJob] = useState<CreatedJob | null>(null)
  const [jobStatus, setJobStatus] = useState<StatusResponse | null>(null)
  const [status, setStatus] = useState<JobStatus>('idle')
  const [message, setMessage] = useState('Anexe a planilha para calcular PAC, Loggi e Jadlog pelo Melhor Envio.')
  const [emailMessage, setEmailMessage] = useState('')
  const [isSendingEmails, setIsSendingEmails] = useState(false)
  const [emailJobId, setEmailJobId] = useState<string | null>(null)
  const [emailJobStatus, setEmailJobStatus] = useState<EmailJobStatus | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const [marketingEmails, setMarketingEmails] = useState('')
  const [marketingAuction, setMarketingAuction] = useState('')
  const [marketingSubject, setMarketingSubject] = useState('')
  const [marketingDescription, setMarketingDescription] = useState('')
  const [marketingCtaUrl, setMarketingCtaUrl] = useState('https://www.mktoyseantique.com.br/')
  const [marketingImage, setMarketingImage] = useState<File | null>(null)
  const [marketingJobId, setMarketingJobId] = useState<string | null>(null)
  const [marketingStatus, setMarketingStatus] = useState<EmailJobStatus | null>(null)
  const [marketingMessage, setMarketingMessage] = useState('')
  const [isSendingMarketing, setIsSendingMarketing] = useState(false)

  const cleanCep = useMemo(() => originCep.replace(/\D/g, ''), [originCep])
  const canSubmit = Boolean(file && cleanCep.length === 8 && status !== 'uploading' && status !== 'active')

  function authHeaders() {
    return { Authorization: `Bearer ${token}` }
  }

  async function login() {
    setLoginMessage('Entrando...')
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Nao foi possivel entrar.')
      localStorage.setItem('mk-auth-token', payload.token)
      setToken(payload.token)
      setLoginMessage('')
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : 'Falha no login.')
    }
  }

  function logout() {
    localStorage.removeItem('mk-auth-token')
    setToken('')
  }

  const chooseFile = useCallback((selectedFile?: File) => {
    if (!selectedFile) return
    const lowerName = selectedFile.name.toLowerCase()
    if (!['.xlsx', '.csv'].some((extension) => lowerName.endsWith(extension))) {
      setMessage('Use uma planilha .xlsx ou .csv.')
      return
    }
    setFile(selectedFile)
    setJob(null)
    setJobStatus(null)
    setEmailJobId(null)
    setEmailJobStatus(null)
    setEmailMessage('')
    setStatus('idle')
    setMessage('Planilha pronta para calcular.')
  }, [])

  async function submitSheet() {
    if (!file || cleanCep.length !== 8) {
      setMessage('Informe o CEP de origem com 8 digitos e anexe a planilha.')
      return
    }
    setStatus('uploading')
    setMessage('Enviando planilha...')
    const formData = new FormData()
    formData.append('originCep', cleanCep)
    formData.append('sheet', file)
    try {
      const response = await fetch('/api/v1/freights/pac/jobs', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Nao foi possivel criar o calculo.')
      setJob(payload)
      setStatus(payload.status)
      setMessage('Calculo iniciado. Pode deixar essa tela aberta.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Falha ao enviar a planilha.')
    }
  }

  async function downloadResult() {
    if (!job) return
    const response = await fetch(`/api/v1/freights/pac/jobs/${job.jobId}/download`, {
      headers: authHeaders(),
    })
    if (!response.ok) {
      setMessage('A planilha ainda nao esta pronta para baixar.')
      return
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = jobStatus?.result?.fileName || `fretes_${job.jobId}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function sendEmails() {
    if (!job) return
    setIsSendingEmails(true)
    setEmailMessage('Enviando emails...')
    try {
      const response = await fetch(`/api/v1/freights/pac/jobs/${job.jobId}/emails`, {
        method: 'POST',
        headers: authHeaders(),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Nao foi possivel enviar os emails.')
      setEmailJobId(payload.emailJobId)
      setEmailMessage('Envio de emails iniciado.')
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : 'Falha ao enviar emails.')
      setIsSendingEmails(false)
    }
  }

  async function sendMarketing() {
    const formData = new FormData()
    formData.append('emails', marketingEmails)
    formData.append('auctionNumber', marketingAuction)
    formData.append('subject', marketingSubject)
    formData.append('description', marketingDescription)
    formData.append('ctaUrl', marketingCtaUrl)
    if (marketingImage) formData.append('coverImage', marketingImage)

    setIsSendingMarketing(true)
    setMarketingMessage('Iniciando envio de marketing...')
    setMarketingStatus(null)

    try {
      const response = await fetch('/api/v1/marketing/jobs', {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'Nao foi possivel iniciar o marketing.')
      setMarketingJobId(payload.marketingJobId)
      setMarketingMessage('Envio de marketing iniciado.')
    } catch (error) {
      setMarketingMessage(error instanceof Error ? error.message : 'Falha ao enviar marketing.')
      setIsSendingMarketing(false)
    }
  }

  useEffect(() => {
    if (!emailJobId) return
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/freights/pac/email-jobs/${emailJobId}`, { headers: authHeaders() })
        const payload = (await response.json()) as EmailJobStatus
        if (!response.ok) throw new Error('Nao foi possivel consultar os emails.')
        setEmailJobStatus(payload)
        setEmailMessage(`Emails: ${payload.sent}/${payload.total} enviados. Falhas: ${payload.failed}.`)
        if (payload.status === 'completed' || payload.status === 'failed') {
          setIsSendingEmails(false)
          window.clearInterval(interval)
        }
      } catch (error) {
        setEmailMessage(error instanceof Error ? error.message : 'Erro ao consultar emails.')
        setIsSendingEmails(false)
        window.clearInterval(interval)
      }
    }, 2000)
    return () => window.clearInterval(interval)
  }, [emailJobId, token])

  useEffect(() => {
    if (!marketingJobId) return
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/marketing/jobs/${marketingJobId}`, { headers: authHeaders() })
        const payload = (await response.json()) as EmailJobStatus
        if (!response.ok) throw new Error('Nao foi possivel consultar o marketing.')
        setMarketingStatus(payload)
        setMarketingMessage(
          `Marketing: ${payload.sent}/${payload.total} enviados. Falhas: ${payload.failed}. Descadastrados: ${payload.skipped || 0}.`,
        )
        if (payload.status === 'completed' || payload.status === 'failed') {
          setIsSendingMarketing(false)
          window.clearInterval(interval)
        }
      } catch (error) {
        setMarketingMessage(error instanceof Error ? error.message : 'Erro ao consultar marketing.')
        setIsSendingMarketing(false)
        window.clearInterval(interval)
      }
    }, 2500)
    return () => window.clearInterval(interval)
  }, [marketingJobId, token])

  useEffect(() => {
    if (!job || status === 'completed' || status === 'failed' || status === 'error') return
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/freights/pac/jobs/${job.jobId}`, { headers: authHeaders() })
        const payload = (await response.json()) as StatusResponse
        if (!response.ok) throw new Error('Nao foi possivel consultar o status.')
        setJobStatus(payload)
        setStatus(payload.status)
        if (payload.status === 'completed') setMessage(`Planilha pronta com ${payload.result?.rowsCount ?? 0} fretes calculados.`)
        else if (payload.status === 'failed') setMessage(payload.failedReason || 'O calculo falhou.')
        else setMessage('Calculando os fretes...')
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Erro ao consultar o calculo.')
      }
    }, 2500)
    return () => window.clearInterval(interval)
  }, [job, status, token])

  if (!token) {
    return (
      <main className="app-shell">
        <section className="panel login-panel">
          <div className="brand-row">
            <img className="brand-logo" src="/logo-mk.png" alt="MK Toys e Antique" />
            <div>
              <h1>Entrar</h1>
              <p>Acesse as automacoes MK Toys.</p>
            </div>
          </div>
          <label className="field">
            <span>Email</span>
            <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Senha</span>
            <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
          </label>
          <button className="primary" type="button" onClick={login}>
            Entrar
          </button>
          {loginMessage && <div className="status">{loginMessage}</div>}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="panel app-panel">
        <header className="app-header">
          <div className="brand-row">
            <img className="brand-logo" src="/logo-mk.png" alt="MK Toys e Antique" />
            <div>
              <h1>Automações MK Toys</h1>
              <p>Fretes, emails de compradores e marketing.</p>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={logout}>
            Sair
          </button>
        </header>

        <nav className="tool-tabs" aria-label="Selecionar automacao">
          <button className={activeTool === 'freights' ? 'active' : ''} type="button" onClick={() => setActiveTool('freights')}>
            Fretes
          </button>
          <button className={activeTool === 'marketing' ? 'active' : ''} type="button" onClick={() => setActiveTool('marketing')}>
            Email marketing
          </button>
        </nav>

        {activeTool === 'freights' ? (
          <>
            <label className="field">
              <span>CEP de origem</span>
              <input value={originCep} onChange={(event) => setOriginCep(event.target.value)} inputMode="numeric" placeholder="00000000" maxLength={9} />
            </label>
            <button
              className={`drop-zone ${isDragging ? 'dragging' : ''}`}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                chooseFile(event.dataTransfer.files[0])
              }}
            >
              <span className="upload-icon" aria-hidden="true">XLS</span>
              <strong>{file ? file.name : 'Arraste a planilha aqui'}</strong>
              <small>ou clique para escolher um arquivo .xlsx ou .csv</small>
            </button>
            <input ref={inputRef} className="hidden-input" type="file" accept=".xlsx,.csv" onChange={(event) => chooseFile(event.target.files?.[0])} />
            <div className="actions">
              <button className="primary" type="button" disabled={!canSubmit} onClick={submitSheet}>{status === 'uploading' ? 'Enviando...' : 'Calcular fretes'}</button>
              <button className="secondary" type="button" disabled={status !== 'completed'} onClick={downloadResult}>Baixar planilha</button>
              <button className="secondary" type="button" disabled={status !== 'completed' || isSendingEmails} onClick={sendEmails}>{isSendingEmails ? 'Enviando emails...' : 'Enviar emails'}</button>
            </div>
            <div className={`status status-${status}`}><span>{message}</span>{job && <small>Job #{job.jobId}</small>}</div>
            {emailMessage && <div className="status">{emailMessage}</div>}
            {emailJobStatus && <Logs title="Logs de envio" status={emailJobStatus} />}
          </>
        ) : (
          <>
            <div className="warning-box">
              Para 2300 emails, use com intervalo alto. Gmail pode limitar envios em massa; em produção, o ideal é um provedor transacional/marketing.
            </div>
            <label className="field">
              <span>Lista de emails</span>
              <textarea value={marketingEmails} onChange={(event) => setMarketingEmails(event.target.value)} placeholder="email1@gmail.com, email2@gmail.com" />
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Número do leilão</span>
                <input value={marketingAuction} onChange={(event) => setMarketingAuction(event.target.value)} placeholder="61066" />
              </label>
              <label className="field">
                <span>Assunto</span>
                <input value={marketingSubject} onChange={(event) => setMarketingSubject(event.target.value)} placeholder="O Leilão MK Toys está no ar" />
              </label>
            </div>
            <label className="field">
              <span>Descrição / convite</span>
              <textarea value={marketingDescription} onChange={(event) => setMarketingDescription(event.target.value)} placeholder="Não deixe de arrematar lotes incríveis. Data do leilão..." />
            </label>
            <label className="field">
              <span>Link do botão</span>
              <input value={marketingCtaUrl} onChange={(event) => setMarketingCtaUrl(event.target.value)} />
            </label>
            <button className="drop-zone compact" type="button" onClick={() => marketingImageRef.current?.click()}>
              <span className="upload-icon" aria-hidden="true">IMG</span>
              <strong>{marketingImage ? marketingImage.name : 'Anexar imagem de capa'}</strong>
              <small>PNG, JPG ou WEBP</small>
            </button>
            <input ref={marketingImageRef} className="hidden-input" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(event) => setMarketingImage(event.target.files?.[0] || null)} />
            <button className="primary" type="button" disabled={isSendingMarketing} onClick={sendMarketing}>
              {isSendingMarketing ? 'Enviando marketing...' : 'Enviar email marketing'}
            </button>
            {marketingMessage && <div className="status">{marketingMessage}</div>}
            {marketingStatus && <Logs title="Logs de marketing" status={marketingStatus} />}
          </>
        )}
      </section>
    </main>
  )
}

function Logs({ title, status }: { title: string; status: EmailJobStatus }) {
  return (
    <div className="email-log">
      <div className="email-log-header">
        <strong>{title}</strong>
        <span>{status.sent}/{status.total} enviados</span>
      </div>
      <div className="email-log-list">
        {status.logs.map((log, index) => (
          <div className={`email-log-row log-${log.status}`} key={`${log.email}-${index}`}>
            <span className="log-status">{log.status}</span>
            <span className="log-name">{log.nome || 'Marketing'}</span>
            <span className="log-email">{log.email}</span>
            <span className="log-message">{log.message}{log.errorCode ? ` (${log.errorCode})` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
