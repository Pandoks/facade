import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async (event) => {
  console.log("verifying mobile")
  const { phone, code } = await event.request.json();
  const { data, error: supabaseError } = await event.locals.supabase.auth.verifyOtp({
    phone: phone,
    token: code,
    type: 'sms',
  });

  console.log("Got verify request for phone", phone)
  console.log("data:", data)
  if (supabaseError) {
    return json({ message: 'Server error. Try again later.', success: false, phone });
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
      phone: phone
    }
  });
};