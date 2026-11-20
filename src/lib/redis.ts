import { Redis as UpstashRedis } from "@upstash/redis";
import IoRedis from "ioredis";
import { ALL_ITEM_IDS, getReviewKey } from "@/data/booths";
import type {
  BottleDynamicStatus,
  CustomBoothItem,
  ItemPatch,
  ReviewItem,
} from "@/types/festival";

export const SOLD_OUT_THRESHOLD = 20;

// 행사장 공용 Wi-Fi에서 다수의 사용자가 같은 IP를 공유할 수 있으므로
// IP당 분당 300회로 매우 널널하게 설정합니다.
const RELAXED_IP_LIMIT_PER_MIN = 300;
const REVIEW_LOCK_TTL_SECONDS = 60 * 60 * 24 * 7; // 7일
const MAX_CONTRIBUTIONS_PER_USER = 20;
const DELETED_SENTINEL = "__CASK_DELETED__";

interface StoredReview extends ReviewItem {
  authorUid?: string;
}

interface StoredCustomItem extends CustomBoothItem {
  authorUid?: string;
}

interface RatingSummary {
  sum: number;
  count: number;
}

interface UserState {
  voted: string[];
  reviewed: string[];
}

interface MemoryStore {
  soldOutVoters: Map<string, Set<string>>;
  ratingStats: Map<string, RatingSummary>;
  reviews: Map<string, StoredReview[]>;
  reviewLocks: Set<string>;
  rateLimits: Map<string, { count: number; expiresAt: number }>;
  itemPatches: Map<string, ItemPatch>;
  customItems: Map<string, StoredCustomItem>;
  contribCounts: Map<string, number>;
}

interface RedisAdapter {
  get(key: string): Promise<unknown>;
  set(
    key: string,
    value: string,
    opts?: { nx?: boolean; ex?: number }
  ): Promise<boolean>;
  del(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  sadd(key: string, member: string): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  scard(key: string): Promise<number>;
  sismember(key: string, member: string): Promise<number>;
  exists(key: string): Promise<number>;
  hget(key: string, field: string): Promise<unknown>;
  hset(key: string, field: string, value: string | number): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, unknown>>;
  hexists(key: string, field: string): Promise<number>;
  lrange(key: string, start: number, stop: number): Promise<unknown[]>;
  lpush(key: string, value: string): Promise<void>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  lset(key: string, index: number, value: string): Promise<void>;
  lrem(key: string, count: number, value: string): Promise<void>;
}

const globalForStore = globalThis as unknown as {
  __caskMemoryStore?: MemoryStore;
  __caskIoRedis?: IoRedis;
};

function getMemoryStore(): MemoryStore {
  if (!globalForStore.__caskMemoryStore) {
    globalForStore.__caskMemoryStore = {
      soldOutVoters: new Map(),
      ratingStats: new Map(),
      reviews: new Map(),
      reviewLocks: new Set(),
      rateLimits: new Map(),
      itemPatches: new Map(),
      customItems: new Map(),
      contribCounts: new Map(),
    };
  }
  return globalForStore.__caskMemoryStore;
}

function createIoRedisAdapter(url: string): RedisAdapter {
  if (!globalForStore.__caskIoRedis) {
    globalForStore.__caskIoRedis = new IoRedis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      enableReadyCheck: false,
      lazyConnect: false,
    });
  }
  const client = globalForStore.__caskIoRedis;

  return {
    get: (k) => client.get(k),
    async set(k, v, opts) {
      if (opts?.nx && opts?.ex) {
        const res = await client.set(k, v, "EX", opts.ex, "NX");
        return res === "OK";
      }
      if (opts?.ex) {
        const res = await client.set(k, v, "EX", opts.ex);
        return res === "OK";
      }
      if (opts?.nx) {
        const res = await client.set(k, v, "NX");
        return res === "OK";
      }
      const res = await client.set(k, v);
      return res === "OK";
    },
    del: (k) => client.del(k),
    incr: (k) => client.incr(k),
    async expire(k, sec) {
      await client.expire(k, sec);
    },
    sadd: (k, m) => client.sadd(k, m),
    srem: (k, m) => client.srem(k, m),
    scard: (k) => client.scard(k),
    sismember: (k, m) => client.sismember(k, m),
    exists: (k) => client.exists(k),
    hget: (k, f) => client.hget(k, f),
    async hset(k, f, v) {
      await client.hset(k, f, String(v));
    },
    async hdel(k, f) {
      await client.hdel(k, f);
    },
    async hgetall(k) {
      return (await client.hgetall(k)) ?? {};
    },
    hexists: (k, f) => client.hexists(k, f),
    lrange: (k, start, stop) => client.lrange(k, start, stop),
    async lpush(k, v) {
      await client.lpush(k, v);
    },
    async ltrim(k, start, stop) {
      await client.ltrim(k, start, stop);
    },
    async lset(k, idx, v) {
      await client.lset(k, idx, v);
    },
    async lrem(k, count, v) {
      await client.lrem(k, count, v);
    },
  };
}

function createUpstashAdapter(url: string, token: string): RedisAdapter {
  const client = new UpstashRedis({ url, token });
  return {
    get: (k) => client.get<unknown>(k),
    async set(k, v, opts) {
      if (opts?.nx && opts?.ex) {
        const res = await client.set(k, v, { nx: true, ex: opts.ex });
        return Boolean(res);
      }
      if (opts?.ex) {
        const res = await client.set(k, v, { ex: opts.ex });
        return Boolean(res);
      }
      if (opts?.nx) {
        const res = await client.set(k, v, { nx: true });
        return Boolean(res);
      }
      const res = await client.set(k, v);
      return Boolean(res);
    },
    del: (k) => client.del(k),
    incr: (k) => client.incr(k),
    async expire(k, sec) {
      await client.expire(k, sec);
    },
    sadd: (k, m) => client.sadd(k, m),
    srem: (k, m) => client.srem(k, m),
    scard: (k) => client.scard(k),
    sismember: (k, m) => client.sismember(k, m),
    exists: (k) => client.exists(k),
    hget: (k, f) => client.hget<unknown>(k, f),
    async hset(k, f, v) {
      await client.hset(k, { [f]: v });
    },
    async hdel(k, f) {
      await client.hdel(k, f);
    },
    async hgetall(k) {
      return ((await client.hgetall<Record<string, unknown>>(k)) ?? {}) as Record<
        string,
        unknown
      >;
    },
    hexists: (k, f) => client.hexists(k, f),
    lrange: (k, start, stop) => client.lrange<unknown>(k, start, stop),
    async lpush(k, v) {
      await client.lpush(k, v);
    },
    async ltrim(k, start, stop) {
      await client.ltrim(k, start, stop);
    },
    async lset(k, idx, v) {
      await client.lset(k, idx, v);
    },
    async lrem(k, count, v) {
      await client.lrem(k, count, v);
    },
  };
}

function getRedisClient(): RedisAdapter | null {
  // 1순위: 직접 설치한 Redis (OCI 등) — REDIS_URL
  if (process.env.REDIS_URL) {
    return createIoRedisAdapter(process.env.REDIS_URL);
  }
  // 2순위: Upstash Redis REST
  const upstashUrl =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const upstashToken =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (upstashUrl && upstashToken) {
    return createUpstashAdapter(upstashUrl, upstashToken);
  }
  return null;
}

const redis = getRedisClient();

if (!redis && process.env.NODE_ENV !== "production") {
  console.warn(
    "[caskcarnival] REDIS_URL / UPSTASH_REDIS_REST_URL 미설정: 로컬 메모리 폴백 모드로 동작합니다."
  );
}

function parseJsonSafe<T>(val: unknown): T | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }
  if (typeof val === "object") {
    return val as T;
  }
  return null;
}

function toPublicReviews(
  rawReviews: unknown[],
  uid: string | null
): ReviewItem[] {
  const result: ReviewItem[] = [];
  for (const item of rawReviews) {
    if (item === DELETED_SENTINEL) continue;
    const parsed = parseJsonSafe<StoredReview>(item);
    if (!parsed || !parsed.id) continue;

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

async function getUserState(uid: string): Promise<UserState> {
  if (!redis) return { voted: [], reviewed: [] };
  const raw = await redis.get(`user:state:${uid}`);
  const parsed = parseJsonSafe<UserState>(raw);
  return {
    voted: Array.isArray(parsed?.voted) ? parsed.voted : [],
    reviewed: Array.isArray(parsed?.reviewed) ? parsed.reviewed : [],
  };
}

async function updateUserState(
  uid: string,
  updater: (state: UserState) => UserState
): Promise<void> {
  if (!redis) return;
  const current = await getUserState(uid);
  const next = updater(current);
  await redis.set(`user:state:${uid}`, JSON.stringify(next), {
    ex: REVIEW_LOCK_TTL_SECONDS,
  });
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

/**
 * 단건 상세 조회 (모달 오픈 시 호출 — 한줄평 목록 포함)
 */
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

  const [soldOutCount, ratingRaw, rawReviews, hasVotedNum, hasReviewedNum] =
    await Promise.all([
      redis.scard(`soldout:voters:${bottleId}`),
      redis.hget("summary:ratings", reviewKey),
      redis.lrange(`reviews:${reviewKey}`, 0, 29),
      uid ? redis.sismember(`soldout:voters:${bottleId}`, uid) : Promise.resolve(0),
      uid ? redis.exists(`review:lock:${reviewKey}:${uid}`) : Promise.resolve(0),
    ]);

  const ratingObj = parseJsonSafe<RatingSummary>(ratingRaw) ?? {
    sum: 0,
    count: 0,
  };
  const sum = Math.max(0, Number(ratingObj.sum ?? 0));
  const count = Math.max(0, Number(ratingObj.count ?? 0));

  return {
    bottleId,
    soldOutCount: Number(soldOutCount ?? 0),
    isSoldOut: Number(soldOutCount ?? 0) >= SOLD_OUT_THRESHOLD,
    ratingAvg: count > 0 ? Number((sum / count).toFixed(1)) : 0,
    ratingCount: count,
    reviews: toPublicReviews(rawReviews ?? [], uid),
    hasVotedSoldOut: Number(hasVotedNum ?? 0) === 1,
    hasReviewed: Number(hasReviewedNum ?? 0) === 1,
  };
}

/**
 * 초기 페이지 로드용 초경량 통합 조회 (단 5개 Redis 커맨드)
 */
export async function getInitialDashboardData(uid: string | null): Promise<{
  statuses: Record<string, BottleDynamicStatus>;
  patches: Record<string, ItemPatch>;
  customItems: CustomBoothItem[];
}> {
  if (!redis) {
    const store = getMemoryStore();
    const patches = Object.fromEntries(store.itemPatches.entries());
    const customItems: CustomBoothItem[] = Array.from(
      store.customItems.values()
    ).map((item) => {
      const { authorUid, ...rest } = item;
      return {
        ...rest,
        isMine: Boolean(uid && authorUid && authorUid === uid),
      };
    });
    const allIds = [...ALL_ITEM_IDS, ...customItems.map((c) => c.id)];
    const entries = await Promise.all(
      allIds.map(async (id) => [id, await getBottleStatus(id, uid)] as const)
    );
    return {
      statuses: Object.fromEntries(entries),
      patches,
      customItems,
    };
  }

  const [rawSoldOut, rawRatings, rawPatches, rawCustom, userStateRaw] =
    await Promise.all([
      redis.hgetall("summary:soldout"),
      redis.hgetall("summary:ratings"),
      redis.hgetall("patch:items:all"),
      redis.hgetall("custom:items:all"),
      uid ? redis.get(`user:state:${uid}`) : Promise.resolve(null),
    ]);

  const userState = parseJsonSafe<UserState>(userStateRaw) ?? {
    voted: [],
    reviewed: [],
  };
  const votedSet = new Set(userState.voted ?? []);
  const reviewedSet = new Set(userState.reviewed ?? []);

  const patches: Record<string, ItemPatch> = {};
  for (const [id, val] of Object.entries(rawPatches)) {
    const parsed = parseJsonSafe<ItemPatch>(val);
    if (parsed) patches[id] = parsed;
  }

  const customItems: CustomBoothItem[] = [];
  for (const val of Object.values(rawCustom)) {
    const parsed = parseJsonSafe<StoredCustomItem>(val);
    if (!parsed) continue;
    const { authorUid, ...rest } = parsed;
    customItems.push({
      ...rest,
      isMine: Boolean(uid && authorUid && authorUid === uid),
    });
  }
  customItems.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const allIds = [...ALL_ITEM_IDS, ...customItems.map((c) => c.id)];
  const statuses: Record<string, BottleDynamicStatus> = {};

  for (const itemId of allIds) {
    const reviewKey = getReviewKey(itemId);
    const soldOutCount = Math.max(0, Number(rawSoldOut[itemId] ?? 0));
    const ratingObj = parseJsonSafe<RatingSummary>(rawRatings[reviewKey]) ?? {
      sum: 0,
      count: 0,
    };
    const sum = Math.max(0, Number(ratingObj.sum ?? 0));
    const count = Math.max(0, Number(ratingObj.count ?? 0));

    if (
      soldOutCount > 0 ||
      count > 0 ||
      votedSet.has(itemId) ||
      reviewedSet.has(reviewKey)
    ) {
      statuses[itemId] = {
        bottleId: itemId,
        soldOutCount,
        isSoldOut: soldOutCount >= SOLD_OUT_THRESHOLD,
        ratingAvg: count > 0 ? Number((sum / count).toFixed(1)) : 0,
        ratingCount: count,
        reviews: [],
        hasVotedSoldOut: votedSet.has(itemId),
        hasReviewed: reviewedSet.has(reviewKey),
      };
    }
  }

  return { statuses, patches, customItems };
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
  if (added > 0) {
    const count = await redis.scard(`soldout:voters:${bottleId}`);
    await redis.hset("summary:soldout", bottleId, count);
    await updateUserState(uid, (st) => ({
      ...st,
      voted: Array.from(new Set([...st.voted, bottleId])),
    }));
  }

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
  if (removed > 0) {
    const count = await redis.scard(`soldout:voters:${bottleId}`);
    if (count > 0) {
      await redis.hset("summary:soldout", bottleId, count);
    } else {
      await redis.hdel("summary:soldout", bottleId);
    }
    await updateUserState(uid, (st) => ({
      ...st,
      voted: st.voted.filter((id) => id !== bottleId),
    }));
  }

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

  const existingRatingRaw = await redis.hget("summary:ratings", reviewKey);
  const prev = parseJsonSafe<RatingSummary>(existingRatingRaw) ?? {
    sum: 0,
    count: 0,
  };
  const nextRating: RatingSummary = {
    sum: Number((Math.max(0, Number(prev.sum ?? 0)) + rating).toFixed(1)),
    count: Math.max(0, Number(prev.count ?? 0)) + 1,
  };

  await Promise.all([
    redis.hset("summary:ratings", reviewKey, JSON.stringify(nextRating)),
    redis.lpush(`reviews:${reviewKey}`, JSON.stringify(review)),
  ]);
  await redis.ltrim(`reviews:${reviewKey}`, 0, 49);

  await updateUserState(uid, (st) => ({
    ...st,
    reviewed: Array.from(new Set([...st.reviewed, reviewKey])),
  }));

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

  const rawList = await redis.lrange(`reviews:${reviewKey}`, 0, 49);
  const targetIndices: number[] = [];
  let totalRemovedRating = 0;

  rawList.forEach((item, idx) => {
    const parsed = parseJsonSafe<StoredReview>(item);
    if (parsed && parsed.authorUid === uid) {
      targetIndices.push(idx);
      totalRemovedRating += Number(parsed.rating ?? 0);
    }
  });

  if (targetIndices.length === 0) {
    const hadLock = await redis.del(`review:lock:${reviewKey}:${uid}`);
    await updateUserState(uid, (st) => ({
      ...st,
      reviewed: st.reviewed.filter((k) => k !== reviewKey),
    }));
    return {
      deleted: hadLock > 0,
      status: await getBottleStatus(bottleId, uid),
    };
  }

  const existingRatingRaw = await redis.hget("summary:ratings", reviewKey);
  const prev = parseJsonSafe<RatingSummary>(existingRatingRaw) ?? {
    sum: 0,
    count: 0,
  };
  const nextCount = Math.max(0, Number(prev.count ?? 0) - targetIndices.length);
  const nextSum =
    nextCount === 0
      ? 0
      : Number(
          Math.max(0, Number(prev.sum ?? 0) - totalRemovedRating).toFixed(1)
        );

  for (const idx of targetIndices) {
    await redis.lset(`reviews:${reviewKey}`, idx, DELETED_SENTINEL);
  }
  await Promise.all([
    redis.lrem(`reviews:${reviewKey}`, 0, DELETED_SENTINEL),
    nextCount === 0
      ? redis.hdel("summary:ratings", reviewKey)
      : redis.hset(
          "summary:ratings",
          reviewKey,
          JSON.stringify({ sum: nextSum, count: nextCount })
        ),
    redis.del(`review:lock:${reviewKey}:${uid}`),
  ]);

  await updateUserState(uid, (st) => ({
    ...st,
    reviewed: st.reviewed.filter((k) => k !== reviewKey),
  }));

  return {
    deleted: true,
    status: await getBottleStatus(bottleId, uid),
  };
}

export async function isValidItemId(itemId: string): Promise<boolean> {
  if (ALL_ITEM_IDS.includes(itemId)) return true;
  if (!itemId.startsWith("custom-")) return false;
  if (!redis) {
    return getMemoryStore().customItems.has(itemId);
  }
  const exists = await redis.hexists("custom:items:all", itemId);
  return exists === 1;
}

export async function checkUserContributionLimit(uid: string): Promise<boolean> {
  if (!redis) {
    const store = getMemoryStore();
    const count = store.contribCounts.get(uid) ?? 0;
    if (count >= MAX_CONTRIBUTIONS_PER_USER) return false;
    store.contribCounts.set(uid, count + 1);
    return true;
  }
  const key = `user:contrib:count:${uid}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, REVIEW_LOCK_TTL_SECONDS);
  }
  return count <= MAX_CONTRIBUTIONS_PER_USER;
}

export async function saveItemPatch(
  itemId: string,
  incoming: ItemPatch
): Promise<ItemPatch> {
  function mergePatch(prev: ItemPatch): ItemPatch {
    const merged: ItemPatch = { ...prev };
    if (incoming.distillery && !merged.distillery) merged.distillery = incoming.distillery;
    if (incoming.abv && !merged.abv) merged.abv = incoming.abv;
    if (incoming.cask && !merged.cask) merged.cask = incoming.cask;
    if (incoming.age && !merged.age) merged.age = incoming.age;
    if (incoming.vintage && !merged.vintage) merged.vintage = incoming.vintage;
    if (incoming.whiskybaseUrl && !merged.whiskybaseUrl) merged.whiskybaseUrl = incoming.whiskybaseUrl;
    if (incoming.note && !merged.note) merged.note = incoming.note;
    if (typeof incoming.price === "number" && merged.price === undefined) merged.price = incoming.price;
    if (incoming.priceLabel && !merged.priceLabel) merged.priceLabel = incoming.priceLabel;
    return merged;
  }

  if (!redis) {
    const store = getMemoryStore();
    const prev = store.itemPatches.get(itemId) ?? {};
    const merged = mergePatch(prev);
    store.itemPatches.set(itemId, merged);
    return merged;
  }

  const existingRaw = await redis.hget("patch:items:all", itemId);
  const prev = parseJsonSafe<ItemPatch>(existingRaw) ?? {};
  const merged = mergePatch(prev);

  await redis.hset("patch:items:all", itemId, JSON.stringify(merged));
  return merged;
}

export async function addCustomItem(
  item: Omit<
    CustomBoothItem,
    "id" | "createdAt" | "isUserContributed" | "isMine"
  >,
  uid: string
): Promise<CustomBoothItem> {
  const shortId = crypto.randomUUID().slice(0, 8);
  const prefix = item.kind === "bottle" ? "custom-b" : "custom-t";
  const id = `${prefix}-${item.boothCode}-${shortId}`;
  const stored: StoredCustomItem = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
    isUserContributed: true,
    authorUid: uid,
  };

  if (!redis) {
    getMemoryStore().customItems.set(id, stored);
  } else {
    await redis.hset("custom:items:all", id, JSON.stringify(stored));
  }

  const { authorUid: _removed, ...publicItem } = stored;
  void _removed;
  return { ...publicItem, isMine: true };
}

export async function deleteCustomItem(
  itemId: string,
  uid: string
): Promise<{ deleted: boolean; reason?: string }> {
  if (!redis) {
    const store = getMemoryStore();
    const existing = store.customItems.get(itemId);
    if (!existing) return { deleted: false, reason: "not_found" };
    if (existing.authorUid !== uid)
      return { deleted: false, reason: "forbidden" };
    store.customItems.delete(itemId);
    return { deleted: true };
  }

  const raw = await redis.hget("custom:items:all", itemId);
  const parsed = parseJsonSafe<StoredCustomItem>(raw);
  if (!parsed) return { deleted: false, reason: "not_found" };
  if (parsed.authorUid !== uid) return { deleted: false, reason: "forbidden" };

  await redis.hdel("custom:items:all", itemId);
  return { deleted: true };
}

export interface MyReviewEntry {
  reviewKey: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export async function getMyReviews(uid: string): Promise<MyReviewEntry[]> {
  if (!redis) {
    const store = getMemoryStore();
    const list: MyReviewEntry[] = [];
    for (const [reviewKey, reviews] of store.reviews.entries()) {
      const mine = reviews.find((r) => r.authorUid === uid);
      if (mine) {
        list.push({
          reviewKey,
          rating: mine.rating,
          comment: mine.comment,
          createdAt: mine.createdAt,
        });
      }
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }

  const userState = await getUserState(uid);
  const reviewedKeys = userState.reviewed ?? [];
  if (reviewedKeys.length === 0) return [];

  const lists = await Promise.all(
    reviewedKeys.map((key) => redis.lrange(`reviews:${key}`, 0, 49))
  );

  const result: MyReviewEntry[] = [];
  reviewedKeys.forEach((reviewKey, idx) => {
    const rawList = lists[idx] ?? [];
    for (const item of rawList) {
      if (item === DELETED_SENTINEL) continue;
      const parsed = parseJsonSafe<StoredReview>(item);
      if (parsed && parsed.authorUid === uid) {
        result.push({
          reviewKey,
          rating: parsed.rating,
          comment: parsed.comment,
          createdAt: parsed.createdAt,
        });
        break;
      }
    }
  });

  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return result;
}
