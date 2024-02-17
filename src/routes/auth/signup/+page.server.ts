import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { lucia } from '$lib/server/auth';
import { emailSchema, passwordSchema, usernameSchema } from '$lib/server/validation';
import { fail, type Actions, redirect } from '@sveltejs/kit';
import { generateId } from 'lucia';
import { Argon2id } from 'oslo/password';
import { generateEmailVerificationCode, sendVerificationCode } from '$lib/server/email';
import type { PageServerLoad, PageServerLoadEvent } from './$types';

export const load: PageServerLoad = async (event: PageServerLoadEvent) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();

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