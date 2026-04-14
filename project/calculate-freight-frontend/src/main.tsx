import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type JobStatus = 'idle' | 'uploading' | 'waiting' | 'active' | 'completed' | 'failed' | 'error'

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
  nome: string
  email: string
  status: 'waiting' | 'sent' | 'failed'
  message: string
  errorCode?: string
}

interface EmailJobStatus {
  id: string
  status: 'waiting' | 'active' | 'completed' | 'failed'
  sent: number
  failed: number
  total: number
  logs: EmailLog[]
  error: string | null
}

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null)
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

  const cleanCep = useMemo(() => originCep.replace(/\D/g, ''), [originCep])
  const canSubmit = Boolean(file && cleanCep.length === 8 && status !== 'uploading' && status !== 'active')

  const chooseFile = useCallback((selectedFile?: File) => {
    if (!selectedFile) return

    const allowedExtensions = ['.xlsx', '.csv']
    const lowerName = selectedFile.name.toLowerCase()
    const isAllowed = allowedExtensions.some((extension) => lowerName.endsWith(extension))

    if (!isAllowed) {
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
        body: formData,
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel criar o calculo.')
      }

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

    const response = await fetch(`/api/v1/freights/pac/jobs/${job.jobId}/download`)
    if (!response.ok) {
      setMessage('A planilha ainda nao esta pronta para baixar.')
      return
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const fileName = jobStatus?.result?.fileName || `fretes_${job.jobId}.xlsx`

    link.href = url
    link.download = fileName
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
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Nao foi possivel enviar os emails.')
      }

      setEmailJobId(payload.emailJobId)
      setEmailMessage('Envio de emails iniciado.')
    } catch (error) {
      setEmailMessage(error instanceof Error ? error.message : 'Falha ao enviar emails.')
      setIsSendingEmails(false)
    }
  }

  useEffect(() => {
    if (!emailJobId) return

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/freights/pac/email-jobs/${emailJobId}`)
        const payload = (await response.json()) as EmailJobStatus

        if (!response.ok) {
          throw new Error('Nao foi possivel consultar os emails.')
        }

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
  }, [emailJobId])

  useEffect(() => {
    if (!job || status === 'completed' || status === 'failed' || status === 'error') return

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/freights/pac/jobs/${job.jobId}`)
        const payload = (await response.json()) as StatusResponse

        if (!response.ok) {
          throw new Error('Nao foi possivel consultar o status.')
        }

        setJobStatus(payload)
        setStatus(payload.status)

        if (payload.status === 'completed') {
          setMessage(`Planilha pronta com ${payload.result?.rowsCount ?? 0} fretes calculados.`)
        } else if (payload.status === 'failed') {
          setMessage(payload.failedReason || 'O calculo falhou.')
        } else {
          setMessage('Calculando os fretes...')
        }
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Erro ao consultar o calculo.')
      }
    }, 2500)

    return () => window.clearInterval(interval)
  }, [job, status])

  return (
    <main className="app-shell">
      <section className="panel">
        <div className="brand-row">
          <img className="brand-logo" src="/logo-mk.png" alt="MK Toys e Antique" />
          <div>
            <h1>Fretes MK Toys</h1>
            <p>Calcule PAC, Loggi e Jadlog pelo Melhor Envio.</p>
          </div>
        </div>

        <label className="field">
          <span>CEP de origem</span>
          <input
            value={originCep}
            onChange={(event) => setOriginCep(event.target.value)}
            inputMode="numeric"
            placeholder="00000000"
            maxLength={9}
          />
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
          <span className="upload-icon" aria-hidden="true">
            XLS
          </span>
          <strong>{file ? file.name : 'Arraste a planilha aqui'}</strong>
          <small>ou clique para escolher um arquivo .xlsx ou .csv</small>
        </button>

        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          accept=".xlsx,.csv"
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />

        <div className="actions">
          <button className="primary" type="button" disabled={!canSubmit} onClick={submitSheet}>
            {status === 'uploading' ? 'Enviando...' : 'Calcular fretes'}
          </button>
          <button className="secondary" type="button" disabled={status !== 'completed'} onClick={downloadResult}>
            Baixar planilha
          </button>
          <button className="secondary" type="button" disabled={status !== 'completed' || isSendingEmails} onClick={sendEmails}>
            {isSendingEmails ? 'Enviando emails...' : 'Enviar emails'}
          </button>
        </div>

        <div className={`status status-${status}`}>
          <span>{message}</span>
          {job && <small>Job #{job.jobId}</small>}
        </div>
        {emailMessage && <div className="status">{emailMessage}</div>}
        {emailJobStatus && (
          <div className="email-log">
            <div className="email-log-header">
              <strong>Logs de envio</strong>
              <span>
                {emailJobStatus.sent}/{emailJobStatus.total} enviados
              </span>
            </div>
            <div className="email-log-list">
              {emailJobStatus.logs.map((log, index) => (
                <div className={`email-log-row log-${log.status}`} key={`${log.email}-${index}`}>
                  <span className="log-status">{log.status}</span>
                  <span className="log-name">{log.nome || 'Sem nome'}</span>
                  <span className="log-email">{log.email}</span>
                  <span className="log-message">
                    {log.message}
                    {log.errorCode ? ` (${log.errorCode})` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
