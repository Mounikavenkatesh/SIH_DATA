/**
 * Central Error Handler Middleware
 * Prevents leaks of internal secrets or unformatted stack traces to clients.
 */

function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'Internal server error occurred.';

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'SERVER_ERROR',
    timestamp: new Date().toISOString(),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Endpoint '${req.method} ${req.originalUrl}' not found.`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
