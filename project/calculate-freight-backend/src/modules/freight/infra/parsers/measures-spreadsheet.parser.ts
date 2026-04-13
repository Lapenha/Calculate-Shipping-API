import { AppError } from '../../../../shared/errors/app-error'
import { PackageMeasure } from '../../domain/entities'
import { onlyDigits } from './normalize'
import { loadSpreadsheetRows } from './spreadsheet-loader'

function parseNumber(value: string): number {
  const normalized = value.replace(',', '.').trim()
  return Number(normalized)
}

function parseMedidasString(value: string): { alturaCm: number; larguraCm: number; comprimentoCm: number } | null {
  const parts = value
    .toLowerCase()
    .split('x')
    .map((part) => parseNumber(part))
    .filter((part) => !Number.isNaN(part))

  if (parts.length !== 3) {
    return null
  }

  return {
    alturaCm: parts[0],
    larguraCm: parts[1],
    comprimentoCm: parts[2],
  }
}

export class MeasuresSpreadsheetParser {
  async parse(filePath: string): Promise<PackageMeasure[]> {
    const rows = await loadSpreadsheetRows(filePath)

    const parsed = rows
      .map((row) => {
        const cartela = Number(onlyDigits(row.cartela || row.codigo || row.numero || ''))
        const pesoKg = parseNumber(row.pesokg || row.peso || '')

        const parsedMedidas = parseMedidasString(row.medidas || '')
        const alturaCm = parsedMedidas?.alturaCm ?? parseNumber(row.alturacm || row.altura || '')
        const larguraCm = parsedMedidas?.larguraCm ?? parseNumber(row.larguracm || row.largura || '')
        const comprimentoCm =
          parsedMedidas?.comprimentoCm ?? parseNumber(row.comprimentocm || row.comprimento || '')

        if (
          !cartela ||
          Number.isNaN(alturaCm) ||
          Number.isNaN(larguraCm) ||
          Number.isNaN(comprimentoCm) ||
          Number.isNaN(pesoKg)
        ) {
          return null
        }

        return {
          cartela,
          alturaCm,
          larguraCm,
          comprimentoCm,
          pesoKg,
        }
      })
      .filter((item): item is PackageMeasure => item !== null)

    if (!parsed.length) {
      throw new AppError('Nao foi possivel ler medidas validas da planilha.')
    }

    return parsed
  }
}

