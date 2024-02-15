import { DrizzlePostgreSQLAdapter } from '@lucia-auth/adapter-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sessions, users } from './schema';

const DB_CONNECTION_STRING = process.env.DB_CONNECTION_STRING;

if (!DB_CONNECTION_STRING) {
	throw new Error('DB_CONNECTION_STRING is required');
}

const client = postgres(DB_CONNECTION_STRING, { prepare: false });
export const db = drizzle(client);

export const luciaAdapter = new DrizzlePostgreSQLAdapter(db, sessions, users);