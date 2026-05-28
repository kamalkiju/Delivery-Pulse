// error.middleware.js — global Express error handler (4-arg middleware)

/**
 * Catches errors passed via next(err) or thrown in async route handlers.
 * Always responds with JSON: { success: false, message, status }.
 */
const errorMiddleware = (err, _req, res, _next) => {
  // Default to 500 Internal Server Error when no status was set on the error
  const statusCode = err.statusCode || err.status || 500;

  // Use the error message when present; avoid leaking stack traces in production
  const message =
    err.message ||
    (statusCode === 404
      ? "Resource not found"
      : statusCode === 401
        ? "Unauthorized"
        : statusCode === 403
          ? "Forbidden"
          : "Internal server error");

  // Log server-side for debugging (status 5xx and unexpected errors)
  if (statusCode >= 500) {
    console.error("[error]", err);
  }

  // Consistent API error shape for the React frontend
  res.status(statusCode).json({
    success: false,
    message,
    status: statusCode,
  });
};

export default errorMiddleware;
