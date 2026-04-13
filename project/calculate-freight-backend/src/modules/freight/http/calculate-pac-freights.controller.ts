import { Response } from 'express'
import { ClientsSpreadsheetParser } from '../infra/parsers/clients-spreadsheet.parser'
import { MeasuresSpreadsheetParser } from '../infra/parsers/measures-spreadsheet.parser'
import { loadSpreadsheetAuctionNumber } from '../infra/parsers/spreadsheet-loader'
import { makePacFreightProcessingService } from '../infra/factories/make-pac-freight-processing.service'
import { CreatePacFreightJobRequest } from './freight.http.types'
import { FreightRequestParser } from './freight-request.parser'

export class CalculatePacFreightsController {
  constructor(
    private readonly requestParser = new FreightRequestParser(),
    private readonly clientsParser = new ClientsSpreadsheetParser(),
    private readonly measuresParser = new MeasuresSpreadsheetParser(),
    private readonly processingService = makePacFreightProcessingService(),
  ) {}

  async handle(request: CreatePacFreightJobRequest, response: Response): Promise<Response> {
    const payload = this.requestParser.parseCreateJobRequest(request)
    const [clients, measures, leilao] = await Promise.all([
      this.clientsParser.parse(payload.sheetPath),
      this.measuresParser.parse(payload.sheetPath),
      loadSpreadsheetAuctionNumber(payload.sheetPath),
    ])

    const result = await this.processingService.process({
      originCep: payload.originCep,
      leilao,
      clients,
      measures,
    })

    return response
      .status(200)
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName}"`,
      )
      .setHeader(
        'Access-Control-Expose-Headers',
        'Content-Disposition',
      )
      .setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .send(result.buffer)
  }
}
