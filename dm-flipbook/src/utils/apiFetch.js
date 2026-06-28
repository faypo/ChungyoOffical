export function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  return fetch(url, { ...options, headers, credentials: 'include' }).then(res => {
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    return res;
  });
}
