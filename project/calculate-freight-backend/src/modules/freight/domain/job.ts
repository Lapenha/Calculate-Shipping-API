export interface FreightJobData {
  originCep: string
  sheetPath: string
}

export interface FreightJobResult {
  filePath: string
  fileName: string
  rowsCount: number
}
