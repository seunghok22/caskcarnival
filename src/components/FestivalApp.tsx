"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WANTED_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setWantedKeys(new Set(parsed.filter((v) => typeof v === "string")));
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
    const key = getReviewKey(itemId);
    setWantedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between border-b border-amber-900/30 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-amber-100">
            Cask Carnival
          </h1>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          LIVE
        </span>
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
          isWanted={wantedKeys.has(getReviewKey(selectedDetail.item.id))}
          onToggleWanted={() => handleToggleWanted(selectedDetail.item.id)}
          onClose={() => setSelectedDetail(null)}
          onStatusUpdated={handleStatusUpdated}
        />
      )}
    </main>
  );
}
