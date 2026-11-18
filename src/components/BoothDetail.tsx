"use client";

import { Wine, ShoppingBag, Star, AlertTriangle, ChevronRight } from "lucide-react";
import type { Booth, BottleDynamicStatus, BottleItem } from "@/types/festival";

interface BoothDetailProps {
  booths: Booth[];
  selectedBooth: Booth;
  onSelectBooth: (boothId: string) => void;
  statuses: Record<string, BottleDynamicStatus>;
  onSelectBottle: (bottle: BottleItem) => void;
}

export function BoothDetail({
  booths,
  selectedBooth,
  onSelectBooth,
  statuses,
  onSelectBottle,
}: BoothDetailProps) {
  return (
    <section className="rounded-2xl border border-amber-900/40 bg-[#181411] p-4 shadow-lg">
      {/* 부스 빠른 전환 탭 */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {booths.map((booth) => {
          const active = booth.id === selectedBooth.id;
          return (
            <button
              key={booth.id}
              type="button"
              onClick={() => onSelectBooth(booth.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-stone-800 bg-stone-900/70 text-stone-400 hover:border-stone-700 hover:text-stone-200"
              }`}
            >
              {booth.code} · {booth.name}
            </button>
          );
        })}
      </div>

      {/* 선택된 부스 헤더 */}
      <div className="mb-5 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
            {selectedBooth.code}
          </span>
          <span className="text-xs text-stone-400">{selectedBooth.category}</span>
        </div>
        <h3 className="mt-1.5 text-lg font-bold text-amber-50">
          {selectedBooth.name}
        </h3>
        <p className="mt-1 text-sm text-stone-400">{selectedBooth.description}</p>
      </div>

      {/* 시음 목록 */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
          <Wine className="h-4 w-4 text-amber-400" />
          <span>시음 목록 ({selectedBooth.tastings.length})</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {selectedBooth.tastings.map((tasting) => (
            <div
              key={tasting.id}
              className="rounded-xl border border-stone-800/90 bg-stone-900/50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-stone-100">{tasting.name}</div>
                <span className="shrink-0 rounded bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                  {tasting.priceLabel}
                </span>
              </div>
              <div className="mt-1 text-xs text-stone-400">
                ABV {tasting.abv} · {tasting.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 판매 보틀 목록 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <ShoppingBag className="h-4 w-4 text-amber-400" />
            <span>판매 보틀 목록 ({selectedBooth.bottles.length})</span>
          </div>
          <span className="text-[11px] text-stone-400">
            보틀 클릭 시 평점·한줄평·매진 제안 가능
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {selectedBooth.bottles.map((bottle) => {
            const st = statuses[bottle.id];
            const isSoldOut = st?.isSoldOut ?? false;
            const soldOutCount = st?.soldOutCount ?? 0;
            const ratingAvg = st?.ratingAvg ?? 0;
            const ratingCount = st?.ratingCount ?? 0;

            return (
              <button
                key={bottle.id}
                type="button"
                onClick={() => onSelectBottle(bottle)}
                className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                  isSoldOut
                    ? "border-rose-900/60 bg-rose-950/20 opacity-85 hover:border-rose-700"
                    : "border-stone-800 bg-stone-900/70 hover:border-amber-500/60 hover:bg-stone-900"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-stone-400">
                        {bottle.distillery} · {bottle.abv} · {bottle.volume}
                      </div>
                      <div className="mt-0.5 font-semibold text-stone-100 group-hover:text-amber-200">
                        {bottle.name}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-500 group-hover:text-amber-300" />
                  </div>

                  {bottle.note && (
                    <p className="mt-1.5 text-xs text-stone-400">{bottle.note}</p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800/80 pt-2.5">
                  <div className="text-sm font-bold text-amber-300">
                    {bottle.price.toLocaleString("ko-KR")}원
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {ratingCount > 0 ? `${ratingAvg} (${ratingCount})` : "평점 없음"}
                    </span>

                    {isSoldOut ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-rose-300">
                        <AlertTriangle className="h-3 w-3" />
                        매진 확정
                      </span>
                    ) : soldOutCount > 0 ? (
                      <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[11px] text-stone-300">
                        매진 제안 {soldOutCount}/20
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
