// src/lib/api.ts
import axios from 'axios';

// All frontend requests go to the Express backend.
// WithCredentials ensures cookies (JWT) are sent with every request.
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// Interceptor to handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server returns 401 Unauthorized, we could redirect to login here,
    // but the AuthContext handles setting user to null.
    return Promise.reject(error);
  }
);

export default api;

// ── Shared categories cache ─────────────────────────────────────────────────
// Categories rarely change and are fetched independently by both the nav menu
// and category pages on every load. Dedupe/cache in-memory (per page session)
// so we don't issue the same GET twice for one navigation.
let categoriesCache: any | null = null;
let categoriesPromise: Promise<any> | null = null;

export function getCategoriesCached(): Promise<any> {
  if (categoriesCache) return Promise.resolve(categoriesCache);
  if (!categoriesPromise) {
    categoriesPromise = api.get('/categories')
      .then(res => {
        categoriesCache = res.data;
        return res.data;
      })
      .catch(err => {
        categoriesPromise = null; // allow retry on next call
        throw err;
      });
  }
  return categoriesPromise;
}
