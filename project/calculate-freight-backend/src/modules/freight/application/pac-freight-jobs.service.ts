import fs from 'node:fs/promises'
import { AppError } from '../../../shared/errors/app-error'
import { ProcessPacFreightJobUseCase } from './process-pac-freight-job.use-case'
import { FreightJobData, FreightJobResult } from '../domain/job'

type LocalJobState = 'waiting' | 'active' | 'completed' | 'failed'

interface LocalJob {
  id: string
  name: string
  status: LocalJobState
  progress: number
  attemptsMade: number
  failedReason: string | null
  result: FreightJobResult | null
}

const localJobs = new Map<string, LocalJob>()
let localJobSequence = 0

export class PacFreightJobsService {
  private readonly localUseCase = new ProcessPacFreightJobUseCase()

  async create(data: FreightJobData) {
    return this.createLocalJob(data)
  }

  private createLocalJob(data: FreightJobData) {
    const jobId = `local-${Date.now()}-${++localJobSequence}`
    const localJob: LocalJob = {
      id: jobId,
      name: 'calculate-pac-freight',
      status: 'waiting',
      progress: 0,
      attemptsMade: 0,
      failedReason: null,
      result: null,
    }

    localJobs.set(jobId, localJob)

    setImmediate(async () => {
      localJob.status = 'active'
      localJob.progress = 10

      try {
        localJob.result = await this.localUseCase.execute(data)
        localJob.progress = 100
        localJob.status = 'completed'
      } catch (error) {
        localJob.status = 'failed'
        localJob.failedReason = error instanceof Error ? error.message : 'Falha ao processar planilha.'
      } finally {
        await fs.rm(data.sheetPath, { force: true })
      }
    })

    return {
      jobId,
      status: 'waiting',
      message: 'Calculo iniciado com sucesso.',
    }
  }

  async getStatus(jobId: string) {
    const localJob = localJobs.get(jobId)
    if (localJob) {
      return {
        id: localJob.id,
        name: localJob.name,
        status: localJob.status,
        progress: localJob.progress,
        attemptsMade: localJob.attemptsMade,
        failedReason: localJob.failedReason,
        result: localJob.status === 'completed' ? localJob.result : null,
      }
    }

    throw new AppError('Job nao encontrado.', 404)
  }

  async downloadResult(jobId: string): Promise<FreightJobResult & { buffer: Buffer }> {
    const localJob = localJobs.get(jobId)
    if (localJob) {
      if (localJob.status !== 'completed') {
        throw new AppError('Job ainda nao foi concluido.', 409)
      }

      if (!localJob.result?.filePath || !localJob.result?.fileName) {
        throw new AppError('Resultado do job invalido.', 500)
      }

      const buffer = await fs.readFile(localJob.result.filePath)

      return {
        ...localJob.result,
        buffer,
      }
    }

    throw new AppError('Job nao encontrado.', 404)
  }
}
