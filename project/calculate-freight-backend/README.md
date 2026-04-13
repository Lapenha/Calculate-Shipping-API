# Backend

API para calcular fretes em massa pelo Melhor Envio e enviar emails pelo Gmail.

## Endpoints

Base:

```text
http://localhost:3333/api/v1/freights
```

Criar calculo:

```text
POST /pac/jobs
```

Campos `multipart/form-data`:

- `originCep`
- `sheet`

Consultar status:

```text
GET /pac/jobs/:jobId
```

Baixar planilha:

```text
GET /pac/jobs/:jobId/download
```

Enviar emails:

```text
POST /pac/jobs/:jobId/emails
```

## Desenvolvimento

```bash
npm install
cp .env.example .env
npm run dev
```

## Variaveis

Veja `.env.example`.
