import fs from 'node:fs/promises'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { load } from 'cheerio'
import { AppError } from '../../../../shared/errors/app-error'
import { normalizeHeader } from './normalize'

function normalizeRows(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((row) => {
    const normalized: Record<string, string> = {}

    Object.entries(row).forEach(([key, value]) => {
      const header = normalizeHeader(String(key))
      if (!header) {
        return
      }

      normalized[header] = String(value ?? '').trim()
    })

    return normalized
  })
}

function rowsFromHtml(content: string): Record<string, unknown>[] {
  const $ = load(content)
  const table = $('table').first()

  if (!table.length) {
    throw new AppError('Arquivo de clientes nao possui tabela HTML valida.')
  }

  const allRows = table.find('tr')
  let headerRowIndex = -1
  const headers: string[] = []

  allRows.each((index, row) => {
    if (headerRowIndex >= 0) {
      return
    }

    const headerCells = $(row).find('th')
    if (headerCells.length) {
      headerRowIndex = index
      headerCells.each((_, element) => {
        headers.push($(element).text().trim())
      })
    }
  })

  if (headerRowIndex < 0) {
    const firstDataRow = allRows
      .toArray()
      .find((row) => $(row).find('td').length >= 3)

    if (!firstDataRow) {
      throw new AppError('Tabela HTML sem cabecalho reconhecivel.')
    }

    $(firstDataRow)
      .find('td')
      .each((index, element) => {
        headers.push(`coluna_${index}`)
        $(element).text().trim()
      })
  }

  const rows: Record<string, unknown>[] = []
  const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 1
  allRows.slice(startIndex).each((_, row) => {
    const values = $(row).find('td')
    if (!values.length) {
      return
    }

    const obj: Record<string, unknown> = {}
    values.each((index, element) => {
      const key = headers[index] || `coluna_${index}`
      obj[key] = $(element).text().trim()
    })

    rows.push(obj)
  })

  return rows
}

function scoreHeaderRow(values: string[]): number {
  const normalizedValues = values
    .map((value) => normalizeHeader(value))
    .filter(Boolean)

  const knownHeaders = new Set([
    'cartela',
    'nome',
    'email',
    'cep',
    'largura',
    'altura',
    'comprimento',
    'peso',
  ])

  return normalizedValues.filter((value) => knownHeaders.has(value)).length
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '')
    if ('result' in value) return String(value.result ?? '')
    if ('richText' in value) return value.richText.map((item) => item.text).join('')
  }

  return String(value)
}

async function workbookToMatrix(raw: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(raw as unknown as ExcelJS.Buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new AppError('Planilha vazia.')
  }

  const matrix: string[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: string[] = []
    for (let index = 1; index <= sheet.columnCount; index += 1) {
      values.push(cellToString(row.getCell(index).value).trim())
    }
    matrix.push(values)
  })

  return matrix
}

async function rowsFromWorkbook(raw: Buffer): Promise<Record<string, unknown>[]> {
  const matrix = await workbookToMatrix(raw)
  const headerRowIndex = matrix.findIndex((row) => scoreHeaderRow(row.map((cell) => String(cell ?? ''))) >= 3)
  if (headerRowIndex < 0) {
    throw new AppError('Nao foi possivel identificar o cabecalho da planilha.')
  }

  const headers = matrix[headerRowIndex].map((cell, index) => {
    const value = String(cell ?? '').trim()
    return value || `coluna_${index}`
  })

  return matrix
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const currentRow: Record<string, unknown> = {}

      headers.forEach((header, index) => {
        currentRow[header] = row[index] ?? ''
      })

      return currentRow
    })
}

function rowsFromCsv(content: string): Record<string, unknown>[] {
  const matrix = content
    .split(/\r?\n/)
    .map((line) => line.split(';').length > line.split(',').length ? line.split(';') : line.split(','))
    .map((row) => row.map((cell) => cell.trim()))

  const headerRowIndex = matrix.findIndex((row) => scoreHeaderRow(row) >= 3)
  if (headerRowIndex < 0) {
    throw new AppError('Nao foi possivel identificar o cabecalho da planilha.')
  }

  const headers = matrix[headerRowIndex].map((cell, index) => cell || `coluna_${index}`)

  return matrix
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const currentRow: Record<string, unknown> = {}
      headers.forEach((header, index) => {
        currentRow[header] = row[index] ?? ''
      })
      return currentRow
    })
}

export async function loadSpreadsheetRows(filePath: string): Promise<Record<string, string>[]> {
  const raw = await fs.readFile(filePath)
  const rawText = raw.toString('utf8')
  const startsAsHtml = /^\s*<(?:!doctype|html)/i.test(rawText)

  if (startsAsHtml) {
    return normalizeRows(rowsFromHtml(rawText))
  }

  if (path.extname(filePath).toLowerCase() === '.csv') {
    return normalizeRows(rowsFromCsv(rawText))
  }

  return normalizeRows(await rowsFromWorkbook(raw))
}

export async function loadSpreadsheetAuctionNumber(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath)
  const rawText = raw.toString('utf8')
  const startsAsHtml = /^\s*<(?:!doctype|html)/i.test(rawText)
  let text = rawText
  if (startsAsHtml) {
    text = load(rawText).text()
  } else if (path.extname(filePath).toLowerCase() === '.csv') {
    text = rawText
  } else {
    const matrix = await workbookToMatrix(raw)
    text = matrix.map((row) => row.join(',')).join('\n')
  }

  const match = text.match(/leil[aã]o\D+(\d+)/i)
  return match?.[1] || ''
}
