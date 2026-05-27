# Slumpad rotation

Webbapp för att hantera och slumpa arbetsrotationer på avdelningar. Byggd med Next.js 15, Prisma, SQLite och Tailwind CSS.

## Kom igång (utveckling)

1. Installera Node.js 20 eller senare
2. Installera beroenden: `npm install`
3. Skapa miljöfil: `copy .env.example .env` (Windows) eller `cp .env.example .env` (Linux/Mac)
4. Kör migrering: `npm run prisma:migrate -- --name init`
5. Starta dev-servern: `npm run dev`

Appen körs på [http://localhost:3000](http://localhost:3000).

## Miljövariabler

| Variabel | Beskrivning |
|---|---|
| `DATABASE_URL` | Sökväg till SQLite-databasen, t.ex. `file:./prisma/dev.db` |
| `SITE_ADMIN_PASSWORD` | Lösenord för siteadmin-inloggning |

## Kommandon

```bash
npm run dev              # Startar utvecklingsserver
npm run build            # Genererar Prisma-klient och bygger Next.js
npm run start            # Startar produktionsserver
npm run lint             # Kör linting

npm run prisma:generate  # Regenererar Prisma-klient efter schemaändringar
npm run prisma:migrate   # Kör nya migreringar (dev)
npm run prisma:studio    # Öppnar Prisma GUI
```

## Deploy (Linux/PM2)

```bash
./deploy.sh
```

Scriptet hämtar senaste koden från GitHub, installerar beroenden, bygger appen och startar om PM2-processen.

Första gången på servern:

```bash
chmod +x deploy.sh
cp .env.example .env     # Fyll i DATABASE_URL och SITE_ADMIN_PASSWORD
npm run prisma:migrate -- --name init
pm2 start ecosystem.config.js
pm2 save
```

## Arkitektur

- **Next.js 15 App Router** — inga API-routes, alla mutationer går via server actions i `app/actions.ts`
- **Prisma + SQLite** — databasmodeller i `prisma/schema.prisma`
- **Auth** — två separata cookie-sessioner: avdelning (8h TTL) och siteadmin. Avdelningslösenordet är `passwordWord + aktuell serverminut`
- **Rotationsalgoritm** — `lib/rotation.ts` tilldelar personer till zoner med ett poängsystem som undviker upprepade zoner och grannar mot de 3 senaste rotationerna

## Funktioner

- Hantering av avdelningar, zoner, grupper och personer
- Avdelningsinloggning med tidsbegränsat lösenord
- Slumpad rotation med poängbaserad algoritm
- Visning av personer som inte är tilldelade en zon
- Sparad rotationshistorik
- Mörkt läge
- Siteadmin-panel med rotationssimulering och revisionslogg
