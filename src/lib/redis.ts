import { Redis } from "@upstash/redis";
import type { BottleDynamicStatus, ReviewItem } from "@/types/festival";

export const SOLD_OUT_THRESHOLD = 20;

// 행사장 공용 Wi-Fi에서 다수의 사용자가 같은 IP를 공유할 수 있으므로
// IP당 분당 300회로 매우 널널하게 설정합니다.
const RELAXED_IP_LIMIT_PER_MIN = 300;
const REVIEW_LOCK_TTL_SECONDS = 60 * 60 * 24 * 7; // 7일

interface MemoryStore {
  soldOutVoters: Map<string, Set<string>>;
  ratingStats: Map<string, { sum: number; count: number }>;
  reviews: Map<string, ReviewItem[]>;
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

const hasUpstashEnv =
  Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasUpstashEnv ? Redis.fromEnv() : null;

if (!hasUpstashEnv && process.env.NODE_ENV !== "production") {
  console.warn(
    "[caskcarnival] UPSTASH_REDIS_REST_URL/TOKEN 미설정: 로컬 메모리 폴백 모드로 동작합니다."
  );
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
  if (!redis) {
    const store = getMemoryStore();
    const voters = store.soldOutVoters.get(bottleId);
    const soldOutCount = voters ? voters.size : 0;
    const rating = store.ratingStats.get(bottleId) ?? { sum: 0, count: 0 };
    const reviews = store.reviews.get(bottleId) ?? [];

    return {
      bottleId,
      soldOutCount,
      isSoldOut: soldOutCount >= SOLD_OUT_THRESHOLD,
      ratingAvg:
        rating.count > 0 ? Number((rating.sum / rating.count).toFixed(1)) : 0,
      ratingCount: rating.count,
      reviews,
      hasVotedSoldOut: uid ? Boolean(voters?.has(uid)) : false,
      hasReviewed: uid ? store.reviewLocks.has(`${bottleId}:${uid}`) : false,
    };
  }

  const pipeline = redis.pipeline();
  pipeline.scard(`soldout:voters:${bottleId}`);
  pipeline.hgetall<{ sum?: number | string; count?: number | string }>(
    `rating:${bottleId}`
  );
  pipeline.lrange<string>(`reviews:${bottleId}`, 0, 29);

  if (uid) {
    pipeline.sismember(`soldout:voters:${bottleId}`, uid);
    pipeline.exists(`review:lock:${bottleId}:${uid}`);
  }

  const results = await pipeline.exec();
  const soldOutCount = Number(results[0] ?? 0);
  const ratingObj =
    (results[1] as { sum?: number | string; count?: number | string } | null) ??
    {};
  const sum = Number(ratingObj.sum ?? 0);
  const count = Number(ratingObj.count ?? 0);
  const rawReviews = (results[2] as unknown[]) ?? [];

  const reviews: ReviewItem[] = rawReviews
    .map((item) => {
      if (typeof item === "string") {
        try {
          return JSON.parse(item) as ReviewItem;
        } catch {
          return null;
        }
      }
      return item as ReviewItem;
    })
    .filter((item): item is ReviewItem => item !== null);

  const hasVotedSoldOut = uid ? Number(results[3] ?? 0) === 1 : false;
  const hasReviewed = uid ? Number(results[4] ?? 0) === 1 : false;

  return {
    bottleId,
    soldOutCount,
    isSoldOut: soldOutCount >= SOLD_OUT_THRESHOLD,
    ratingAvg: count > 0 ? Number((sum / count).toFixed(1)) : 0,
    ratingCount: count,
    reviews,
    hasVotedSoldOut,
    hasReviewed,
  };
}

export async function getAllBottleStatuses(
  bottleIds: string[],
  uid: string | null
): Promise<Record<string, BottleDynamicStatus>> {
  const entries = await Promise.all(
    bottleIds.map(async (id) => [id, await getBottleStatus(id, uid)] as const)
  );
  return Object.fromEntries(entries);
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

export async function addBottleReview(
  bottleId: string,
  uid: string,
  rating: number,
  comment: string
): Promise<{ alreadyReviewed: boolean; status: BottleDynamicStatus }> {
  const review: ReviewItem = {
    id: crypto.randomUUID(),
    rating,
    comment,
    createdAt: new Date().toISOString(),
  };

  if (!redis) {
    const store = getMemoryStore();
    const lockKey = `${bottleId}:${uid}`;
    if (store.reviewLocks.has(lockKey)) {
      return {
        alreadyReviewed: true,
        status: await getBottleStatus(bottleId, uid),
      };
    }
    store.reviewLocks.add(lockKey);

    const prev = store.ratingStats.get(bottleId) ?? { sum: 0, count: 0 };
    store.ratingStats.set(bottleId, {
      sum: prev.sum + rating,
      count: prev.count + 1,
    });

    const list = store.reviews.get(bottleId) ?? [];
    store.reviews.set(bottleId, [review, ...list].slice(0, 50));

    return {
      alreadyReviewed: false,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  // NX 옵션으로 브라우저(HttpOnly 쿠키) 기준 중복 리뷰 원자적 차단
  const lockAcquired = await redis.set(`review:lock:${bottleId}:${uid}`, "1", {
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
  pipeline.hincrby(`rating:${bottleId}`, "sum", rating);
  pipeline.hincrby(`rating:${bottleId}`, "count", 1);
  pipeline.lpush(`reviews:${bottleId}`, JSON.stringify(review));
  pipeline.ltrim(`reviews:${bottleId}`, 0, 49);
  await pipeline.exec();

  return {
    alreadyReviewed: false,
    status: await getBottleStatus(bottleId, uid),
  };
}
