# Slumpad rotation

En webbapp byggd med Next.js, Prisma, SQLite och Tailwind CSS för att hantera avdelningar, zoner, grupper, personer och slumpad rotation.

## Kom igång

1. Installera Node.js 20 eller senare.
2. Installera beroenden med `npm install`.
3. Skapa miljöfil med `copy .env.example .env`.
4. Kör `npm run prisma:migrate -- --name init`.
5. Starta utvecklingsservern med `npm run dev`.

## Funktioner

- CRUD för avdelningar
- Hantering av zoner och zonordning
- Hantering av grupper/skift på avdelningens redigeringssida
- Hantering av personer med aktiv/inaktiv-status
- Avdelningsinloggning med `passwordWord + aktuell minut`
- Rotationsgenerering med poängbaserad jämförelse mot föregående rotation
- Sparad rotationshistorik i SQLite via Prisma
