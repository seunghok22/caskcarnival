"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  BOOTHS,
  getReviewKey,
  getSharedReviewItemIds,
  normalizeItemName,
} from "@/data/booths";
import type {
  Booth,
  BottleDynamicStatus,
  BottleItem,
  CustomBoothItem,
  ItemPatch,
  TastingItem,
} from "@/types/festival";
import { BoothMap } from "./BoothMap";
import { BoothDetail } from "./BoothDetail";
import { BottleModal } from "./BottleModal";
import { AddItemModal } from "./AddItemModal";
import { MyReviewsModal } from "./MyReviewsModal";

export type SelectedDetailItem =
  | { kind: "bottle"; item: BottleItem }
  | { kind: "tasting"; item: TastingItem };

export interface ReviewedItemMeta {
  itemId: string;
  quantity: number;
}

const WANTED_STORAGE_KEY = "cask_wanted";
const REVIEWED_ITEMS_STORAGE_KEY = "cask_reviewed_items";

function parseTastingPrice(priceLabel: string): number {
  if (priceLabel.includes("무료")) return 0;
  const match = priceLabel.replace(/,/g, "").match(/(\d+)\s*원/);
  if (!match) return 0;
  return Number(match[1]);
}

function applyPatchToTasting(t: TastingItem, p?: ItemPatch): TastingItem {
  if (!p) return t;
  return {
    ...t,
    distillery: t.distillery || p.distillery,
    abv: t.abv && t.abv !== "-" ? t.abv : p.abv || t.abv,
    cask: t.cask || p.cask,
    age: t.age || p.age,
    vintage: t.vintage || p.vintage,
    peated: t.peated || p.peated,
    whiskybaseUrl: t.whiskybaseUrl || p.whiskybaseUrl,
    note: t.note && t.note !== "현장 시음" ? t.note : p.note || t.note,
    priceLabel:
      t.priceLabel && t.priceLabel !== "현장 문의"
        ? t.priceLabel
        : p.priceLabel || t.priceLabel,
  };
}

function applyPatchToBottle(b: BottleItem, p?: ItemPatch): BottleItem {
  if (!p) return b;
  return {
    ...b,
    distillery:
      b.distillery && b.distillery !== "-"
        ? b.distillery
        : p.distillery || b.distillery,
    abv: b.abv && b.abv !== "-" ? b.abv : p.abv || b.abv,
    cask: b.cask || p.cask,
    age: b.age || p.age,
    vintage: b.vintage || p.vintage,
    peated: b.peated || p.peated,
    whiskybaseUrl: b.whiskybaseUrl || p.whiskybaseUrl,
    note: b.note || p.note,
    price:
      b.price >= 0
        ? b.price
        : typeof p.price === "number" && p.price >= 0
        ? p.price
        : b.price,
  };
}

function getMergedPatch(
  itemId: string,
  reviewKey: string,
  patches: Record<string, ItemPatch>
): ItemPatch | undefined {
  const own = patches[itemId];
  const shared = reviewKey !== itemId ? patches[reviewKey] : undefined;
  if (!own && !shared) return undefined;
  if (!shared) return own;
  return {
    distillery: own?.distillery || shared.distillery,
    abv: own?.abv || shared.abv,
    cask: own?.cask || shared.cask,
    age: own?.age || shared.age,
    vintage: own?.vintage || shared.vintage,
    peated: own?.peated || shared.peated,
    whiskybaseUrl: own?.whiskybaseUrl || shared.whiskybaseUrl,
    note: own?.note || shared.note,
    price: own?.price,
    priceLabel: own?.priceLabel,
  };
}

export function FestivalApp() {
  const defaultBooth = BOOTHS.find((b) => b.code === "A02") ?? BOOTHS[0];
  const [selectedBoothId, setSelectedBoothId] = useState<string>(
    defaultBooth.id
  );
  const [selectedRef, setSelectedRef] = useState<{
    kind: "bottle" | "tasting";
    id: string;
  } | null>(null);
  const [addModalKind, setAddModalKind] = useState<
    "tasting" | "bottle" | null
  >(null);
  const [showMyReviews, setShowMyReviews] = useState(false);

  const [statuses, setStatuses] = useState<Record<string, BottleDynamicStatus>>(
    {}
  );
  const [patches, setPatches] = useState<Record<string, ItemPatch>>({});
  const [customItems, setCustomItems] = useState<CustomBoothItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [wantedKeys, setWantedKeys] = useState<Set<string>>(() => new Set());
  const [reviewedItemMap, setReviewedItemMap] = useState<
    Record<string, ReviewedItemMeta>
  >({});

  useEffect(() => {
    try {
      const savedWanted = localStorage.getItem(WANTED_STORAGE_KEY);
      if (savedWanted) {
        const parsed = JSON.parse(savedWanted);
        if (Array.isArray(parsed)) {
          setWantedKeys(new Set(parsed.filter((v) => typeof v === "string")));
        }
      }
      const savedReviewed = localStorage.getItem(REVIEWED_ITEMS_STORAGE_KEY);
      if (savedReviewed) {
        const parsed = JSON.parse(savedReviewed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const normalized: Record<string, ReviewedItemMeta> = {};
          for (const [k, v] of Object.entries(
            parsed as Record<string, unknown>
          )) {
            if (typeof v === "string") {
              normalized[k] = { itemId: v, quantity: 1 };
            } else if (
              v &&
              typeof v === "object" &&
              typeof (v as { itemId?: unknown }).itemId === "string"
            ) {
              const qty = Number((v as { quantity?: unknown }).quantity ?? 1);
              normalized[k] = {
                itemId: (v as { itemId: string }).itemId,
                quantity: Number.isFinite(qty) && qty >= 1 ? Math.floor(qty) : 1,
              };
            }
          }
          setReviewedItemMap(normalized);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  async function fetchDashboardData() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/bottles/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.statuses) setStatuses(data.statuses);
      if (data.patches) setPatches(data.patches);
      if (Array.isArray(data.customItems)) setCustomItems(data.customItems);
    } catch (err) {
      console.error("Failed to fetch bottle statuses:", err);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  // 정적 부스 데이터 + Redis 패치(빈 정보 보완) + 유저 제보 제품 병합
  const mergedBooths = useMemo<Booth[]>(() => {
    const customByBooth = new Map<string, CustomBoothItem[]>();
    for (const item of customItems) {
      const list = customByBooth.get(item.boothCode) ?? [];
      list.push(item);
      customByBooth.set(item.boothCode, list);
    }

    return BOOTHS.map((booth) => {
      const patchedTastings = booth.tastings.map((t) =>
        applyPatchToTasting(t, getMergedPatch(t.id, getReviewKey(t.id), patches))
      );
      const patchedBottles = booth.bottles.map((b) =>
        applyPatchToBottle(b, getMergedPatch(b.id, getReviewKey(b.id), patches))
      );

      const extras = customByBooth.get(booth.code) ?? [];
      for (const c of extras) {
        const effectiveKey = c.sharedReviewKey || c.id;
        const linkedPatch = getMergedPatch(c.id, effectiveKey, patches);

        if (c.kind === "tasting") {
          patchedTastings.push(
            applyPatchToTasting(
              {
                id: c.id,
                name: c.name,
                distillery: c.distillery,
                abv: c.abv || "-",
                note: c.note || c.distillery || "유저 제보 시음",
                priceLabel: c.priceLabel || "현장 문의",
                cask: c.cask,
                vintage: c.vintage,
                age: c.age,
                peated: c.peated,
                whiskybaseUrl: c.whiskybaseUrl,
                isUserContributed: true,
                isMine: c.isMine,
                sharedReviewKey: c.sharedReviewKey,
              },
              linkedPatch
            )
          );
        } else {
          patchedBottles.push(
            applyPatchToBottle(
              {
                id: c.id,
                name: c.name,
                distillery: c.distillery || "-",
                abv: c.abv || "-",
                volume: c.volume || "700ml",
                price: c.price ?? -1,
                note: c.note,
                cask: c.cask,
                vintage: c.vintage,
                age: c.age,
                peated: c.peated,
                whiskybaseUrl: c.whiskybaseUrl,
                isUserContributed: true,
                isMine: c.isMine,
                sharedReviewKey: c.sharedReviewKey,
              },
              linkedPatch
            )
          );
        }
      }

      return {
        ...booth,
        tastings: patchedTastings,
        bottles: patchedBottles,
      };
    });
  }, [patches, customItems]);

  const itemPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const booth of mergedBooths) {
      for (const t of booth.tastings) {
        map[t.id] = parseTastingPrice(t.priceLabel);
      }
      for (const b of booth.bottles) {
        map[b.id] = b.price > 0 ? b.price : 0;
      }
    }
    return map;
  }, [mergedBooths]);

  const selectedBooth =
    mergedBooths.find((b) => b.id === selectedBoothId) ?? mergedBooths[0];

  const selectedDetailInfo = useMemo<{
    detail: SelectedDetailItem;
    boothCode: string;
    hasOppositeListing: boolean;
    effectiveReviewKey: string;
  } | null>(() => {
    if (!selectedRef) return null;
    for (const booth of mergedBooths) {
      if (selectedRef.kind === "bottle") {
        const found = booth.bottles.find((b) => b.id === selectedRef.id);
        if (found) {
          const normName = normalizeItemName(found.name);
          const rKey = found.sharedReviewKey || getReviewKey(found.id);
          const hasOppositeListing = booth.tastings.some(
            (t) =>
              normalizeItemName(t.name) === normName ||
              (t.sharedReviewKey || getReviewKey(t.id)) === rKey
          );
          return {
            detail: { kind: "bottle", item: found },
            boothCode: booth.code,
            hasOppositeListing,
            effectiveReviewKey: rKey,
          };
        }
      } else {
        const found = booth.tastings.find((t) => t.id === selectedRef.id);
        if (found) {
          const normName = normalizeItemName(found.name);
          const rKey = found.sharedReviewKey || getReviewKey(found.id);
          const hasOppositeListing = booth.bottles.some(
            (b) =>
              normalizeItemName(b.name) === normName ||
              (b.sharedReviewKey || getReviewKey(b.id)) === rKey
          );
          return {
            detail: { kind: "tasting", item: found },
            boothCode: booth.code,
            hasOppositeListing,
            effectiveReviewKey: rKey,
          };
        }
      }
    }
    return null;
  }, [mergedBooths, selectedRef]);

  const selectedDetail = selectedDetailInfo?.detail ?? null;

  function handleToggleWanted(itemId: string) {
    setWantedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      try {
        localStorage.setItem(
          WANTED_STORAGE_KEY,
          JSON.stringify(Array.from(next))
        );
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  function handleReviewSubmitted(itemId: string, quantity: number) {
    const rKey = getDynamicReviewKey(itemId);
    const safeQty = Math.max(1, Math.min(99, Math.floor(quantity) || 1));
    setReviewedItemMap((prev) => {
      const next = { ...prev, [rKey]: { itemId, quantity: safeQty } };
      try {
        localStorage.setItem(REVIEWED_ITEMS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  function handleReviewDeleted(itemId: string) {
    const rKey = getDynamicReviewKey(itemId);
    setReviewedItemMap((prev) => {
      const next = { ...prev };
      delete next[rKey];
      try {
        localStorage.setItem(REVIEWED_ITEMS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }

  function getDynamicReviewKey(itemId: string): string {
    const custom = customItems.find((c) => c.id === itemId);
    if (custom?.sharedReviewKey) return custom.sharedReviewKey;
    return getReviewKey(itemId);
  }

  function getDynamicSharedIds(itemId: string): string[] {
    const rKey = getDynamicReviewKey(itemId);
    const ids = new Set<string>(getSharedReviewItemIds(rKey));
    ids.add(itemId);
    for (const c of customItems) {
      if ((c.sharedReviewKey || c.id) === rKey) {
        ids.add(c.id);
      }
    }
    return Array.from(ids);
  }

  function handleStatusUpdated(updated: BottleDynamicStatus) {
    const sharedIds = getDynamicSharedIds(updated.bottleId);
    setStatuses((prev) => {
      const next: Record<string, BottleDynamicStatus> = {
        ...prev,
        [updated.bottleId]: updated,
      };
      for (const siblingId of sharedIds) {
        if (siblingId === updated.bottleId) continue;
        const existing = prev[siblingId];
        next[siblingId] = {
          bottleId: siblingId,
          soldOutCount: existing?.soldOutCount ?? 0,
          isSoldOut: existing?.isSoldOut ?? false,
          hasVotedSoldOut: existing?.hasVotedSoldOut ?? false,
          ratingAvg: updated.ratingAvg,
          ratingCount: updated.ratingCount,
          reviews: updated.reviews,
          hasReviewed: updated.hasReviewed,
        };
      }
      return next;
    });
  }

  function handlePatchApplied(itemId: string, savedPatch: ItemPatch) {
    const sharedIds = getDynamicSharedIds(itemId);
    const { price: _p, priceLabel: _pl, ...sharedSpecs } = savedPatch;
    void _p;
    void _pl;
    setPatches((prev) => {
      const next = { ...prev, [itemId]: savedPatch };
      for (const siblingId of sharedIds) {
        if (siblingId === itemId) continue;
        next[siblingId] = { ...prev[siblingId], ...sharedSpecs };
      }
      return next;
    });
  }

  function handleCustomItemAdded(created: CustomBoothItem) {
    setCustomItems((prev) => [...prev, created]);
    // 기존 항목과 연결되어 추가된 경우 평점·한줄평 상태를 즉시 동기화
    if (created.sharedReviewKey) {
      const sourceStatus = statuses[created.sharedReviewKey];
      if (sourceStatus) {
        setStatuses((prev) => ({
          ...prev,
          [created.id]: {
            bottleId: created.id,
            soldOutCount: 0,
            isSoldOut: false,
            hasVotedSoldOut: false,
            ratingAvg: sourceStatus.ratingAvg,
            ratingCount: sourceStatus.ratingCount,
            reviews: sourceStatus.reviews,
            hasReviewed: sourceStatus.hasReviewed,
          },
        }));
      }
    }
  }

  function handleCustomItemDeleted(itemId: string) {
    setCustomItems((prev) => prev.filter((c) => c.id !== itemId));
    setSelectedRef(null);
  }

  const wantedTotal = useMemo(() => {
    let sum = 0;
    for (const id of wantedKeys) {
      sum += itemPriceMap[id] ?? 0;
    }
    return sum;
  }, [wantedKeys, itemPriceMap]);

  const reviewedTotal = useMemo(() => {
    const customKeyMap = new Map<string, string>();
    for (const c of customItems) {
      if (c.sharedReviewKey) customKeyMap.set(c.id, c.sharedReviewKey);
    }

    const countedReviewKeys = new Set<string>();
    let sum = 0;

    for (const [itemId, st] of Object.entries(statuses)) {
      if (!st?.hasReviewed) continue;
      const rKey = customKeyMap.get(itemId) ?? getReviewKey(itemId);
      if (countedReviewKeys.has(rKey)) continue;
      countedReviewKeys.add(rKey);

      const meta = reviewedItemMap[rKey];
      const chosenItemId = meta?.itemId ?? itemId;
      const qty = meta?.quantity ?? 1;
      sum += (itemPriceMap[chosenItemId] ?? 0) * qty;
    }

    return sum;
  }, [statuses, reviewedItemMap, itemPriceMap, customItems]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/30 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-amber-100">
            Cask Carnival
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowMyReviews(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900/90 px-3 py-1.5 font-semibold text-stone-200 transition hover:border-amber-400 hover:text-amber-200"
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>내 평가 보기</span>
          </button>
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
            <span className="text-stone-300">찜 합계</span>
            <span className="font-bold text-amber-300">
              {wantedTotal.toLocaleString("ko-KR")}원
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900/80 px-3 py-1.5">
            <span className="text-stone-300">평가 합계</span>
            <span className="font-bold text-emerald-300">
              {reviewedTotal.toLocaleString("ko-KR")}원
            </span>
          </div>
        </div>
      </header>

      {/* 1. 상단 부스 지도 */}
      <BoothMap
        booths={mergedBooths}
        selectedBoothId={selectedBooth.id}
        onSelectBooth={setSelectedBoothId}
        wantedKeys={wantedKeys}
        onRefresh={fetchDashboardData}
        refreshing={refreshing}
      />

      {/* 2. 하단 부스 상세 & 번호순 전체 목록 */}
      <BoothDetail
        booths={mergedBooths}
        selectedBooth={selectedBooth}
        onSelectBooth={setSelectedBoothId}
        statuses={statuses}
        wantedKeys={wantedKeys}
        onToggleWanted={handleToggleWanted}
        onOpenAddItem={(kind) => setAddModalKind(kind)}
        onSelectBottle={(bottle) =>
          setSelectedRef({ kind: "bottle", id: bottle.id })
        }
        onSelectTasting={(tasting) =>
          setSelectedRef({ kind: "tasting", id: tasting.id })
        }
      />

      {/* 3. 시음/보틀 상세 / 빈 정보 채우기 / 반대 목록 추가 / 평점 / 한줄평 / 매진 제안 모달 */}
      {selectedDetail && selectedDetailInfo && (
        <BottleModal
          detail={selectedDetail}
          boothCode={selectedDetailInfo.boothCode}
          hasOppositeListing={selectedDetailInfo.hasOppositeListing}
          effectiveReviewKey={selectedDetailInfo.effectiveReviewKey}
          status={statuses[selectedDetail.item.id]}
          isWanted={wantedKeys.has(selectedDetail.item.id)}
          onToggleWanted={() => handleToggleWanted(selectedDetail.item.id)}
          onReviewSubmitted={(quantity) =>
            handleReviewSubmitted(selectedDetail.item.id, quantity)
          }
          onReviewDeleted={() => handleReviewDeleted(selectedDetail.item.id)}
          onPatchApplied={handlePatchApplied}
          onOppositeItemAdded={handleCustomItemAdded}
          onCustomItemDeleted={handleCustomItemDeleted}
          onClose={() => setSelectedRef(null)}
          onStatusUpdated={handleStatusUpdated}
        />
      )}

      {/* 4. 새 제품 제보 / 추가 모달 */}
      {addModalKind && (
        <AddItemModal
          booth={selectedBooth}
          defaultKind={addModalKind}
          onClose={() => setAddModalKind(null)}
          onItemAdded={handleCustomItemAdded}
        />
      )}

      {/* 5. 내 평가 모아보기 모달 */}
      {showMyReviews && (
        <MyReviewsModal
          booths={mergedBooths}
          reviewedItemMap={reviewedItemMap}
          onSelectEntry={(boothId, kind, itemId) => {
            setSelectedBoothId(boothId);
            setSelectedRef({ kind, id: itemId });
          }}
          onClose={() => setShowMyReviews(false)}
        />
      )}
    </main>
  );
}
