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
