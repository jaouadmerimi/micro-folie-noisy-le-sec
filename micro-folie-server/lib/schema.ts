import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
export const workshops = pgTable(
  'workshops',
  {
    id: text().primaryKey(),
    title: text().notNull(),
    description: text().notNull(),
    category: text().notNull(),
    starts_at: text().notNull(),
    ends_at: text().notNull(),
    capacity: integer().notNull(),
    min_age: integer().notNull(),
    status: text().notNull(),
    version: integer().notNull().default(1),
    updated_at: text().notNull(),
  },
  (t) => [
    index('workshops_date').on(t.status, t.starts_at),
    check('capacity_positive', sql`${t.capacity} BETWEEN 1 AND 500`),
    check(
      'workshop_status',
      sql`${t.status} IN ('draft','published','archived')`,
    ),
  ],
);
export const reservations = pgTable(
  'reservations',
  {
    id: text().primaryKey(),
    reference: text().notNull().unique(),
    workshop_id: text()
      .notNull()
      .references(() => workshops.id),
    first_name: text().notNull(),
    last_name: text().notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    participants: integer().notNull(),
    status: text().notNull(),
    hold_until: text().notNull(),
    token_hash: text().notNull().unique(),
    request_key: text().notNull().unique(),
    created_at: text().notNull(),
    updated_at: text().notNull(),
    version: integer().notNull().default(1),
  },
  (t) => [
    index('reservations_workshop').on(t.workshop_id, t.status, t.hold_until),
    check('participants_range', sql`${t.participants} BETWEEN 1 AND 10`),
    check(
      'reservation_status',
      sql`${t.status} IN ('pending','waitlist','confirmed','refused','cancelled')`,
    ),
  ],
);
export const news = pgTable(
  'news',
  {
    id: text().primaryKey(),
    title: text().notNull(),
    body: text().notNull(),
    image_key: text().notNull().default(''),
    link: text().notNull().default(''),
    status: text().notNull(),
    published_at: text().notNull(),
    updated_at: text().notNull(),
    version: integer().notNull().default(1),
  },
  (t) => [index('news_publication').on(t.status, t.published_at)],
);
export const admins = pgTable('admins', {
  email: text().primaryKey(),
  created_at: text().notNull(),
  created_by: text().notNull(),
});
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});
export const outbox = pgTable(
  'outbox',
  {
    id: text().primaryKey(),
    reservation_id: text().references(() => reservations.id),
    to_email: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    status: text().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    last_error: text().notNull().default(''),
    created_at: text().notNull(),
    locked_until: text().notNull().default(''),
  },
  (t) => [index('outbox_pending').on(t.status, t.locked_until)],
);
export const rateLimits = pgTable('rate_limits', {
  key: text().primaryKey(),
  count: integer().notNull(),
  expires_at: text().notNull(),
});
export const audit = pgTable('audit', {
  id: text().primaryKey(),
  actor: text().notNull(),
  action: text().notNull(),
  target: text().notNull(),
  created_at: text().notNull(),
});
export const invitations = pgTable('invitations', {
  id: text().primaryKey(),
  email: text().notNull(),
  token_hash: text().notNull().unique(),
  expires_at: text().notNull(),
  consumed: integer().notNull().default(0),
});
// Better Auth core schema; no public signup or external identity providers.
export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean('email_verified')
    .notNull()
    .default(false),
  image: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});
export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user').on(t.userId)],
);
export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('account_user').on(t.userId)],
);
export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('verification_identifier').on(t.identifier)],
);
