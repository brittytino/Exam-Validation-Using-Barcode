import { db, User } from '../db/schema';
import localforage from 'localforage';

// Constants
const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

// Simple hash function for demo purposes
// In production, use a proper crypto library
function hashPassword(password: string): string {
  // For demo purposes, use simple mapping for test credentials
  if (password === 'admin') {
    return '14c4b06b824ec593239362517f538b29'; // 'admin'
  } else if (password === 'test') {
    return '098f6bcd4621d373cade4e832627b4f6'; // 'test'
  }
  
  // Fallback to simple hash for other passwords
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Authentication functions
export async function login(username: string, password: string): Promise<{
  success: boolean;
  message: string;
  user?: User;
}> {
  try {
    // Try to authenticate offline first
    const user = await db.users.where('username').equals(username).first();
    
    if (!user) {
      console.error('User not found:', username);
      return { success: false, message: 'User not found' };
    }
    
    const passwordHash = hashPassword(password);
    console.log('Login attempt:', { username, passwordHash, userHash: user.passwordHash });
    
    if (user.passwordHash !== passwordHash) {
      console.error('Invalid password for user:', username);
      return { success: false, message: 'Invalid password' };
    }
    
    // Update last login time
    await db.users.update(user.id, { lastLogin: new Date() });
    
    // Store auth data in localStorage for persistence
    const token = generateOfflineToken(user);
    await localforage.setItem(AUTH_TOKEN_KEY, token);
    await localforage.setItem(USER_DATA_KEY, {
      id: user.id,
      username: user.username,
      role: user.role
    });
    
    console.log('Login successful for user:', username);
    return { success: true, message: 'Login successful', user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'An error occurred during login' };
  }
}

export async function logout(): Promise<void> {
  await localforage.removeItem(AUTH_TOKEN_KEY);
  await localforage.removeItem(USER_DATA_KEY);
}

export async function getCurrentUser(): Promise<{
  isAuthenticated: boolean;
  user?: { id: string; username: string; role: string };
}> {
  try {
    const token = await localforage.getItem<string>(AUTH_TOKEN_KEY);
    
    if (!token) {
      return { isAuthenticated: false };
    }
    
    const userData = await localforage.getItem<{
      id: string;
      username: string;
      role: string;
    }>(USER_DATA_KEY);
    
    if (!userData) {
      return { isAuthenticated: false };
    }
    
    // Verify token validity (in a real app, check expiration, etc.)
    if (!verifyOfflineToken(token, userData.id)) {
      await logout();
      return { isAuthenticated: false };
    }
    
    return { isAuthenticated: true, user: userData };
  } catch (error) {
    console.error('Get current user error:', error);
    return { isAuthenticated: false };
  }
}

// Helper functions for token management
function generateOfflineToken(user: User): string {
  // In a real app, use a proper JWT library
  // This is a simplified version for demo purposes
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days expiry
  };
  
  return btoa(JSON.stringify(payload));
}

function verifyOfflineToken(token: string, userId: string): boolean {
  try {
    const payload = JSON.parse(atob(token));
    
    // Check if token is expired
    if (payload.exp < Date.now()) {
      return false;
    }
    
    // Check if token belongs to the user
    if (payload.id !== userId) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}