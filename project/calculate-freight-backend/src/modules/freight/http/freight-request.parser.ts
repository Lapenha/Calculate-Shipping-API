import { z } from 'zod'
import { AppError } from '../../../shared/errors/app-error'
import { onlyDigits } from '../infra/parsers/normalize'
import {
  CreatePacFreightJobBody,
  CreatePacFreightJobRequest,
  FreightUploadFiles,
} from './freight.http.types'

const createJobSchema = z.object({
  originCep: z.string().transform((value) => onlyDigits(value)),
})

export interface ParsedFreightUploadRequest {
  originCep: string
  sheetPath: string
}

export class FreightRequestParser {
  parseCreateJobBody(body: CreatePacFreightJobBody) {
    const parsedBody = createJobSchema.parse(body)

    if (parsedBody.originCep.length !== 8) {
      throw new AppError('CEP de origem invalido.')
    }

    return parsedBody
  }

  parseUploadedFiles(files?: FreightUploadFiles) {
    const sheetFile = files?.sheet?.[0]

    if (!sheetFile) {
      throw new AppError('Envie o arquivo sheet.')
    }

    return {
      sheetPath: sheetFile.path,
    }
  }

  parseCreateJobRequest(request: CreatePacFreightJobRequest): ParsedFreightUploadRequest {
    const { originCep } = this.parseCreateJobBody(request.body)
    const files = this.parseUploadedFiles(request.files)

    return {
      originCep,
      ...files,
    }
  }
}
