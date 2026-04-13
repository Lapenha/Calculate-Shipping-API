# Fretes em Massa MK Toys

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

Para Gmail, `SMTP_PASS` deve ser uma senha de app, nao a senha normal da conta.

O valor padrao de `EMAIL_SEND_DELAY_MS` e `5000`, ou seja, 5 segundos entre cada email.

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
