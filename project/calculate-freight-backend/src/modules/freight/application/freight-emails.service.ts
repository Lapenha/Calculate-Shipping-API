import fs from 'node:fs/promises'
import nodemailer from 'nodemailer'
import ExcelJS from 'exceljs'
import { env } from '../../../config/env'
import { AppError } from '../../../shared/errors/app-error'
import { EmailSendLog } from './email-send-jobs.service'
import { PacFreightJobsService } from './pac-freight-jobs.service'

interface FreightEmailRow {
  cartela: number
  nome: string
  email: string
  endereco: string
  cepDestino: string
  medidas: string
  pesoKg: number
  leilao: string
  fretePac: string
  prazoPac: string
  freteLoggi: string
  prazoLoggi: string
  freteJadlog: string
  prazoJadlog: string
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function freightLine(label: string, value: string, deliveryTime: string) {
  if (!value || value.toLowerCase().includes('indisponivel')) return ''

  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8edf2;font-weight:700;color:#18395f;">${label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8edf2;color:#1f2933;">${escapeHtml(value)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8edf2;color:#1f2933;">${escapeHtml(deliveryTime)}</td>
    </tr>
  `
}

function buildEmailHtml(row: FreightEmailRow) {
  const leilao = row.leilao || ''
  const title = leilao ? `Frete MK Toys - Leilao ${leilao}` : 'Frete MK Toys'

  return `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #dfe6ee;">
              <tr>
                <td align="center" style="background:#19395f;padding:24px 16px;">
                  <div style="font-size:22px;line-height:1.2;font-weight:800;color:#f1d25f;">MK Toys e Antique</div>
                </td>
              </tr>
              <tr>
                <td style="padding:26px 28px 10px;">
                  <h1 style="margin:0 0 10px;font-size:24px;line-height:1.25;color:#102033;">${escapeHtml(title)}</h1>
                  <p style="margin:0;font-size:15px;line-height:1.5;color:#526070;">Ola, ${escapeHtml(row.nome)}.</p>
                  <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#526070;">Apos, seguem as opcoes de fretes disponiveis para a sua cartela.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 28px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8bf;border:1px solid #f0df67;border-radius:8px;">
                    <tr>
                      <td style="padding:14px 16px;font-size:15px;"><strong>Cartela:</strong> ${escapeHtml(row.cartela)}</td>
                      <td style="padding:14px 16px;font-size:15px;"><strong>Medidas:</strong> ${escapeHtml(row.medidas)} cm</td>
                      <td style="padding:14px 16px;font-size:15px;"><strong>Peso:</strong> ${escapeHtml(row.pesoKg)} kg</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 18px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #dfe6ee;border-radius:8px;">
                    <tr>
                      <td style="padding:14px 16px;font-size:14px;line-height:1.5;color:#1f2933;">
                        <strong>Endereco para conferencia:</strong> ${escapeHtml(row.endereco || 'Nao informado')}<br>
                        <strong>CEP:</strong> ${escapeHtml(row.cepDestino)}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 26px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dfe6ee;border-radius:8px;overflow:hidden;">
                    <tr>
                      <th align="left" style="padding:11px 12px;background:#19395f;color:#ffffff;font-size:13px;">Tipo de envio</th>
                      <th align="left" style="padding:11px 12px;background:#19395f;color:#ffffff;font-size:13px;">Preco e servico</th>
                      <th align="left" style="padding:11px 12px;background:#19395f;color:#ffffff;font-size:13px;">Prazo</th>
                    </tr>
                    ${freightLine('PAC', row.fretePac, row.prazoPac)}
                    ${freightLine('Loggi', row.freteLoggi, row.prazoLoggi)}
                    ${freightLine('Jadlog', row.freteJadlog, row.prazoJadlog)}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 30px;color:#526070;font-size:14px;line-height:1.5;">
                  Responda este email informando a opcao desejada para seguirmos com o envio.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export class FreightEmailsService {
  constructor(private readonly jobsService = new PacFreightJobsService()) {}

  async sendJobEmails(
    jobId: string,
    callbacks: {
      onStart?: (total: number) => void
      onLog?: (log: EmailSendLog) => void
    } = {},
  ) {
    if (!env.smtpUser || !env.smtpPass || !env.emailFrom) {
      throw new AppError('Configure SMTP_USER, SMTP_PASS e EMAIL_FROM no .env para enviar emails.', 422)
    }

    const result = await this.jobsService.downloadResult(jobId)
    const workbook = new ExcelJS.Workbook()
    const fileBuffer = await fs.readFile(result.filePath)
    await workbook.xlsx.load(fileBuffer as unknown as ExcelJS.Buffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) {
      throw new AppError('Planilha de resultado vazia.', 500)
    }

    const headers = (sheet.getRow(1).values as unknown[])
      .slice(1)
      .map((value) => String(value ?? ''))
    const rows: FreightEmailRow[] = []

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return

      const currentRow: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        currentRow[header] = row.getCell(index + 1).value ?? ''
      })
      rows.push(currentRow as unknown as FreightEmailRow)
    })

    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    })

    let sent = 0
    const failed: Array<{ email: string; reason: string }> = []

    const rowsWithEmail = rows.filter((row) => Boolean(row.email))
    callbacks.onStart?.(rowsWithEmail.length)

    for (const [index, row] of rowsWithEmail.entries()) {
      if (!row.email) continue
      callbacks.onLog?.({
        nome: row.nome,
        email: row.email,
        status: 'waiting',
        message: 'Aguardando envio.',
      })

      const leilao = row.leilao ? ` - Leilao ${row.leilao}` : ''
      try {
        await transporter.sendMail({
          from: `"MK Toys e Antique" <${env.emailFrom}>`,
          to: row.email,
          subject: `Frete MK Toys${leilao}`,
          html: buildEmailHtml(row),
        })
        sent += 1
        callbacks.onLog?.({
          nome: row.nome,
          email: row.email,
          status: 'sent',
          message: 'Email enviado.',
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Falha ao enviar.'
        failed.push({
          email: row.email,
          reason: errorMessage,
        })
        callbacks.onLog?.({
          nome: row.nome,
          email: row.email,
          status: 'failed',
          message: errorMessage,
          errorCode:
            typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined,
        })
      }

      const hasNextEmail = index < rowsWithEmail.length - 1
      if (hasNextEmail && env.emailSendDelayMs > 0) {
        await wait(env.emailSendDelayMs)
      }
    }

    return {
      sent,
      failed,
      total: rows.length,
      delayMs: env.emailSendDelayMs,
    }
  }
}
