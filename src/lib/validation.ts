import validator from 'validator';

/**
 * Validates MT5 account number format
 * MT5 accounts are typically 5-12 digit numbers
 */
export function validateMT5Account(account: string | number): { valid: boolean; error?: string } {
  const accountStr = String(account).trim();
  
  if (!accountStr) {
    return { valid: false, error: 'MT5 account number is required' };
  }
  
  if (!/^\d{5,12}$/.test(accountStr)) {
    return { valid: false, error: 'MT5 account must be 5-12 digits' };
  }
  
  return { valid: true };
}

/**
 * Validates email format with additional security checks
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmedEmail = email.trim().toLowerCase();
  
  if (!trimmedEmail) {
    return { valid: false, error: 'Email is required' };
  }
  
  if (!validator.isEmail(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  // Additional checks
  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email too long' };
  }
  
  return { valid: true };
}

/**
 * Validates password strength
 * Requirements:
 * - At least 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  
  if (password.length < 12) {
    return { valid: false, error: 'Password must be at least 12 characters long' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  if (!/[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  
  // Check for common weak passwords
  const commonPasswords = ['password123!', 'Password123!', 'Admin123!@#'];
  if (commonPasswords.includes(password)) {
    return { valid: false, error: 'Password is too common' };
  }
  
  return { valid: true };
}

/**
 * Sanitizes string input to prevent injection attacks
 */
export function sanitizeString(input: string, maxLength: number = 255): string {
  return validator.escape(input.trim()).slice(0, maxLength);
}

/**
 * Validates file size for uploads
 */
export function validateFileSize(base64Data: string, maxSizeMB: number = 5): { valid: boolean; error?: string } {
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  if (sizeInMB > maxSizeMB) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }
  
  return { valid: true };
}

/**
 * Validates amount for payment processing
 */
export function validateAmount(amount: number | string): { valid: boolean; error?: string } {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return { valid: false, error: 'Invalid amount' };
  }
  
  if (numAmount < 0) {
    return { valid: false, error: 'Amount cannot be negative' };
  }
  
  if (numAmount > 999999) {
    return { valid: false, error: 'Amount too large' };
  }
  
  return { valid: true };
}
