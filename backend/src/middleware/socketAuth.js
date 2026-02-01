/**
 * SOCKET AUTHENTICATION MIDDLEWARE
 * 
 * Validates JWT tokens for Socket.IO connections
 */

import jwt from 'jsonwebtoken';

/**
 * Authenticate socket connection
 */
export default function socketAuth(socket, next) {
  try {
    // Get token from handshake
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace('Bearer ', '');
    
    // Verify JWT
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || 'your-secret-key');
    
    // Attach user info to socket
    socket.userId = decoded.userId;
    socket.userRole = decoded.role;
    socket.username = decoded.username;
    
    next();
  } catch (error) {
    console.error('Socket authentication failed:', error.message);
    next(new Error('Invalid or expired token'));
  }
}
