# Digital Power Query

A Next.js (App Router) site for looking up digital power terms (English / 繁體中文) and calculating the numbers that come up when bringing up a digitally controlled power supply.

## Features

| Page | What it does |
| --- | --- |
| `/terms` | Searchable bilingual glossary (PMBus, number formats, PWM, ADC, control loop, architectures), with formulas, related terms and sources |
| `/architectures` | Power-delivery (CPA, DPA, IBA, FPA, 48 V direct-to-POL) and digital-control (managed vs. controlled, DSC, state machine, FPGA, multiphase) architectures with block diagrams and trade-offs |
| `/calc/pmbus` | LINEAR11, LINEAR16 / VOUT_MODE, DIRECT encode & decode, PEC (CRC-8) |
| `/calc/qformat` | Qm.n range and resolution, real ↔ hex with rounding and saturation |
| `/calc/resolution` | DPWM / HRPWM bits, ADC LSB, Vout step, Peterchev–Sanders limit-cycle check |
| `/calc/compensator` | Type II / Type III / PID → 2P2Z / 3P3Z coefficients (Tustin, optional pre-warp), Q-format coefficients, Bode plot |

Numeric inputs accept SI suffixes: `100M`, `500k`, `150p`, `20u`.

## API

```
GET  /api/terms?q=linear&category=pmbus
GET  /api/terms/{id}
POST /api/calc/pmbus        {"op":"linear11-encode","value":12}
POST /api/calc/qformat      {"m":0,"n":15,"signed":true,"value":0.5}
POST /api/calc/resolution   {"fclk":100e6,"fsw":500e3,"vin":12,"adcBits":12,"vref":3.3,"gain":0.5}
POST /api/calc/compensator  {"fs":500e3,"gain":2000,"zerosHz":[3000,3000],"polesHz":[60000,150000]}
```

PMBus ops: `linear11-decode|encode`, `linear16-decode|encode` (with `voutMode`), `direct-decode|encode` (with `m`, `b`, `R`), `vout-mode`, `pec`.

## Project layout

- `src/data/terms.json`: glossary entries (edit this file to add terms)
- `src/lib/calc/`: calculation code shared by the pages and the API, with unit tests in `calc.test.ts`
- `src/app/api/`: route handlers
- `src/app/calc/`, `src/app/terms/`: pages

## Development

```
npm install
npm run dev     # http://localhost:3000
npm test        # vitest
npm run build
```
