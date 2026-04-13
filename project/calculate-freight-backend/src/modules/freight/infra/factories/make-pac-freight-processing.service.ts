import { CalculatePacFreightsUseCase } from '../../application/calculate-pac-freights.use-case'
import { PacFreightProcessingService } from '../../application/pac-freight-processing.service'
import { XlsxSpreadsheetExporter } from '../export/xlsx-spreadsheet.exporter'
import { MelhorEnvioCalculator } from '../melhor-envio/melhor-envio-calculator'

export function makePacFreightProcessingService() {
  const calculator = new MelhorEnvioCalculator()
  const calculatePacFreightsUseCase = new CalculatePacFreightsUseCase(calculator)
  const exporter = new XlsxSpreadsheetExporter()

  return new PacFreightProcessingService(calculatePacFreightsUseCase, exporter)
}
