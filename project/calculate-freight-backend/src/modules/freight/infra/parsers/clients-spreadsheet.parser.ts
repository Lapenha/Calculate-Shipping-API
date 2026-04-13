import { AppError } from '../../../../shared/errors/app-error'
import { Client } from '../../domain/entities'
import { onlyDigits } from './normalize'
import { loadSpreadsheetRows } from './spreadsheet-loader'

export class ClientsSpreadsheetParser {
  async parse(filePath: string): Promise<Client[]> {
    const rows = await loadSpreadsheetRows(filePath)

    const parsed = rows
      .map((row) => {
        const cartelaRaw = row.cartela || row.codigo || row.numero
        const nome = row.nome || row.arrematante
        const email = row.email || ''
        const cepRaw = row.cep || row.cepdestino || ''

        const cartela = Number(onlyDigits(cartelaRaw || ''))
        const cepDestino = onlyDigits(cepRaw).padStart(8, '0')

        if (!cartela || !nome || cepDestino.length !== 8) {
          return null
        }

        return {
          cartela,
          nome,
          email,
          cepDestino,
        }
      })
      .filter((item): item is Client => item !== null)

    if (!parsed.length) {
      throw new AppError('Nao foi possivel ler clientes validos da planilha.')
    }

    return parsed
  }
}

