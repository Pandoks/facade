import { db } from '$lib/db';
import { timeouts, users } from '$lib/db/schema';
import { lucia } from '$lib/server/auth';
import { emailSchema, passwordSchema, signupFormSchema, usernameSchema } from '$lib/validation';
import { fail, type Actions, redirect } from '@sveltejs/kit';
import { TimeSpan, generateId } from 'lucia';
import { Argon2id } from 'oslo/password';
import { generateEmailVerificationCode, sendVerificationCode } from '$lib/server/email';
import type { PageServerLoad, PageServerLoadEvent } from './$types';
import { and, eq } from 'drizzle-orm';
import { createDate, isWithinExpirationDate } from 'oslo';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {
		form: await superValidate(zod(signupFormSchema))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();

		// signup throttling based on ip
		const ip = event.getClientAddress();
		const valid = await db.transaction(async (tx) => {
			const [timeout] = await tx
				.select()
				.from(timeouts)
				.where(and(eq(timeouts.ip, ip), eq(timeouts.type, 'signup')))
				.limit(1);
			const timeoutUntil = timeout?.timeoutUntil ?? 0;
			if (Date.now() < timeoutUntil) {
				return false;
			}

			const timeoutSeconds = timeout ? timeout.timeoutSeconds * 2 : 1;
			await tx
				.insert(timeouts)
				.values({
					ip: ip,
					type: 'signup',
					timeoutUntil: Date.now() + timeoutSeconds * 1000,
					timeoutSeconds: timeoutSeconds,
					expiresAt: createDate(new TimeSpan(1, 'h'))
				})
				.onConflictDoUpdate({
					target: [timeouts.ip, timeouts.type],
					set: {
						timeoutUntil: Date.now() + timeoutSeconds * 1000,
						timeoutSeconds: timeoutSeconds
					}
				});
			return true;
		});
		if (!valid) {
			return fail(429);
		}

		// handle signup
		if (
			!usernameSchema.safeParse(formData.get('username')).success ||
			!emailSchema.safeParse(formData.get('email')).success ||
			!passwordSchema.safeParse(formData.get('password')).success
		) {
			return fail(400, {
				message: 'Invalid username or email or password'
			});
		}

		const username = formData.get('username') as string;
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		const userId = generateId(15);
		const hashedPassword = await new Argon2id().hash(password);

		try {
			await db.insert(users).values({
				id: userId,
				username: username,
				email: email,
				emailVerified: false,
				hashedPassword: hashedPassword
			});
		} catch {
			return fail(400, {
				message: 'Username or email already exists'
			});
		}

		// delete throttle after an hour
		await db.transaction(async (tx) => {
			const [timeout] = await tx
				.select()
				.from(timeouts)
				.where(and(eq(timeouts.ip, ip), eq(timeouts.type, 'signup')))
				.limit(1);
			if (timeout && !isWithinExpirationDate(timeout.expiresAt!)) {
				tx.delete(timeouts).where(and(eq(timeouts.ip, ip), eq(timeouts.type, 'signup')));
			}
		});

		const verificationCode = await generateEmailVerificationCode(userId, email);
		// TODO: Make sure you implement rate limiting based on user ID and IP address
		await sendVerificationCode(email, verificationCode);

		const session = await lucia.createSession(userId, {});
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});

		return redirect(302, '/');
	}
};
