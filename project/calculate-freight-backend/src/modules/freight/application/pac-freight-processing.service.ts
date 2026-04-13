import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../../../config/env'
import { Client, FreightResult, PackageMeasure } from '../domain/entities'
import { SpreadsheetExporter } from '../domain/ports'

interface ProcessPacFreightsInput {
  originCep: string
  leilao?: string
  clients: Client[]
  measures: PackageMeasure[]
}

interface ProcessPacFreightsOutput {
  buffer: Buffer
  fileName: string
  filePath: string
  rows: FreightResult[]
}

export class PacFreightProcessingService {
  constructor(
    private readonly calculatePacFreightsUseCase: {
      execute(input: ProcessPacFreightsInput): Promise<FreightResult[]>
    },
    private readonly exporter: SpreadsheetExporter<FreightResult>,
  ) {}

  async process(input: ProcessPacFreightsInput): Promise<ProcessPacFreightsOutput> {
    const rows = await this.calculatePacFreightsUseCase.execute(input)
    const buffer = await this.exporter.export(rows)

    await fs.mkdir(env.outputDir, { recursive: true })

    const fileName = `frete_pac_${Date.now()}.xlsx`
    const filePath = path.resolve(env.outputDir, fileName)
    await fs.writeFile(filePath, buffer)

    return {
      buffer,
      fileName,
      filePath,
      rows,
    }
  }
}
