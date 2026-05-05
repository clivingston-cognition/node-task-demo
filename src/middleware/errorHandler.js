function notFoundHandler(req, res, _next) {
  const isApiRequest = req.path.startsWith('/api/');

  if (isApiRequest) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  }

  return res.status(404).render('error', {
    title: '404 - Not Found',
    message: 'The page you are looking for does not exist.',
    statusCode: 404,
  });
}

function globalErrorHandler(err, _req, res, _next) {
  console.error('Unhandled error:', err);

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}

module.exports = { notFoundHandler, globalErrorHandler };
