import { ClientsSpreadsheetParser } from '../infra/parsers/clients-spreadsheet.parser'
import { MeasuresSpreadsheetParser } from '../infra/parsers/measures-spreadsheet.parser'
import { loadSpreadsheetAuctionNumber } from '../infra/parsers/spreadsheet-loader'
import { makePacFreightProcessingService } from '../infra/factories/make-pac-freight-processing.service'
import { FreightJobData, FreightJobResult } from '../domain/job'

export class ProcessPacFreightJobUseCase {
  constructor(
    private readonly clientsParser = new ClientsSpreadsheetParser(),
    private readonly measuresParser = new MeasuresSpreadsheetParser(),
    private readonly processingService = makePacFreightProcessingService(),
  ) {}

  async execute(input: FreightJobData): Promise<FreightJobResult> {
    const [clients, measures, leilao] = await Promise.all([
      this.clientsParser.parse(input.sheetPath),
      this.measuresParser.parse(input.sheetPath),
      loadSpreadsheetAuctionNumber(input.sheetPath),
    ])

    const result = await this.processingService.process({
      originCep: input.originCep,
      leilao,
      clients,
      measures,
    })

    return {
      fileName: result.fileName,
      filePath: result.filePath,
      rowsCount: result.rows.length,
    }
  }
}
