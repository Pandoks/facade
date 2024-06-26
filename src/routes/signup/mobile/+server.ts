import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
  console.log("verifying email for mobile")
  const { email, password } = await event.request.json();
  console.log("Got ", email, password)
  const {
    data: { data },
    error
  } = await event.locals.supabase.auth.signUp({
    email,
    password
  });
  if (error) {
    console.log("uh", data, "error", error)  
    return json({ message: 'Supabase error. Try again later.', success: false });
  }

  const { session } = data;
  console.log("Session", session)

  const user = session.user;
  console.log("user", user)
  try {
    await db.insert(users).values({ id: user.id });
  } catch (dbError) {
    return json({ message: 'Server error. Try again later.', success: false });
  }

  console.log("Success", data)

  return json({
    success: true,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user: {
      id: user.id,
      email: email,
    }
  });
};