import express from 'express'
import path from 'node:path'
import { env } from './config/env'
import { authRoutes, requireAuth } from './modules/auth/auth.routes'
import { freightRoutes } from './modules/freight/http/freight.routes'
import { marketingRoutes } from './modules/marketing/marketing.routes'
import { errorHandler } from './shared/http/error-handler'

export const app = express()

app.use(express.json())
app.use('/storage/uploads', express.static(path.resolve(env.uploadDir)))

app.get('/health', (_request, response) => {
  return response.status(200).json({ status: 'ok' })
})

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/freights', requireAuth, freightRoutes)
app.use('/api/v1/marketing', requireAuth, marketingRoutes)
app.use(errorHandler)
