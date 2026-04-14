# Fretes em Massa para Leiloes

Ferramenta para calcular fretes em massa a partir de uma planilha e enviar emails para os compradores.

## Funcionalidades

- Upload de planilha `.xlsx` ou `.csv`
- Calculo de fretes pelo Melhor Envio
- Retorno de PAC, Loggi e Jadlog quando disponiveis
- Prazo estimado de cada servico
- Download da planilha final com fretes
- Envio de emails pelo Gmail com as opcoes de frete
- Intervalo configuravel entre emails para reduzir risco de bloqueio do Gmail
- Frontend simples em React com drag and drop
- Login com JWT
- Postgres local via Docker para usuarios e descadastros
- Tela de email marketing com imagem de capa, lista de emails e logs
- Envio de email marketing pela Brevo ou pelo Gmail

## Estrutura

- `project/calculate-freight-backend`: API Node.js + TypeScript
- `project/calculate-freight-frontend`: frontend React + Vite

## Planilha de entrada

A planilha deve ter colunas equivalentes a:

- `Cartela`
- `Nome`
- `Email`
- `CEP`
- `Medidas` no formato `8x12x17`
- `Peso` em kg, exemplo `1` ou `0,5`

O numero do leilao pode ficar em uma linha de titulo, exemplo:

```text
Arrematantes do Leilao: 60332
```

## Configuracao

Copie o arquivo de exemplo:

```bash
cd project/calculate-freight-backend
cp .env.example .env
```

Preencha no `.env`:

- `MELHOR_ENVIO_TOKEN`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `EMAIL_SEND_DELAY_MS`
- `MARKETING_EMAIL_SEND_DELAY_MS`
- `MARKETING_PROVIDER`, use `brevo` para marketing pela Brevo ou `gmail` para SMTP
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_REPLY_TO_EMAIL`
- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Para Gmail, `SMTP_PASS` deve ser uma senha de app, nao a senha normal da conta.

O valor padrao de `EMAIL_SEND_DELAY_MS` e `5000`, ou seja, 5 segundos entre cada email.

Para email marketing, o valor padrao de `MARKETING_EMAIL_SEND_DELAY_MS` e `8000`, ou seja, 8 segundos entre cada email.

Quando `MARKETING_PROVIDER=brevo`, os emails de marketing saem pela Brevo. O remetente precisa estar validado na Brevo. Use `BREVO_REPLY_TO_EMAIL=mktoyseantique@gmail.com` para receber as respostas no Gmail da MK Toys.

Os emails de frete continuam usando SMTP/Gmail para facilitar o acompanhamento das respostas dos compradores.

## Banco local

Suba o Postgres:

```bash
docker compose up -d
```

O backend cria as tabelas e o usuario admin automaticamente usando `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

## Rodar localmente

Backend:

```bash
cd project/calculate-freight-backend
npm install
npm run dev
```

Frontend:

```bash
cd project/calculate-freight-frontend
npm install
npm run dev
```

Abra:

```text
http://127.0.0.1:5173
```

## Validar

Backend:

```bash
npm run check
npm run build
```

Frontend:

```bash
npm run build
```
