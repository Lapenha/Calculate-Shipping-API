import { AppError } from '../../../shared/errors/app-error'
import { Client, FreightResult, PackageMeasure } from '../domain/entities'
import { FreightCalculator } from '../domain/ports'

interface CalculatePacFreightsInput {
  originCep: string
  leilao?: string
  clients: Client[]
  measures: PackageMeasure[]
}

export class CalculatePacFreightsUseCase {
  constructor(private readonly freightCalculator: FreightCalculator) {}

  private async safeCalculate(calculate: () => Promise<string>): Promise<string> {
    try {
      return await calculate()
    } catch (error) {
      return error instanceof Error ? error.message : 'Frete indisponivel'
    }
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
        medidas: `${measure.alturaCm}x${measure.larguraCm}x${measure.comprimentoCm}`,
        pesoKg: measure.pesoKg,
        leilao: input.leilao || '',
        fretePac,
        prazoPac,
        freteLoggi,
        prazoLoggi,
        freteJadlog,
        prazoJadlog,
      })
    }

    return results.sort((a, b) => a.cartela - b.cartela)
  }
}
