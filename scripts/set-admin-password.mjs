#!/usr/bin/env node
/**
 * One-off bootstrap: set (or reset) an admin's password directly in the DB.
 * Admins cannot self-register or reset via the web UI by design — run this
 * from a machine that has DB access. Uses `pg` directly (not the generated
 * Prisma client, which is TypeScript and not runnable with plain `node`).
 *
 * Usage: node scripts/set-admin-password.mjs <email> <new-password>
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Client } from "pg";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/set-admin-password.mjs <email> <new-password>");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(
  `select id, email from users where lower(email) = lower($1) and role = 'admin'`,
  [email]
);
const admin = rows[0];

if (!admin) {
  console.error(`No admin user found with email ${email}. This script only updates existing role='admin' rows.`);
  await client.end();
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
await client.query(`update users set password_hash = $1, updated_at = now() where id = $2`, [hash, admin.id]);
await client.query(
  `insert into admin_security (user_id, failed_attempts, locked_until, created_at, updated_at)
   values ($1, 0, null, now(), now())
   on conflict (user_id) do update set failed_attempts = 0, locked_until = null, updated_at = now()`,
  [admin.id]
);

console.log(`Password set for ${admin.email} (user #${admin.id}).`);
await client.end();
