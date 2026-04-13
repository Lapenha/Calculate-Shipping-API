import { Response } from 'express'
import { AppError } from '../../../shared/errors/app-error'
import { EmailSendJobsService } from '../application/email-send-jobs.service'
import { PacFreightJobsService } from '../application/pac-freight-jobs.service'
import { CreatePacFreightJobRequest, FreightJobRequest } from './freight.http.types'
import { FreightRequestParser } from './freight-request.parser'

export class PacFreightJobsController {
  constructor(
    private readonly requestParser = new FreightRequestParser(),
    private readonly jobsService = new PacFreightJobsService(),
    private readonly emailJobsService = new EmailSendJobsService(),
  ) {}

  async create(request: CreatePacFreightJobRequest, response: Response): Promise<Response> {
    const data = this.requestParser.parseCreateJobRequest(request)
    const result = await this.jobsService.create(data)

    return response.status(202).json(result)
  }

  async status(request: FreightJobRequest, response: Response): Promise<Response> {
    const { jobId } = request.params
    const result = await this.jobsService.getStatus(String(jobId))

    return response.status(200).json(result)
  }

  async download(request: FreightJobRequest, response: Response): Promise<Response> {
    const { jobId } = request.params
    const result = await this.jobsService.downloadResult(String(jobId))

    return response
      .status(200)
      .setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
      .setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
      .setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .send(result.buffer)
  }

  async sendEmails(request: FreightJobRequest, response: Response): Promise<Response> {
    const { jobId } = request.params
    const result = this.emailJobsService.create(String(jobId))

    return response.status(202).json(result)
  }

  async emailStatus(request: FreightJobRequest, response: Response): Promise<Response> {
    const { jobId } = request.params
    const result = this.emailJobsService.getStatus(String(jobId))

    if (!result) {
      throw new AppError('Job de emails nao encontrado.', 404)
    }

    return response.status(200).json(result)
  }
}
