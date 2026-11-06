/* Thin wrapper around fetch for the Night Bite JSON API. */

export async function api(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin'
    });
  } catch {
    const error = new Error('Cannot reach the server. Check your connection and try again.');
    error.status = 0;
    throw error;
  }

  let payload = {};
  try { payload = await response.json(); } catch { /* empty body */ }

  if (!response.ok) {
    const error = new Error(payload.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    error.errors = payload.errors;
    error.code = payload.code;
    throw error;
  }
  return payload;
}
