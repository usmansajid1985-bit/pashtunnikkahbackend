# Pashtun Nikah Admin

Next.js + Prisma admin panel on top of the cleaned Postgres database.

## Already set up on this machine

- PostgreSQL 16 via Homebrew (`brew services start postgresql@16`)
- Database: `pashtun_nikah` with migrated WordPress data
- App runs at [http://localhost:3000](http://localhost:3000)

## Start

```bash
# ensure Postgres is running
brew services start postgresql@16

cd admin
npm run dev
```

Open http://localhost:3000

## Pages

- `/` dashboard counts
- `/users` + `/users/[id]`
- `/profiles` + `/profiles/[id]` (approve / reject)
- `/payments`
- `/requests`
- `/reports`

## Env

`.env` contains:

```
DATABASE_URL="postgresql://Usman@localhost:5432/pashtun_nikah?schema=public"
```

## Re-import data

```bash
cd ../db-migrate
node convert.js "../pn_full_export 2.sql"
# then drop/recreate + import if you want a full refresh
```
