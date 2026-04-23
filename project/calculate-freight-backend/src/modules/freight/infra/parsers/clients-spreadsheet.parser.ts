import { AppError } from '../../../../shared/errors/app-error'
import { Client } from '../../domain/entities'
import { onlyDigits } from './normalize'
import { loadSpreadsheetRows } from './spreadsheet-loader'

function parseCurrencyLikeNumber(value: string): number {
  const trimmed = String(value || '').trim()
  if (!trimmed) return 0

  const normalized = trimmed
    .replace(/\s+/g, '')
    .replace(/[R$]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')

  const amount = Number(normalized)
  return Number.isNaN(amount) ? 0 : amount
}

export class ClientsSpreadsheetParser {
  async parse(filePath: string): Promise<Client[]> {
    const rows = await loadSpreadsheetRows(filePath)

    const parsed = rows
      .map((row) => {
        const cartelaRaw = row.cartela || row.codigo || row.numero
        const nome = row.nome || row.arrematante
        const email = row.email || ''
        const endereco = row.endereco || row.logradouro || ''
        const cepRaw = row.cep || row.cepdestino || ''
        const valorDeclaradoRaw = row.totalcompra || row.valordeclarado || row.valor || ''

        const cartela = Number(onlyDigits(cartelaRaw || ''))
        const cepDestino = onlyDigits(cepRaw).padStart(8, '0')
        const valorDeclarado = parseCurrencyLikeNumber(valorDeclaradoRaw)

        if (!cartela || !nome || cepDestino.length !== 8) {
          return null
        }

        return {
          cartela,
          nome,
          email,
          endereco,
          cepDestino,
          valorDeclarado,
        }
      })
      .filter((item): item is Client => item !== null)

    if (!parsed.length) {
      throw new AppError('Nao foi possivel ler clientes validos da planilha.')
    }

    return parsed
  }
}
