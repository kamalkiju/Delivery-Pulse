// Shared alias — dashboard and other modules import requireAuth from here.
// Implementation lives in modules/auth/auth.middleware.js (single source of truth).

export {
  authMiddleware,
  authMiddleware as requireAuth,
} from "../modules/auth/auth.middleware.js";
