import { z } from 'zod';

export const usernameSchema = z
	.string()
	.min(4)
	.max(31)
	.regex(/^[a-zA-Z0-9_-]+$/);

export const passwordSchema = z.string().min(6).max(255);

export const emailSchema = z.string().email();

export const emailCodeSchema = z.string().max(6);

export const signupFormSchema = z.object({
	username: usernameSchema,
	email: emailSchema,
	password: passwordSchema
});
export type SignupFormSchema = typeof signupFormSchema;
