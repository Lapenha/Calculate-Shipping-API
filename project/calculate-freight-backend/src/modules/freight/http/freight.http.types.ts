import { ParamsDictionary, Request } from 'express-serve-static-core'

export interface FreightUploadFiles {
  sheet?: Express.Multer.File[]
}

export interface CreatePacFreightJobBody {
  originCep: string
}

export interface FreightJobParams extends ParamsDictionary {
  jobId: string
}

export type CreatePacFreightJobRequest = Request<
  ParamsDictionary,
  unknown,
  CreatePacFreightJobBody
> & {
  files?: FreightUploadFiles
}

export type FreightJobRequest = Request<FreightJobParams>
