import ExcelJS from 'exceljs'
import { SpreadsheetExporter } from '../../domain/ports'

export class XlsxSpreadsheetExporter<T> implements SpreadsheetExporter<T> {
  async export(rows: T[]): Promise<Buffer> {
    const jsonRows = rows as Record<string, unknown>[]
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('fretes')
    const headers = Object.keys(jsonRows[0] || {})

    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(header.length + 4, 16),
    }))

    jsonRows.forEach((row) => worksheet.addRow(row))

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }
}
