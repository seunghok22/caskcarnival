"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOTHS, getReviewKey, getSharedReviewItemIds } from "@/data/booths";
import type {
  BottleDynamicStatus,
  BottleItem,
  TastingItem,
} from "@/types/festival";
import { BoothMap } from "./BoothMap";
import { BoothDetail } from "./BoothDetail";
import { BottleModal } from "./BottleModal";

export type SelectedDetailItem =
  | { kind: "bottle"; item: BottleItem }
  | { kind: "tasting"; item: TastingItem };

const WANTED_STORAGE_KEY = "cask_wanted";
const REVIEWED_ITEMS_STORAGE_KEY = "cask_reviewed_items";

function parseTastingPrice(priceLabel: string): number {
  if (priceLabel.includes("무료")) return 0;
  const match = priceLabel.replace(/,/g, "").match(/(\d+)\s*원/);
  if (!match) return 0;
  return Number(match[1]);
}

const ITEM_PRICE_MAP: Record<string, number> = {};
for (const booth of BOOTHS) {
  for (const t of booth.tastings) {
    ITEM_PRICE_MAP[t.id] = parseTastingPrice(t.priceLabel);
  }
  for (const b of booth.bottles) {
    ITEM_PRICE_MAP[b.id] = b.price;
  }
}

export function FestivalApp() {
  const defaultBooth = BOOTHS.find((b) => b.code === "A02") ?? BOOTHS[0];
  const [selectedBoothId, setSelectedBoothId] = useState<string>(
    defaultBooth.id
  );
  const [selectedDetail, setSelectedDetail] =
    useState<SelectedDetailItem | null>(null);
  const [statuses, setStatuses] = useState<Record<string, BottleDynamicStatus>>(
    {}
  );
  const [wantedKeys, setWantedKeys] = useState<Set<string>>(() => new Set());
  const [reviewedItemMap, setReviewedItemMap] = useState<
    Record<string, string>
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
          setReviewedItemMap(parsed as Record<string, string>);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/bottles/status")
      .then((res) => res.json())
      .then((data) => {
        if (active && data.statuses) {
          setStatuses(data.statuses);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch bottle statuses:", err);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedBooth =
    BOOTHS.find((b) => b.id === selectedBoothId) ?? defaultBooth;

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

  function handleReviewSubmitted(itemId: string) {
    const rKey = getReviewKey(itemId);
    setReviewedItemMap((prev) => {
      const next = { ...prev, [rKey]: itemId };
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

  // 찜(wanted)한 제품의 가격합 (시음/보틀 각각 선택한 항목의 가격 합산)
  const wantedTotal = useMemo(() => {
    let sum = 0;
    for (const id of wantedKeys) {
      sum += ITEM_PRICE_MAP[id] ?? 0;
    }
    return sum;
  }, [wantedKeys]);

  // 평가한 제품의 가격합 (평가 작성 시 클릭한 항목 기준, 이전 기록은 reviewKey 기준 폴백)
  const reviewedTotal = useMemo(() => {
    const countedReviewKeys = new Set<string>();
    let sum = 0;

    for (const [itemId, st] of Object.entries(statuses)) {
      if (!st?.hasReviewed) continue;
      const rKey = getReviewKey(itemId);
      if (countedReviewKeys.has(rKey)) continue;
      countedReviewKeys.add(rKey);

      const chosenItemId = reviewedItemMap[rKey] ?? itemId;
      sum += ITEM_PRICE_MAP[chosenItemId] ?? 0;
    }

    return sum;
  }, [statuses, reviewedItemMap]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-900/30 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-amber-100">
            Cask Carnival
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
        booths={BOOTHS}
        selectedBoothId={selectedBooth.id}
        onSelectBooth={setSelectedBoothId}
        wantedKeys={wantedKeys}
      />

      {/* 2. 하단 부스 상세 & 번호순 전체 목록 */}
      <BoothDetail
        booths={BOOTHS}
        selectedBooth={selectedBooth}
        onSelectBooth={setSelectedBoothId}
        statuses={statuses}
        wantedKeys={wantedKeys}
        onToggleWanted={handleToggleWanted}
        onSelectBottle={(bottle) =>
          setSelectedDetail({ kind: "bottle", item: bottle })
        }
        onSelectTasting={(tasting) =>
          setSelectedDetail({ kind: "tasting", item: tasting })
        }
      />

      {/* 3. 시음/보틀 상세 / 평점 / 한줄평 / 매진 제안 모달 */}
      {selectedDetail && (
        <BottleModal
          detail={selectedDetail}
          status={statuses[selectedDetail.item.id]}
          isWanted={wantedKeys.has(selectedDetail.item.id)}
          onToggleWanted={() => handleToggleWanted(selectedDetail.item.id)}
          onReviewSubmitted={() =>
            handleReviewSubmitted(selectedDetail.item.id)
          }
          onReviewDeleted={() => handleReviewDeleted(selectedDetail.item.id)}
          onClose={() => setSelectedDetail(null)}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </main>
  );
}
