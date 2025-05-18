// Need to import all data types we want to use
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define table schemas
export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  message: text('message').notNull(),
  reply: text('reply').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const users = pgTable('users', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type inference for Drizzle queries so we can use it outside this file without TS type errors
export type ChatInsert = typeof chats.$inferInsert
export type ChatSelect = typeof chats.$inferSelect
export type UserInsert = typeof users.$inferInsert;
export type UserSelect = typeof users.$inferSelect;

/*
In terminal, run :
- npx drizzle-kit generate
- npx drizzle-kit migrate
*/