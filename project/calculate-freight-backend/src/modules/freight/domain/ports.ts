import { JadlogFreightInput, LoggiFreightInput, PacFreightInput } from './entities'

export interface PacFreightCalculator {
  getPacFreight(input: PacFreightInput): Promise<string>
  getPacDeliveryTime(input: PacFreightInput): Promise<string>
}

export interface JadlogFreightCalculator {
  getJadlogFreight(input: JadlogFreightInput): Promise<string>
  getJadlogDeliveryTime(input: JadlogFreightInput): Promise<string>
}

export interface LoggiFreightCalculator {
  getLoggiFreight(input: LoggiFreightInput): Promise<string>
  getLoggiDeliveryTime(input: LoggiFreightInput): Promise<string>
}

export interface FreightCalculator
  extends PacFreightCalculator,
    LoggiFreightCalculator,
    JadlogFreightCalculator {}

export interface SpreadsheetExporter<T> {
  export(rows: T[]): Promise<Buffer>
}
