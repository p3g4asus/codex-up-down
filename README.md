Web app per la gestione di carico e scarico merci costruita con Next.js, Prisma e SQLite.

## Funzionalita

- Inserimento di nuove merci con nome e descrizione
- Schermata dedicata al carico per aumentare la giacenza
- Schermata dedicata allo scarico con blocco su disponibilita insufficiente
- Cruscotto iniziale con giacenza attuale e ultimi movimenti
- Database SQLite locale gestito da Prisma

## Avvio locale

1. Installa le dipendenze:

```bash
npm install
```

2. Crea il database SQLite e genera il client Prisma:

```bash
npm run db:push
```

3. Avvia il server di sviluppo:

```bash
npm run dev
```

Apri http://localhost:3000.

## Schermate principali

- /: cruscotto con giacenze e ultimi movimenti
- /merci/nuova: inserimento di una nuova merce
- /carico: registrazione di un carico
- /scarico: registrazione di uno scarico

## Stack

- Next.js App Router
- Prisma ORM
- SQLite
- Tailwind CSS

## Immagini Branding

La home usa immagini royalty-free scaricate da Unsplash e salvate in `public/branding/`:

- `ortofrutta.jpg`
- `panetteria.jpg`
- `pescheria.jpg`

## Note ambiente

Nel workspace corrente e stata usata una combinazione compatibile con Node 18: Next.js 15 e Tailwind CSS 3.
