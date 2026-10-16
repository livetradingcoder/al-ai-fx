/**
 * In-memory rate limiter for development and production
 * Simple, no external dependencies required
 */
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();

  async limit(identifier: string, maxRequests: number, windowMs: number): Promise<{ success: boolean }> {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return { success: false };
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      this.cleanup();
    }
    
    return { success: true };
  }

  private cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < maxAge);
      if (validRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validRequests);
      }
    }
  }
}

const rateLimiter = new InMemoryRateLimiter();

// Helper function to get client identifier
export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}

// Rate limit configurations
export async function checkLoginRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 5 attempts per 15 minutes
  return rateLimiter.limit(identifier, 5, 15 * 60 * 1000);
}

export async function checkForgotPasswordRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 3 attempts per hour
  return rateLimiter.limit(identifier, 3, 60 * 60 * 1000);
}

export async function checkFreeTrialRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 2 attempts per 24 hours
  return rateLimiter.limit(identifier, 2, 24 * 60 * 60 * 1000);
}

export async function checkApiRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 100 requests per minute
  return rateLimiter.limit(identifier, 100, 60 * 1000);
}

export async function checkMetaEventRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 120 relayed browsing events per minute: a few per page view, with room to
  // spare, but a script cannot use /api/meta/event to flood the pixel.
  return rateLimiter.limit(`meta:${identifier}`, 120, 60 * 1000);
}

export async function checkWebhookRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 1000 requests per minute
  return rateLimiter.limit(identifier, 1000, 60 * 1000);
}

export async function checkProofUploadRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 10 screenshot uploads per hour per person: enough for retries, not enough to fill the bucket.
  return rateLimiter.limit(`proof-upload:${identifier}`, 10, 60 * 60 * 1000);
}

export async function checkProofActionRateLimit(identifier: string): Promise<{ success: boolean }> {
  // Status polls and share submissions from the results portal.
  return rateLimiter.limit(`proof-action:${identifier}`, 60, 60 * 1000);
}

export async function checkGiveawayRateLimit(identifier: string): Promise<{ success: boolean }> {
  // 6 giveaway entries per hour per address: shared networks get room, scripts do not.
  return rateLimiter.limit(`giveaway:${identifier}`, 6, 60 * 60 * 1000);
}
