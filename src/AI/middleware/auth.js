/**
 * Authentication middleware for ARKS RWA AI service
 * Validates Bearer token authentication between canister and AI service
 */

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header missing'
      });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Invalid authentication format',
        message: 'Authorization header must start with "Bearer "'
      });
    }
    
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const expectedToken = process.env.AUTH_TOKEN;
    
    if (!expectedToken) {
      console.error('AUTH_TOKEN environment variable not configured');
      return res.status(500).json({
        error: 'Service configuration error',
        message: 'Authentication not properly configured'
      });
    }
    
    if (token !== expectedToken) {
      return res.status(401).json({
        error: 'Invalid authentication token',
        message: 'The provided token is not valid'
      });
    }
    
    // Authentication successful - continue to next middleware
    next();
    
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'An error occurred during authentication'
    });
  }
};

export default authMiddleware;