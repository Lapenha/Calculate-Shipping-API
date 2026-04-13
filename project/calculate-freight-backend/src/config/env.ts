import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config()

const PORT = Number(process.env.PORT || 3333)
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(process.cwd(), 'storage', 'output')
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'storage', 'uploads')
const MELHOR_ENVIO_BASE_URL = process.env.MELHOR_ENVIO_BASE_URL || 'https://sandbox.melhorenvio.com.br'
const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN || ''
const MELHOR_ENVIO_USER_AGENT =
  process.env.MELHOR_ENVIO_USER_AGENT || 'Fretes em Massa (suporte@example.com)'
const MELHOR_ENVIO_INSURANCE_VALUE = Number(process.env.MELHOR_ENVIO_INSURANCE_VALUE || 1)
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.SMTP_PORT || 465)
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER
const EMAIL_SEND_DELAY_MS = Number(process.env.EMAIL_SEND_DELAY_MS || 5000)

export const env = {
  port: PORT,
  outputDir: OUTPUT_DIR,
  uploadDir: UPLOAD_DIR,
  melhorEnvioBaseUrl: MELHOR_ENVIO_BASE_URL,
  melhorEnvioToken: MELHOR_ENVIO_TOKEN,
  melhorEnvioUserAgent: MELHOR_ENVIO_USER_AGENT,
  melhorEnvioInsuranceValue: MELHOR_ENVIO_INSURANCE_VALUE,
  smtpHost: SMTP_HOST,
  smtpPort: SMTP_PORT,
  smtpSecure: SMTP_SECURE,
  smtpUser: SMTP_USER,
  smtpPass: SMTP_PASS,
  emailFrom: EMAIL_FROM,
  emailSendDelayMs: EMAIL_SEND_DELAY_MS,
}
