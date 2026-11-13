// Database schema (Drizzle ORM).
//
// keyvault is a small secrets-sharing service. The lab lives on the `secrets`
// table, whose primary key is a **random UUID** — not a sequential integer.
// The point of the level is that an unguessable id is NOT authorization: the
// read endpoint still returns any secret by its UUID with no ownership check.
// You can't enumerate UUIDs, so you win by *capturing* one that leaks through a
// secondary channel (the activity feed).
import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
});

export const secrets = pgTable('secrets', {
  // Random UUID primary key — looks "secure" precisely because it is not
  // guessable. It still needs an authorization check on read; it doesn't get
  // one. That is the vulnerability.
  id: uuid('id').primaryKey(),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  // The secret body. The victim's carries the flag.
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Secret = typeof secrets.$inferSelect;
