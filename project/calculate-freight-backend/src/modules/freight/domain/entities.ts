export interface Client {
  cartela: number
  nome: string
  email: string
  endereco: string
  cepDestino: string
  valorDeclarado: number
}

export interface PackageMeasure {
  cartela: number
  alturaCm: number
  larguraCm: number
  comprimentoCm: number
  pesoKg: number
}

export interface FreightResult {
  cartela: number
  nome: string
  email: string
  endereco: string
  cepDestino: string
  medidas: string
  pesoKg: number
  leilao: string
  fretePac: string
  prazoPac: string
  freteLoggi: string
  prazoLoggi: string
  freteJadlog: string
  prazoJadlog: string
}

export interface PacFreightInput {
  originCep: string
  destinationCep: string
  alturaCm: number
  larguraCm: number
  comprimentoCm: number
  pesoKg: number
  valorDeclarado: number
}

export type JadlogFreightInput = PacFreightInput
export type LoggiFreightInput = PacFreightInput
