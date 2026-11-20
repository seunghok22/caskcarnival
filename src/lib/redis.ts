import { Redis } from "@upstash/redis";
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
      itemPatches: new Map(),
      customItems: new Map(),
      contribCounts: new Map(),
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
  const raw = await redis.get<unknown>(`user:state:${uid}`);
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

  const pipeline = redis.pipeline();
  pipeline.scard(`soldout:voters:${bottleId}`);
  pipeline.hget<unknown>("summary:ratings", reviewKey);
  pipeline.lrange<unknown>(`reviews:${reviewKey}`, 0, 29);

  if (uid) {
    pipeline.sismember(`soldout:voters:${bottleId}`, uid);
    pipeline.exists(`review:lock:${reviewKey}:${uid}`);
  }

  const results = await pipeline.exec();
  const soldOutCount = Number(results[0] ?? 0);
  const ratingObj = parseJsonSafe<RatingSummary>(results[1]) ?? {
    sum: 0,
    count: 0,
  };
  const sum = Math.max(0, Number(ratingObj.sum ?? 0));
  const count = Math.max(0, Number(ratingObj.count ?? 0));
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

/**
 * 초기 페이지 로드용 초경량 통합 조회
 * Upstash Redis 커맨드 수를 1,475회 -> 단 5회로 대폭 절감합니다.
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

  const pipeline = redis.pipeline();
  pipeline.hgetall<Record<string, unknown>>("summary:soldout");
  pipeline.hgetall<Record<string, unknown>>("summary:ratings");
  pipeline.hgetall<Record<string, unknown>>("patch:items:all");
  pipeline.hgetall<Record<string, unknown>>("custom:items:all");
  if (uid) {
    pipeline.get<unknown>(`user:state:${uid}`);
  }

  const results = await pipeline.exec();
  const rawSoldOut = (results[0] as Record<string, unknown> | null) ?? {};
  const rawRatings = (results[1] as Record<string, unknown> | null) ?? {};
  const rawPatches = (results[2] as Record<string, unknown> | null) ?? {};
  const rawCustom = (results[3] as Record<string, unknown> | null) ?? {};
  const userStateRaw = uid ? results[4] : null;
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
    await redis.hset("summary:soldout", { [bottleId]: count });
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
      await redis.hset("summary:soldout", { [bottleId]: count });
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

  const existingRatingRaw = await redis.hget<unknown>(
    "summary:ratings",
    reviewKey
  );
  const prev = parseJsonSafe<RatingSummary>(existingRatingRaw) ?? {
    sum: 0,
    count: 0,
  };
  const nextRating: RatingSummary = {
    sum: Math.max(0, Number(prev.sum ?? 0)) + rating,
    count: Math.max(0, Number(prev.count ?? 0)) + 1,
  };

  const pipeline = redis.pipeline();
  pipeline.hset("summary:ratings", {
    [reviewKey]: JSON.stringify(nextRating),
  });
  pipeline.lpush(`reviews:${reviewKey}`, JSON.stringify(review));
  pipeline.ltrim(`reviews:${reviewKey}`, 0, 49);
  await pipeline.exec();

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

  const rawList = await redis.lrange<unknown>(`reviews:${reviewKey}`, 0, 49);
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

  // Upstash 자동 역직렬화 시 LREM 문자열 불일치 문제를 방지하기 위해
  // LSET 센티널 마킹 후 LREM으로 1회 클릭에 확실하게 제거합니다.
  const existingRatingRaw = await redis.hget<unknown>(
    "summary:ratings",
    reviewKey
  );
  const prev = parseJsonSafe<RatingSummary>(existingRatingRaw) ?? {
    sum: 0,
    count: 0,
  };
  const nextCount = Math.max(0, Number(prev.count ?? 0) - targetIndices.length);
  const nextSum =
    nextCount === 0
      ? 0
      : Math.max(0, Number(prev.sum ?? 0) - totalRemovedRating);

  const pipeline = redis.pipeline();
  for (const idx of targetIndices) {
    pipeline.lset(`reviews:${reviewKey}`, idx, DELETED_SENTINEL);
  }
  pipeline.lrem(`reviews:${reviewKey}`, 0, DELETED_SENTINEL);
  if (nextCount === 0) {
    pipeline.hdel("summary:ratings", reviewKey);
  } else {
    pipeline.hset("summary:ratings", {
      [reviewKey]: JSON.stringify({ sum: nextSum, count: nextCount }),
    });
  }
  pipeline.del(`review:lock:${reviewKey}:${uid}`);
  await pipeline.exec();

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
  if (!redis) {
    const store = getMemoryStore();
    const prev = store.itemPatches.get(itemId) ?? {};
    const merged: ItemPatch = { ...prev };
    for (const [k, v] of Object.entries(incoming) as [
      keyof ItemPatch,
      string | undefined,
    ][]) {
      if (v && !merged[k]) {
        merged[k] = v;
      }
    }
    store.itemPatches.set(itemId, merged);
    return merged;
  }

  const existingRaw = await redis.hget<unknown>("patch:items:all", itemId);
  const prev = parseJsonSafe<ItemPatch>(existingRaw) ?? {};

  const merged: ItemPatch = { ...prev };
  for (const [k, v] of Object.entries(incoming) as [
    keyof ItemPatch,
    string | undefined,
  ][]) {
    if (v && !merged[k]) {
      merged[k] = v;
    }
  }

  await redis.hset("patch:items:all", { [itemId]: JSON.stringify(merged) });
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
    await redis.hset("custom:items:all", { [id]: JSON.stringify(stored) });
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

  const raw = await redis.hget<unknown>("custom:items:all", itemId);
  const parsed = parseJsonSafe<StoredCustomItem>(raw);
  if (!parsed) return { deleted: false, reason: "not_found" };
  if (parsed.authorUid !== uid) return { deleted: false, reason: "forbidden" };

  await redis.hdel("custom:items:all", itemId);
  return { deleted: true };
}
