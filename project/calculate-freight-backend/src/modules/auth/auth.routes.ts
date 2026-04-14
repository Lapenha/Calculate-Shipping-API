import bcrypt from 'bcryptjs'
import { NextFunction, Request, Response, Router } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import { env } from '../../config/env'
import { AppError } from '../../shared/errors/app-error'
import { pool } from '../../shared/db/postgres'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
  }
}

const router = Router()

router.post('/login', async (request: Request, response: Response) => {
  const email = String(request.body?.email || '').trim().toLowerCase()
  const password = String(request.body?.password || '')

  if (!email || !password) {
    throw new AppError('Informe email e senha.', 422)
  }

  const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email])
  const user = result.rows[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError('Email ou senha invalidos.', 401)
  }

  const options: SignOptions = { expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'] }
  const token = jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, options)

  return response.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  })
})

export function requireAuth(request: AuthenticatedRequest, _response: Response, next: NextFunction) {
  const header = request.header('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    throw new AppError('Login obrigatorio.', 401)
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; email: string }
    request.user = {
      id: payload.sub,
      email: payload.email,
    }
    next()
  } catch {
    throw new AppError('Sessao invalida ou expirada.', 401)
  }
}

export const authRoutes = router
