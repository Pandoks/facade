/**
 * Basically middleware
 */

import { type Handle, redirect, error, text, json } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { sequence } from '@sveltejs/kit/hooks';
import { createServerClient } from '@supabase/ssr';

const supabase: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get: (key) => event.cookies.get(key),
      /**
       * Note: You have to add the `path` variable to the
       * set and remove method due to sveltekit's cookie API
       * requiring this to be set, setting the path to an empty string
       * will replicate previous/standard behaviour (https://kit.svelte.dev/docs/types#public-types-cookies)
       */
      set: (key, value, options) => {
        event.cookies.set(key, value, { ...options, path: '/' });
      },
      remove: (key, options) => {
        event.cookies.delete(key, { ...options, path: '/' });
      }
    }
  });

  /**
   * a little helper that is written for convenience so that instead
   * of calling `const { data: { session } } = await supabase.auth.getSession()`
   * you just call this `await getSession()`
   */
  event.locals.getSession = async () => {
    const { data: getUserData, error: error } = await event.locals.supabase.auth.getUser();
    let {
      data: { session }
    } = await event.locals.supabase.auth.getSession();

    if (getUserData.user === null) session = null;

    return session;
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range';
    }
  });
};

const authorization: Handle = async ({ event, resolve }) => {
  // testing purposes only go to login if not signed in const session = await event.locals.getSession(); if (!session && !event.url.pathname.startsWith('/signup')) { throw redirect(301, '/signup'); }
  // protect requests to all routes that start with /protected-routes
  if (event.url.pathname.startsWith('/protected-routes') && event.request.method === 'GET') {
    const session = await event.locals.getSession();
    if (!session) {
      // the user is not signed in
      throw redirect(303, '/');
    }
  }
  // protect POST requests to all routes that start with /protected-posts
  if (event.url.pathname.startsWith('/protected-posts') && event.request.method === 'POST') {
    const session = await event.locals.getSession();
    if (!session) {
      // the user is not signed in
      throw error(303, '/');
    }
  }

  return resolve(event);
};

/**
 * CSRF protection copied from sveltekit but with the ability to turn it off for specific routes.
 */
const csrf =
  (allowedPaths: string[]): Handle =>
  async ({ event, resolve }) => {
    const forbidden =
      event.request.method === 'POST' &&
      event.request.headers.get('origin') !== event.url.origin &&
      isFormContentType(event.request) &&
      !allowedPaths.includes(event.url.pathname);

    if (forbidden) {
      const csrfError = error(
        403,
        `Cross-site ${event.request.method} form submissions are forbidden`
      );
      if (event.request.headers.get('accept') === 'application/json') {
        // @ts-ignore
        return json(csrfError.body, { status: csrfError.status });
      }
      // @ts-ignore
      return text(csrfError.body.message, { status: csrfError.status });
    }

    return resolve(event);
  };
function isContentType(request: Request, ...types: string[]) {
  const type = request.headers.get('content-type')?.split(';', 1)[0].trim() ?? '';
  return types.includes(type);
}
function isFormContentType(request: Request) {
  return isContentType(request, 'application/x-www-form-urlencoded', 'multipart/form-data');
}

export const handle: Handle = sequence(
  supabase,
  csrf([
    '/api/receipt',
    '/api/plaid/access-token',
    '/api/plaid/link-token',
    '/api/plaid/transaction',
    '/signup/verify-mobile',
    '/signup/mobile'
  ])
);
