import { env } from '../../../../config/env'
import { JadlogFreightInput, LoggiFreightInput, PacFreightInput } from '../../domain/entities'
import { FreightCalculator } from '../../domain/ports'

type MelhorEnvioQuote = {
  id?: number
  name?: string
  price?: string
  custom_price?: string
  delivery_time?: number
  custom_delivery_time?: number
  company?: {
    id?: number
    name?: string
  }
  error?: string
}

type Carrier = 'pac' | 'loggi' | 'jadlog'

const carrierMatchers: Record<Carrier, (quote: MelhorEnvioQuote) => boolean> = {
  pac: (quote) => {
    const company = normalize(quote.company?.name)
    const service = normalize(quote.name)
    return company.includes('correios') && service.includes('pac')
  },
  loggi: (quote) => normalize(quote.company?.name).includes('loggi'),
  jadlog: (quote) => normalize(quote.company?.name).includes('jadlog'),
}

const carrierLabels: Record<Carrier, string> = {
  pac: 'PAC',
  loggi: 'Loggi',
  jadlog: 'Jadlog',
}

function normalize(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function formatPrice(value?: string) {
  if (!value) return null

  const amount = Number(String(value).replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'))
  if (Number.isNaN(amount)) return value

  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export class MelhorEnvioCalculator implements FreightCalculator {
  private readonly cache = new Map<string, Promise<MelhorEnvioQuote[]>>()

  private getDeclaredValue(input: PacFreightInput): number {
    return input.valorDeclarado > 0 ? input.valorDeclarado : env.melhorEnvioInsuranceValue
  }

  getPacFreight(input: PacFreightInput): Promise<string> {
    return this.getFreight('pac', input)
  }

  getPacDeliveryTime(input: PacFreightInput): Promise<string> {
    return this.getDeliveryTime('pac', input)
  }

  getLoggiFreight(input: LoggiFreightInput): Promise<string> {
    return this.getFreight('loggi', input)
  }

  getLoggiDeliveryTime(input: LoggiFreightInput): Promise<string> {
    return this.getDeliveryTime('loggi', input)
  }

  getJadlogFreight(input: JadlogFreightInput): Promise<string> {
    return this.getFreight('jadlog', input)
  }

  getJadlogDeliveryTime(input: JadlogFreightInput): Promise<string> {
    return this.getDeliveryTime('jadlog', input)
  }

  private async getFreight(carrier: Carrier, input: PacFreightInput): Promise<string> {
    if (!env.melhorEnvioToken) {
      return 'Melhor Envio nao configurado'
    }

    const quotes = await this.getQuotes(input)
    const quote = this.findCheapestQuote(quotes, carrier)

    if (!quote) {
      return `${carrierLabels[carrier]} indisponivel no Melhor Envio`
    }

    if (quote.error) {
      return quote.error
    }

    const price = formatPrice(quote.custom_price || quote.price)
    return price ? `${price} - ${quote.name || carrierLabels[carrier]}` : `${carrierLabels[carrier]} sem preco`
  }

  private async getDeliveryTime(carrier: Carrier, input: PacFreightInput): Promise<string> {
    if (!env.melhorEnvioToken) {
      return 'Melhor Envio nao configurado'
    }

    const quotes = await this.getQuotes(input)
    const quote = this.findCheapestQuote(quotes, carrier)
    const days = quote?.custom_delivery_time ?? quote?.delivery_time

    if (!quote || days == null) {
      return `${carrierLabels[carrier]} indisponivel`
    }

    return `${days} dia${days === 1 ? '' : 's'} uteis`
  }

  private findCheapestQuote(quotes: MelhorEnvioQuote[], carrier: Carrier): MelhorEnvioQuote | undefined {
    return quotes
      .filter(carrierMatchers[carrier])
      .filter((quote) => !quote.error && (quote.custom_price || quote.price))
      .sort((a, b) => Number(a.custom_price || a.price) - Number(b.custom_price || b.price))[0]
  }

  private getQuotes(input: PacFreightInput): Promise<MelhorEnvioQuote[]> {
    const cacheKey = JSON.stringify(input)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    const request = this.fetchQuotes(input)
    this.cache.set(cacheKey, request)
    return request
  }

  private async fetchQuotes(input: PacFreightInput): Promise<MelhorEnvioQuote[]> {
    const baseUrl = env.melhorEnvioBaseUrl.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.melhorEnvioToken}`,
        'Content-Type': 'application/json',
        'User-Agent': env.melhorEnvioUserAgent,
      },
      body: JSON.stringify({
        from: {
          postal_code: input.originCep,
        },
        to: {
          postal_code: input.destinationCep,
        },
        products: [
          {
            id: '1',
            width: input.larguraCm,
            height: input.alturaCm,
            length: input.comprimentoCm,
            weight: input.pesoKg,
            insurance_value: this.getDeclaredValue(input),
            quantity: 1,
          },
        ],
        options: {
          receipt: false,
          own_hand: false,
          insurance_value: this.getDeclaredValue(input),
          use_insurance_value: this.getDeclaredValue(input) > 0,
        },
      }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : `Melhor Envio retornou erro ${response.status}`
      throw new Error(message)
    }

    return Array.isArray(payload) ? (payload as MelhorEnvioQuote[]) : []
  }
}
