// axios.ts — shared HTTP client for every DeliveryPulse API call
import axios from "axios";
import { AUTH_TOKEN_KEY } from "./constants";
import { ACTIVE_WORKSPACE_ID_KEY } from "../utils/workspace";

// Dev: Vite proxies /api → localhost:5000. Prod: set VITE_API_URL in .env
const baseURL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "/api" : "http://localhost:5000/api");

// Single axios instance — all api/*.ts files import this default export
const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// REQUEST INTERCEPTOR — runs before each HTTP request leaves the browser
api.interceptors.request.use(
  (config) => {
    // Read token saved at login (auth.api loginUser)
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    // If user is logged in, attach Bearer token so backend knows who they are
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // This sends workspace context with every API call (sidebar active workspace)
    const workspaceId = localStorage.getItem(ACTIVE_WORKSPACE_ID_KEY);
    if (workspaceId) {
      config.headers["x-workspace-id"] = workspaceId;
    }

    // File uploads use FormData — browser must set multipart boundary itself
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// RESPONSE INTERCEPTOR — runs on every response (success or failure)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 = session expired or invalid token — force re-login
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.location.assign("/login");
      return Promise.reject(error);
    }

    // Other errors (404, 500, network) — let the page handle them
    return Promise.reject(error);
  },
);

export default api;
