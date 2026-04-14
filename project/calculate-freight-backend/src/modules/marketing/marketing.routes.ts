import fs from 'node:fs/promises'
import path from 'node:path'
import { NextFunction, Request, Response, Router } from 'express'
import multer from 'multer'
import nodemailer from 'nodemailer'
import { env } from '../../config/env'
import { AppError } from '../../shared/errors/app-error'
import { pool } from '../../shared/db/postgres'

type MarketingJobStatus = 'waiting' | 'active' | 'completed' | 'failed'
type MarketingLogStatus = 'waiting' | 'sent' | 'failed' | 'skipped'

interface MarketingLog {
  email: string
  status: MarketingLogStatus
  message: string
  errorCode?: string
}

interface MarketingJob {
  id: string
  status: MarketingJobStatus
  total: number
  sent: number
  failed: number
  skipped: number
  logs: MarketingLog[]
  error: string | null
}

interface MarketingMessage {
  email: string
  subject: string
  html: string
  coverPath: string
  coverFilename: string
  logoPath: string
}

const jobs = new Map<string, MarketingJob>()
let sequence = 0

const upload = multer({ dest: env.uploadDir })
const router = Router()

function parseEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    ),
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildMarketingHtml(input: {
  auctionNumber: string
  description: string
  ctaUrl: string
  unsubscribeUrl: string
  useCidLogo: boolean
  useCidCover: boolean
}) {
  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="max-width:680px;width:100%;background:#ffffff;border:1px solid #dfe6ee;border-radius:8px;overflow:hidden;">
              <tr>
                <td align="center" style="background:#071126;padding:22px 16px;">
                  ${
                    input.useCidLogo
                      ? '<img src="cid:logo" alt="MK Toys e Antique" width="108" style="display:block;border:0;max-width:108px;">'
                      : '<div style="font-size:22px;font-weight:800;color:#f1d25f;letter-spacing:.2px;">MK Toys e Antique</div>'
                  }
                </td>
              </tr>
              <tr>
                <td style="padding:26px 28px 12px;text-align:center;">
                  <h1 style="margin:0 0 10px;font-size:24px;color:#091125;">Leilao ${escapeHtml(input.auctionNumber)} MK Toys e Antique esta no ar</h1>
                  <div style="font-size:16px;line-height:1.55;color:#334155;">${escapeHtml(input.description).replace(/\n/g, '<br>')}</div>
                </td>
              </tr>
              ${
                input.useCidCover
                  ? '<tr><td align="center" style="padding:12px 28px 20px;"><img src="cid:cover" alt="Capa do leilao" width="420" style="display:block;border:0;max-width:100%;border-radius:8px;"></td></tr>'
                  : ''
              }
              <tr>
                <td align="center" style="padding:8px 28px 28px;">
                  <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#f1d25f;color:#091125;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:8px;">Lance agora</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="border-top:1px solid #e5e7eb;padding:18px 28px 28px;font-size:12px;color:#64748b;">
                  Voce recebeu este email porque esta na lista da MK Toys e Antique.<br>
                  <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#147b92;">Descadastrar</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}

async function sendWithGmail(input: MarketingMessage) {
  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  })

  await transporter.sendMail({
    from: `"MK Toys e Antique" <${env.emailFrom}>`,
    to: input.email,
    subject: input.subject,
    html: input.html,
    attachments: [
      { filename: 'logo-mk.png', path: input.logoPath, cid: 'logo' },
      ...(input.coverPath
        ? [{ filename: input.coverFilename, path: input.coverPath, cid: 'cover' }]
        : []),
    ],
  })
}

async function sendWithBrevo(input: MarketingMessage) {
  if (!env.brevoApiKey) {
    throw new AppError('BREVO_API_KEY nao configurada.', 500)
  }

  const attachments = []
  if (input.coverPath) {
    const content = await fs.readFile(input.coverPath)
    attachments.push({
      name: input.coverFilename,
      content: content.toString('base64'),
    })
  }

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': env.brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.brevoSenderName, email: env.brevoSenderEmail },
      to: [{ email: input.email }],
      replyTo: { name: env.brevoReplyToName, email: env.brevoReplyToEmail },
      subject: input.subject,
      htmlContent: input.html,
      ...(attachments.length ? { attachment: attachments } : {}),
    }),
  })

  if (!brevoResponse.ok) {
    const body = await brevoResponse.text()
    const error = new Error(body || `Brevo respondeu ${brevoResponse.status}`)
    Object.assign(error, { code: `BREVO_${brevoResponse.status}` })
    throw error
  }
}

async function sendMarketingEmail(input: MarketingMessage) {
  if (env.marketingProvider.toLowerCase() === 'brevo') {
    await sendWithBrevo(input)
    return
  }

  await sendWithGmail(input)
}

router.post(
  '/jobs',
  upload.single('coverImage'),
  async (request: Request, response: Response, next: NextFunction) => {
    try {
      const emails = parseEmails(String(request.body?.emails || ''))
      const auctionNumber = String(request.body?.auctionNumber || '').trim()
      const subject =
        String(request.body?.subject || '').trim() ||
        `O Leilao ${auctionNumber} MK Toys e Antique esta no ar`
      const description = String(request.body?.description || '').trim()
      const ctaUrl = String(request.body?.ctaUrl || '').trim() || 'https://www.mktoyseantique.com.br/'
      const coverPath = request.file?.path || ''

      if (!emails.length) throw new AppError('Informe ao menos um email valido.', 422)
      if (!auctionNumber) throw new AppError('Informe o numero do leilao.', 422)
      if (!description) throw new AppError('Informe a descricao do convite.', 422)

      const id = `marketing-${Date.now()}-${++sequence}`
      const job: MarketingJob = {
        id,
        status: 'waiting',
        total: emails.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        logs: [],
        error: null,
      }
      jobs.set(id, job)

      setImmediate(async () => {
        job.status = 'active'

        try {
          const unsubscribes = await pool.query('SELECT email FROM marketing_unsubscribes')
          const blocked = new Set(unsubscribes.rows.map((row) => String(row.email).toLowerCase()))
          const logoPath = path.resolve(process.cwd(), '..', 'calculate-freight-frontend', 'public', 'logo-mk.png')
          const useBrevo = env.marketingProvider.toLowerCase() === 'brevo'

          for (const [index, email] of emails.entries()) {
            if (blocked.has(email)) {
              job.skipped += 1
              job.logs.push({ email, status: 'skipped', message: 'Email descadastrado.' })
              continue
            }

            job.logs.push({ email, status: 'waiting', message: 'Aguardando envio.' })
            try {
              const unsubscribeUrl = `${env.appPublicUrl}/api/v1/marketing/unsubscribe?email=${encodeURIComponent(email)}`
              const html = buildMarketingHtml({
                auctionNumber,
                description,
                ctaUrl,
                unsubscribeUrl,
                useCidLogo: !useBrevo,
                useCidCover: Boolean(coverPath) && !useBrevo,
              })

              await sendMarketingEmail({
                email,
                subject,
                html,
                coverPath,
                coverFilename: request.file?.originalname || 'capa.png',
                logoPath,
              })
              job.sent += 1
              job.logs.push({
                email,
                status: 'sent',
                message: useBrevo ? 'Email enviado pela Brevo.' : 'Email enviado pelo Gmail.',
              })
            } catch (error) {
              job.failed += 1
              job.logs.push({
                email,
                status: 'failed',
                message: error instanceof Error ? error.message : 'Falha ao enviar.',
                errorCode:
                  typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
              })
            }

            if (index < emails.length - 1 && env.marketingEmailSendDelayMs > 0) {
              await wait(env.marketingEmailSendDelayMs)
            }
          }

          job.status = 'completed'
          if (coverPath) await fs.rm(coverPath, { force: true })
        } catch (error) {
          job.status = 'failed'
          job.error = error instanceof Error ? error.message : 'Falha no envio de marketing.'
          if (coverPath) await fs.rm(coverPath, { force: true })
        }
      })

      return response.status(202).json({
        marketingJobId: id,
        status: job.status,
        message: 'Envio de marketing iniciado.',
      })
    } catch (error) {
      return next(error)
    }
  },
)

router.get('/jobs/:jobId', (request, response) => {
  const job = jobs.get(String(request.params.jobId))
  if (!job) throw new AppError('Job de marketing nao encontrado.', 404)
  return response.status(200).json(job)
})

router.get('/unsubscribe', async (request, response) => {
  const email = String(request.query.email || '').trim().toLowerCase()
  if (email) {
    await pool.query(
      'INSERT INTO marketing_unsubscribes (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email],
    )
  }

  return response
    .status(200)
    .send('<h1>Descadastro confirmado</h1><p>Voce nao recebera novos emails de marketing.</p>')
})

export const marketingRoutes = router
