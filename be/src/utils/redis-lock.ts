import Redis from "ioredis";

const LOCK_TTL = 5000; // 5 seconds lock timeout
const LOCK_PREFIX = "lock:ticket:";
const SCAN_CACHE_PREFIX = "scan:cache:";
const SCAN_CACHE_TTL = 300; // 5 minutes cache for invalid/used tickets

export class RedisLockManager {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * Acquire a distributed lock for a ticket
   * Returns lock token if acquired, null if already locked
   */
  async acquireLock(orderId: string): Promise<string | null> {
    const lockKey = `${LOCK_PREFIX}${orderId}`;
    const lockToken = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // SET NX with expiry for atomic lock acquisition
    const result = await this.redis.set(
      lockKey,
      lockToken,
      "PX",
      LOCK_TTL,
      "NX"
    );

    if (result === "OK") {
      return lockToken;
    }
    return null;
  }

  /**
   * Release a distributed lock
   * Only releases if we own the lock (token matches)
   */
  async releaseLock(orderId: string, lockToken: string): Promise<boolean> {
    const lockKey = `${LOCK_PREFIX}${orderId}`;
    
    // Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(script, 1, lockKey, lockToken);
    return result === 1;
  }

  /**
   * Check if a ticket is cached as already used/invalid
   * This provides fast rejection without hitting the database
   */
  private getScanCacheKey(orderId: string, eventId?: string): string {
    const scope = eventId && eventId.trim() !== "" ? eventId : "all";
    return `${SCAN_CACHE_PREFIX}${orderId}:${scope}`;
  }

  async getCachedScanResult(orderId: string, eventId?: string): Promise<{
    cached: boolean;
    result?: "already_used" | "invalid" | "not_found";
    checkedInAt?: number;
  }> {
    const cacheKey = this.getScanCacheKey(orderId, eventId);
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return { cached: true, ...data };
      } catch {
        return { cached: false };
      }
    }
    
    return { cached: false };
  }

  /**
   * Cache a scan result for fast rejection
   */
  async cacheScanResult(
    orderId: string,
    result: "already_used" | "invalid" | "not_found",
    checkedInAt?: number,
    eventId?: string
  ): Promise<void> {
    const cacheKey = this.getScanCacheKey(orderId, eventId);
    const data = JSON.stringify({ result, checkedInAt });
    await this.redis.setex(cacheKey, SCAN_CACHE_TTL, data);
  }

  /**
   * Invalidate cache for a ticket (e.g., after successful check-in)
   */
  async invalidateCache(orderId: string): Promise<void> {
    const pattern = `${SCAN_CACHE_PREFIX}${orderId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Record a scan attempt for rate limiting
   */
  async recordScanAttempt(gateId: string): Promise<number> {
    const key = `rate:scan:${gateId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }
    return count;
  }

  /**
   * Check if gate is rate limited
   */
  async isRateLimited(gateId: string, maxPerMinute: number = 100): Promise<boolean> {
    const key = `rate:scan:${gateId}`;
    const count = await this.redis.get(key);
    return count !== null && parseInt(count, 10) > maxPerMinute;
  }

  /**
   * Get real-time stats
   */
  async getRealtimeStats(eventId: string): Promise<{
    activeScans: number;
    recentScansPerMinute: number;
  }> {
    // Count active locks for this event
    const lockPattern = `${LOCK_PREFIX}*`;
    const locks = await this.redis.keys(lockPattern);
    
    // Get recent scan count
    const scanKey = `stats:scans:${eventId}:${Math.floor(Date.now() / 60000)}`;
    const recentScans = await this.redis.get(scanKey);

    return {
      activeScans: locks.length,
      recentScansPerMinute: recentScans ? parseInt(recentScans, 10) : 0,
    };
  }

  /**
   * Increment scan count for stats
   */
  async incrementScanCount(eventId: string): Promise<void> {
    const scanKey = `stats:scans:${eventId}:${Math.floor(Date.now() / 60000)}`;
    await this.redis.incr(scanKey);
    await this.redis.expire(scanKey, 300); // Keep for 5 minutes
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Singleton instance
let lockManager: RedisLockManager | null = null;

export function getRedisLockManager(): RedisLockManager {
  if (!lockManager) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    lockManager = new RedisLockManager(redisUrl);
  }
  return lockManager;
}
