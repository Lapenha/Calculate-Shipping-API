import express from 'express'
import { freightRoutes } from './modules/freight/http/freight.routes'
import { errorHandler } from './shared/http/error-handler'

export const app = express()

app.use(express.json())

app.get('/health', (_request, response) => {
  return response.status(200).json({ status: 'ok' })
})

app.use('/api/v1/freights', freightRoutes)
app.use(errorHandler)

