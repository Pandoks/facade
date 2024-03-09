import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { signupFormSchema } from '$lib/validation';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = async (event) => {
	return {
		form: await superValidate(zod(signupFormSchema))
	};
};

export const actions = {
	default: async ({ request, url, locals: { supabase } }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		const {
			data: { user },
			error
		} = await supabase.auth.signUp({
			email,
			password
		});

		if (error) {
			return fail(500, { message: 'Server error. Try again later.', success: false, email });
		}

		try {
			await db.insert(users).values({ id: user.id });
		} catch (error) {
			return fail(500, { message: 'Server error. Try again later.', success: false });
		}

		return redirect(301, '/');
	}
};