"use client";

import { useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { BOOTHS, getReviewKey, getSharedReviewItemIds } from "@/data/booths";
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
    whiskybaseUrl: t.whiskybaseUrl || p.whiskybaseUrl,
    note: t.note && t.note !== "현장 시음" ? t.note : p.note || t.note,
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
    whiskybaseUrl: b.whiskybaseUrl || p.whiskybaseUrl,
    note: b.note || p.note,
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
        applyPatchToTasting(t, patches[t.id])
      );
      const patchedBottles = booth.bottles.map((b) =>
        applyPatchToBottle(b, patches[b.id])
      );

      const extras = customByBooth.get(booth.code) ?? [];
      for (const c of extras) {
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
                whiskybaseUrl: c.whiskybaseUrl,
                isUserContributed: true,
                isMine: c.isMine,
              },
              patches[c.id]
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
                price: c.price ?? 0,
                note: c.note,
                cask: c.cask,
                vintage: c.vintage,
                age: c.age,
                whiskybaseUrl: c.whiskybaseUrl,
                isUserContributed: true,
                isMine: c.isMine,
              },
              patches[c.id]
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
        map[b.id] = b.price;
      }
    }
    return map;
  }, [mergedBooths]);

  const selectedBooth =
    mergedBooths.find((b) => b.id === selectedBoothId) ?? mergedBooths[0];

  const selectedDetail = useMemo<SelectedDetailItem | null>(() => {
    if (!selectedRef) return null;
    for (const booth of mergedBooths) {
      if (selectedRef.kind === "bottle") {
        const found = booth.bottles.find((b) => b.id === selectedRef.id);
        if (found) return { kind: "bottle", item: found };
      } else {
        const found = booth.tastings.find((t) => t.id === selectedRef.id);
        if (found) return { kind: "tasting", item: found };
      }
    }
    return null;
  }, [mergedBooths, selectedRef]);

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
    const rKey = getReviewKey(itemId);
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
    const rKey = getReviewKey(itemId);
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

  function handleStatusUpdated(updated: BottleDynamicStatus) {
    const sharedIds = getSharedReviewItemIds(updated.bottleId);
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
    setPatches((prev) => ({
      ...prev,
      [itemId]: savedPatch,
    }));
  }

  function handleCustomItemAdded(created: CustomBoothItem) {
    setCustomItems((prev) => [...prev, created]);
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
    const countedReviewKeys = new Set<string>();
    let sum = 0;

    for (const [itemId, st] of Object.entries(statuses)) {
      if (!st?.hasReviewed) continue;
      const rKey = getReviewKey(itemId);
      if (countedReviewKeys.has(rKey)) continue;
      countedReviewKeys.add(rKey);

      const meta = reviewedItemMap[rKey];
      const chosenItemId = meta?.itemId ?? itemId;
      const qty = meta?.quantity ?? 1;
      sum += (itemPriceMap[chosenItemId] ?? 0) * qty;
    }

    return sum;
  }, [statuses, reviewedItemMap, itemPriceMap]);

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

      {/* 3. 시음/보틀 상세 / 빈 정보 채우기 / 평점 / 한줄평 / 매진 제안 모달 */}
      {selectedDetail && (
        <BottleModal
          detail={selectedDetail}
          status={statuses[selectedDetail.item.id]}
          isWanted={wantedKeys.has(selectedDetail.item.id)}
          onToggleWanted={() => handleToggleWanted(selectedDetail.item.id)}
          onReviewSubmitted={(quantity) =>
            handleReviewSubmitted(selectedDetail.item.id, quantity)
          }
          onReviewDeleted={() => handleReviewDeleted(selectedDetail.item.id)}
          onPatchApplied={handlePatchApplied}
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
