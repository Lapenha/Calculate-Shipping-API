import { app } from './app'
import { env } from './config/env'
import { initDatabase } from './shared/db/postgres'

initDatabase()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`Calculate freight backend listening on port ${env.port}`)
    })
  })
  .catch((error) => {
    console.error('Falha ao iniciar banco de dados:', error.message)
    process.exit(1)
  })
