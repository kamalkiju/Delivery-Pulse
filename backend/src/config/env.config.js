// env.config.js — central place to read secrets and settings from backend/.env
//
// Uses getters so values are read after dotenv.config() runs in server.js.

export default {
  get JWT_SECRET() {
    return process.env.JWT_SECRET;
  },
  get JWT_EXPIRES_IN() {
    return process.env.JWT_EXPIRES_IN || "7d";
  },
};
