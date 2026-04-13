import { FreightEmailsService } from './freight-emails.service'

export type EmailSendLogStatus = 'waiting' | 'sent' | 'failed'
export type EmailSendJobStatus = 'waiting' | 'active' | 'completed' | 'failed'

export interface EmailSendLog {
  nome: string
  email: string
  status: EmailSendLogStatus
  message: string
  errorCode?: string
}

interface EmailSendJob {
  id: string
  freightJobId: string
  status: EmailSendJobStatus
  sent: number
  failed: number
  total: number
  logs: EmailSendLog[]
  error: string | null
}

const emailJobs = new Map<string, EmailSendJob>()
let emailJobSequence = 0

export class EmailSendJobsService {
  constructor(private readonly emailsService = new FreightEmailsService()) {}

  create(freightJobId: string) {
    const id = `email-${Date.now()}-${++emailJobSequence}`
    const job: EmailSendJob = {
      id,
      freightJobId,
      status: 'waiting',
      sent: 0,
      failed: 0,
      total: 0,
      logs: [],
      error: null,
    }

    emailJobs.set(id, job)

    setImmediate(async () => {
      job.status = 'active'

      try {
        await this.emailsService.sendJobEmails(freightJobId, {
          onStart: (total) => {
            job.total = total
          },
          onLog: (log) => {
            job.logs.push(log)
            if (log.status === 'sent') job.sent += 1
            if (log.status === 'failed') job.failed += 1
          },
        })
        job.status = 'completed'
      } catch (error) {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Falha ao enviar emails.'
      }
    })

    return {
      emailJobId: id,
      status: job.status,
      message: 'Envio de emails iniciado.',
    }
  }

  getStatus(emailJobId: string) {
    const job = emailJobs.get(emailJobId)
    if (!job) {
      return null
    }

    return job
  }
}
