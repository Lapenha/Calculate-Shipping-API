import fs from 'node:fs'
import { NextFunction, Request, Response, Router } from 'express'
import multer from 'multer'
import { env } from '../../../config/env'
import { PacFreightJobsController } from './pac-freight-jobs.controller'
import { CreatePacFreightJobRequest, FreightJobRequest } from './freight.http.types'

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true })
}

const upload = multer({ dest: env.uploadDir })
const router = Router()
const controller = new PacFreightJobsController()
const asyncHandler =
  <TRequest extends Request>(
    handler: (request: TRequest, response: Response) => Promise<Response>,
  ) =>
  (request: Request, response: Response, next: NextFunction) => {
    handler(request as TRequest, response).catch(next)
  }

router.post(
  '/pac/jobs',
  upload.fields([{ name: 'sheet', maxCount: 1 }]),
  asyncHandler<CreatePacFreightJobRequest>(controller.create.bind(controller)),
)

router.get('/pac/jobs/:jobId', asyncHandler<FreightJobRequest>(controller.status.bind(controller)))

router.get(
  '/pac/jobs/:jobId/download',
  asyncHandler<FreightJobRequest>(controller.download.bind(controller)),
)

router.post(
  '/pac/jobs/:jobId/emails',
  asyncHandler<FreightJobRequest>(controller.sendEmails.bind(controller)),
)

router.get(
  '/pac/email-jobs/:jobId',
  asyncHandler<FreightJobRequest>(controller.emailStatus.bind(controller)),
)

export const freightRoutes = router
