import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  check,
} from 'drizzle-orm/sqlite-core';
export const workshops = sqliteTable(
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
export const reservations = sqliteTable(
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
export const news = sqliteTable(
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
export const admins = sqliteTable('admins', {
  email: text().primaryKey(),
  created_at: text().notNull(),
  created_by: text().notNull(),
});
export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});
export const outbox = sqliteTable(
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
export const rateLimits = sqliteTable('rate_limits', {
  key: text().primaryKey(),
  count: integer().notNull(),
  expires_at: text().notNull(),
});
export const audit = sqliteTable('audit', {
  id: text().primaryKey(),
  actor: text().notNull(),
  action: text().notNull(),
  target: text().notNull(),
  created_at: text().notNull(),
});
export const invitations = sqliteTable('invitations', {
  id: text().primaryKey(),
  email: text().notNull(),
  token_hash: text().notNull().unique(),
  expires_at: text().notNull(),
  consumed: integer().notNull().default(0),
});
// Better Auth core schema; no public signup or external identity providers.
export const user = sqliteTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
export const session = sqliteTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text().notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user').on(t.userId)],
);
export const account = sqliteTable(
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
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp_ms',
    }),
    scope: text(),
    password: text(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('account_user').on(t.userId)],
);
export const verification = sqliteTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('verification_identifier').on(t.identifier)],
);
