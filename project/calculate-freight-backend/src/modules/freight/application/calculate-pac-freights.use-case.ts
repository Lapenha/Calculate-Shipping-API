import { AppError } from '../../../shared/errors/app-error'
import { Client, FreightResult, PackageMeasure } from '../domain/entities'
import { FreightCalculator } from '../domain/ports'

interface CalculatePacFreightsInput {
  originCep: string
  leilao?: string
  clients: Client[]
  measures: PackageMeasure[]
}

const PACKAGING_FEE_BRL = 5

export class CalculatePacFreightsUseCase {
  constructor(private readonly freightCalculator: FreightCalculator) {}

  private async safeCalculate(calculate: () => Promise<string>): Promise<string> {
    try {
      return await calculate()
    } catch (error) {
      return error instanceof Error ? error.message : 'Frete indisponivel'
    }
  }

  private addPackagingFee(value: string): string {
    if (!value) return value

    const match = value.match(/R\$\s*([\d.,]+)/)
    if (!match) {
      return value
    }

    const amount = Number(match[1].replace(/\./g, '').replace(',', '.'))
    if (Number.isNaN(amount)) {
      return value
    }

    const updated = (amount + PACKAGING_FEE_BRL).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

    return value.replace(match[0], updated)
  }

  async execute(input: CalculatePacFreightsInput): Promise<FreightResult[]> {
    const measureByCartela = new Map(input.measures.map((measure) => [measure.cartela, measure]))

    const results: FreightResult[] = []
    for (const client of input.clients) {
      const measure = measureByCartela.get(client.cartela)
      if (!measure) {
        throw new AppError(`Nao existe medida para a cartela ${client.cartela}.`, 422)
      }

      const freightInput = {
        originCep: input.originCep,
        destinationCep: client.cepDestino,
        alturaCm: measure.alturaCm,
        larguraCm: measure.larguraCm,
        comprimentoCm: measure.comprimentoCm,
        pesoKg: measure.pesoKg,
        valorDeclarado: client.valorDeclarado,
      }

      const [fretePac, prazoPac, freteLoggi, prazoLoggi, freteJadlog, prazoJadlog] = await Promise.all([
        this.safeCalculate(() => this.freightCalculator.getPacFreight(freightInput)),
        this.safeCalculate(() => this.freightCalculator.getPacDeliveryTime(freightInput)),
        this.safeCalculate(() => this.freightCalculator.getLoggiFreight(freightInput)),
        this.safeCalculate(() => this.freightCalculator.getLoggiDeliveryTime(freightInput)),
        this.safeCalculate(() => this.freightCalculator.getJadlogFreight(freightInput)),
        this.safeCalculate(() => this.freightCalculator.getJadlogDeliveryTime(freightInput)),
      ])

      results.push({
        cartela: client.cartela,
        nome: client.nome,
        email: client.email,
        endereco: client.endereco,
        cepDestino: client.cepDestino,
        medidas: `${measure.alturaCm}x${measure.larguraCm}x${measure.comprimentoCm}`,
        pesoKg: measure.pesoKg,
        leilao: input.leilao || '',
        fretePac: this.addPackagingFee(fretePac),
        prazoPac,
        freteLoggi: this.addPackagingFee(freteLoggi),
        prazoLoggi,
        freteJadlog: this.addPackagingFee(freteJadlog),
        prazoJadlog,
      })
    }

    return results.sort((a, b) => a.cartela - b.cartela)
  }
}
