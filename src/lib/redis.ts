import { Redis } from "@upstash/redis";
import { getReviewKey } from "@/data/booths";
import type { BottleDynamicStatus, ReviewItem } from "@/types/festival";

export const SOLD_OUT_THRESHOLD = 20;

// 행사장 공용 Wi-Fi에서 다수의 사용자가 같은 IP를 공유할 수 있으므로
// IP당 분당 300회로 매우 널널하게 설정합니다.
const RELAXED_IP_LIMIT_PER_MIN = 300;
const REVIEW_LOCK_TTL_SECONDS = 60 * 60 * 24 * 7; // 7일

interface StoredReview extends ReviewItem {
  authorUid?: string;
}

interface MemoryStore {
  soldOutVoters: Map<string, Set<string>>;
  ratingStats: Map<string, { sum: number; count: number }>;
  reviews: Map<string, StoredReview[]>;
  reviewLocks: Set<string>;
  rateLimits: Map<string, { count: number; expiresAt: number }>;
}

const globalForStore = globalThis as unknown as {
  __caskMemoryStore?: MemoryStore;
};

function getMemoryStore(): MemoryStore {
  if (!globalForStore.__caskMemoryStore) {
    globalForStore.__caskMemoryStore = {
      soldOutVoters: new Map(),
      ratingStats: new Map(),
      reviews: new Map(),
      reviewLocks: new Set(),
      rateLimits: new Map(),
    };
  }
  return globalForStore.__caskMemoryStore;
}

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

if (!redis && process.env.NODE_ENV !== "production") {
  console.warn(
    "[caskcarnival] UPSTASH_REDIS_REST_URL/TOKEN 미설정: 로컬 메모리 폴백 모드로 동작합니다."
  );
}

function toPublicReviews(
  rawReviews: unknown[],
  uid: string | null
): ReviewItem[] {
  const result: ReviewItem[] = [];
  for (const item of rawReviews) {
    let parsed: StoredReview | null = null;
    if (typeof item === "string") {
      try {
        parsed = JSON.parse(item) as StoredReview;
      } catch {
        parsed = null;
      }
    } else if (item && typeof item === "object") {
      parsed = item as StoredReview;
    }
    if (!parsed) continue;

    result.push({
      id: parsed.id,
      rating: parsed.rating,
      comment: parsed.comment,
      createdAt: parsed.createdAt,
      isMine: Boolean(uid && parsed.authorUid && parsed.authorUid === uid),
    });
  }
  return result;
}

/**
 * 행사장 공용 Wi-Fi 환경을 고려한 매우 느슨한 IP Rate Limit (분당 300회)
 */
export async function checkRelaxedIpRateLimit(ip: string): Promise<boolean> {
  if (!redis) {
    const store = getMemoryStore();
    const now = Date.now();
    const current = store.rateLimits.get(ip);
    if (!current || current.expiresAt < now) {
      store.rateLimits.set(ip, { count: 1, expiresAt: now + 60_000 });
      return true;
    }
    if (current.count >= RELAXED_IP_LIMIT_PER_MIN) {
      return false;
    }
    current.count += 1;
    return true;
  }

  const key = `ratelimit:ip:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }
  return count <= RELAXED_IP_LIMIT_PER_MIN;
}

export async function getBottleStatus(
  bottleId: string,
  uid: string | null
): Promise<BottleDynamicStatus> {
  const reviewKey = getReviewKey(bottleId);

  if (!redis) {
    const store = getMemoryStore();
    const voters = store.soldOutVoters.get(bottleId);
    const soldOutCount = voters ? voters.size : 0;
    const rating = store.ratingStats.get(reviewKey) ?? { sum: 0, count: 0 };
    const storedReviews = store.reviews.get(reviewKey) ?? [];

    return {
      bottleId,
      soldOutCount,
      isSoldOut: soldOutCount >= SOLD_OUT_THRESHOLD,
      ratingAvg:
        rating.count > 0 ? Number((rating.sum / rating.count).toFixed(1)) : 0,
      ratingCount: rating.count,
      reviews: toPublicReviews(storedReviews, uid),
      hasVotedSoldOut: uid ? Boolean(voters?.has(uid)) : false,
      hasReviewed: uid ? store.reviewLocks.has(`${reviewKey}:${uid}`) : false,
    };
  }

  const pipeline = redis.pipeline();
  pipeline.scard(`soldout:voters:${bottleId}`);
  pipeline.hgetall<{ sum?: number | string; count?: number | string }>(
    `rating:${reviewKey}`
  );
  pipeline.lrange<string>(`reviews:${reviewKey}`, 0, 29);

  if (uid) {
    pipeline.sismember(`soldout:voters:${bottleId}`, uid);
    pipeline.exists(`review:lock:${reviewKey}:${uid}`);
  }

  const results = await pipeline.exec();
  const soldOutCount = Number(results[0] ?? 0);
  const ratingObj =
    (results[1] as { sum?: number | string; count?: number | string } | null) ??
    {};
  const sum = Number(ratingObj.sum ?? 0);
  const count = Number(ratingObj.count ?? 0);
  const rawReviews = (results[2] as unknown[]) ?? [];

  const hasVotedSoldOut = uid ? Number(results[3] ?? 0) === 1 : false;
  const hasReviewed = uid ? Number(results[4] ?? 0) === 1 : false;

  return {
    bottleId,
    soldOutCount,
    isSoldOut: soldOutCount >= SOLD_OUT_THRESHOLD,
    ratingAvg: count > 0 ? Number((sum / count).toFixed(1)) : 0,
    ratingCount: count,
    reviews: toPublicReviews(rawReviews, uid),
    hasVotedSoldOut,
    hasReviewed,
  };
}

export async function getAllBottleStatuses(
  bottleIds: string[],
  uid: string | null
): Promise<Record<string, BottleDynamicStatus>> {
  if (bottleIds.length === 0) return {};

  if (!redis) {
    const entries = await Promise.all(
      bottleIds.map(async (id) => [id, await getBottleStatus(id, uid)] as const)
    );
    return Object.fromEntries(entries);
  }

  const pipeline = redis.pipeline();
  for (const bottleId of bottleIds) {
    const reviewKey = getReviewKey(bottleId);
    pipeline.scard(`soldout:voters:${bottleId}`);
    pipeline.hgetall(`rating:${reviewKey}`);
    pipeline.lrange(`reviews:${reviewKey}`, 0, 19);
    if (uid) {
      pipeline.sismember(`soldout:voters:${bottleId}`, uid);
      pipeline.exists(`review:lock:${reviewKey}:${uid}`);
    }
  }

  const results = await pipeline.exec();
  const step = uid ? 5 : 3;
  const map: Record<string, BottleDynamicStatus> = {};

  bottleIds.forEach((bottleId, idx) => {
    const base = idx * step;
    const soldOutCount = Number(results[base] ?? 0);
    const ratingObj =
      (results[base + 1] as {
        sum?: number | string;
        count?: number | string;
      } | null) ?? {};
    const sum = Number(ratingObj.sum ?? 0);
    const count = Number(ratingObj.count ?? 0);
    const rawReviews = (results[base + 2] as unknown[]) ?? [];

    const hasVotedSoldOut = uid ? Number(results[base + 3] ?? 0) === 1 : false;
    const hasReviewed = uid ? Number(results[base + 4] ?? 0) === 1 : false;

    map[bottleId] = {
      bottleId,
      soldOutCount,
      isSoldOut: soldOutCount >= SOLD_OUT_THRESHOLD,
      ratingAvg: count > 0 ? Number((sum / count).toFixed(1)) : 0,
      ratingCount: count,
      reviews: toPublicReviews(rawReviews, uid),
      hasVotedSoldOut,
      hasReviewed,
    };
  });

  return map;
}

export async function voteSoldOut(
  bottleId: string,
  uid: string
): Promise<{ alreadyVoted: boolean; status: BottleDynamicStatus }> {
  if (!redis) {
    const store = getMemoryStore();
    let voters = store.soldOutVoters.get(bottleId);
    if (!voters) {
      voters = new Set();
      store.soldOutVoters.set(bottleId, voters);
    }
    const alreadyVoted = voters.has(uid);
    if (!alreadyVoted) {
      voters.add(uid);
    }
    return {
      alreadyVoted,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  const added = await redis.sadd(`soldout:voters:${bottleId}`, uid);
  return {
    alreadyVoted: added === 0,
    status: await getBottleStatus(bottleId, uid),
  };
}

export async function cancelSoldOutVote(
  bottleId: string,
  uid: string
): Promise<{ canceled: boolean; status: BottleDynamicStatus }> {
  if (!redis) {
    const store = getMemoryStore();
    const voters = store.soldOutVoters.get(bottleId);
    const canceled = voters ? voters.delete(uid) : false;
    return {
      canceled,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  const removed = await redis.srem(`soldout:voters:${bottleId}`, uid);
  return {
    canceled: removed > 0,
    status: await getBottleStatus(bottleId, uid),
  };
}

export async function addBottleReview(
  bottleId: string,
  uid: string,
  rating: number,
  comment: string
): Promise<{ alreadyReviewed: boolean; status: BottleDynamicStatus }> {
  const reviewKey = getReviewKey(bottleId);
  const review: StoredReview = {
    id: crypto.randomUUID(),
    rating,
    comment,
    createdAt: new Date().toISOString(),
    authorUid: uid,
  };

  if (!redis) {
    const store = getMemoryStore();
    const lockKey = `${reviewKey}:${uid}`;
    if (store.reviewLocks.has(lockKey)) {
      return {
        alreadyReviewed: true,
        status: await getBottleStatus(bottleId, uid),
      };
    }
    store.reviewLocks.add(lockKey);

    const prev = store.ratingStats.get(reviewKey) ?? { sum: 0, count: 0 };
    store.ratingStats.set(reviewKey, {
      sum: prev.sum + rating,
      count: prev.count + 1,
    });

    const list = store.reviews.get(reviewKey) ?? [];
    store.reviews.set(reviewKey, [review, ...list].slice(0, 50));

    return {
      alreadyReviewed: false,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  const lockAcquired = await redis.set(`review:lock:${reviewKey}:${uid}`, "1", {
    nx: true,
    ex: REVIEW_LOCK_TTL_SECONDS,
  });

  if (!lockAcquired) {
    return {
      alreadyReviewed: true,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  const pipeline = redis.pipeline();
  pipeline.hincrby(`rating:${reviewKey}`, "sum", rating);
  pipeline.hincrby(`rating:${reviewKey}`, "count", 1);
  pipeline.lpush(`reviews:${reviewKey}`, JSON.stringify(review));
  pipeline.ltrim(`reviews:${reviewKey}`, 0, 49);
  await pipeline.exec();

  return {
    alreadyReviewed: false,
    status: await getBottleStatus(bottleId, uid),
  };
}

export async function deleteBottleReview(
  bottleId: string,
  uid: string
): Promise<{ deleted: boolean; status: BottleDynamicStatus }> {
  const reviewKey = getReviewKey(bottleId);

  if (!redis) {
    const store = getMemoryStore();
    const list = store.reviews.get(reviewKey) ?? [];
    const target = list.find((r) => r.authorUid === uid);
    if (!target) {
      const hadLock = store.reviewLocks.delete(`${reviewKey}:${uid}`);
      return {
        deleted: hadLock,
        status: await getBottleStatus(bottleId, uid),
      };
    }

    store.reviews.set(
      reviewKey,
      list.filter((r) => r.id !== target.id)
    );
    store.reviewLocks.delete(`${reviewKey}:${uid}`);

    const prev = store.ratingStats.get(reviewKey) ?? { sum: 0, count: 0 };
    store.ratingStats.set(reviewKey, {
      sum: Math.max(0, prev.sum - target.rating),
      count: Math.max(0, prev.count - 1),
    });

    return {
      deleted: true,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  const rawList = await redis.lrange<unknown>(`reviews:${reviewKey}`, 0, 49);
  let targetRaw: string | null = null;
  let targetRating = 0;

  for (const item of rawList) {
    const rawStr = typeof item === "string" ? item : JSON.stringify(item);
    try {
      const parsed = JSON.parse(rawStr) as StoredReview;
      if (parsed.authorUid === uid) {
        targetRaw = rawStr;
        targetRating = Number(parsed.rating ?? 0);
        break;
      }
    } catch {
      // ignore malformed item
    }
  }

  if (!targetRaw) {
    const hadLock = await redis.del(`review:lock:${reviewKey}:${uid}`);
    return {
      deleted: hadLock > 0,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  const pipeline = redis.pipeline();
  pipeline.lrem(`reviews:${reviewKey}`, 1, targetRaw);
  pipeline.hincrby(`rating:${reviewKey}`, "sum", -targetRating);
  pipeline.hincrby(`rating:${reviewKey}`, "count", -1);
  pipeline.del(`review:lock:${reviewKey}:${uid}`);
  await pipeline.exec();

  return {
    deleted: true,
    status: await getBottleStatus(bottleId, uid),
  };
}
