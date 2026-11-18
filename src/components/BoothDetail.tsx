"use client";

import { useState } from "react";
import {
  Wine,
  ShoppingBag,
  Star,
  AlertTriangle,
  ChevronRight,
  ListFilter,
} from "lucide-react";
import type {
  Booth,
  BottleDynamicStatus,
  BottleItem,
  TastingItem,
} from "@/types/festival";

interface BoothDetailProps {
  booths: Booth[];
  selectedBooth: Booth;
  onSelectBooth: (boothId: string) => void;
  statuses: Record<string, BottleDynamicStatus>;
  onSelectBottle: (bottle: BottleItem) => void;
  onSelectTasting: (tasting: TastingItem) => void;
}

export function BoothDetail({
  booths,
  selectedBooth,
  onSelectBooth,
  statuses,
  onSelectBottle,
  onSelectTasting,
}: BoothDetailProps) {
  const [showFullDirectory, setShowFullDirectory] = useState(true);

  return (
    <div className="flex flex-col gap-5">
      {/* 선택된 부스 상세 (시음 목록 + 판매 보틀 목록) */}
      <section className="rounded-2xl border border-amber-900/40 bg-[#181411] p-4 shadow-lg">
        {/* 선택된 부스 헤더 */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-stone-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#8b303e] px-2.5 py-0.5 text-xs font-extrabold text-white">
                {selectedBooth.code}
              </span>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                {selectedBooth.category}
              </span>
            </div>
            <h3 className="mt-2 text-lg font-bold text-amber-50">
              {selectedBooth.name}
            </h3>
            <p className="text-xs font-medium text-stone-400">
              {selectedBooth.nameEn}
            </p>
            <p className="mt-1.5 text-sm text-stone-300">
              {selectedBooth.description}
            </p>
          </div>
        </div>

        {/* 1. 시음 목록 */}
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <Wine className="h-4 w-4 text-amber-400" />
              <span>시음 목록 ({selectedBooth.tastings.length})</span>
            </div>
            <span className="text-[11px] text-amber-300/90">
              항목을 클릭하면 상세 정보 및 평점·한줄평을 남길 수 있습니다
            </span>
          </div>

          {selectedBooth.tastings.length === 0 ? (
            <div className="rounded-xl border border-stone-800/70 bg-stone-900/40 p-4 text-center text-xs text-stone-400">
              등록된 시음 목록이 없습니다.
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {selectedBooth.tastings.map((tasting) => {
                const st = statuses[tasting.id];
                const isSoldOut = st?.isSoldOut ?? false;
                const soldOutCount = st?.soldOutCount ?? 0;
                const ratingAvg = st?.ratingAvg ?? 0;
                const ratingCount = st?.ratingCount ?? 0;

                return (
                  <button
                    key={tasting.id}
                    type="button"
                    onClick={() => onSelectTasting(tasting)}
                    className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                      isSoldOut
                        ? "border-rose-900/60 bg-rose-950/20 opacity-85 hover:border-rose-700"
                        : "border-stone-800/90 bg-stone-900/50 hover:border-amber-500/60 hover:bg-stone-900"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-stone-100 group-hover:text-amber-200">
                          {tasting.name}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-stone-500 group-hover:text-amber-300" />
                      </div>
                      <div className="mt-1 text-xs text-stone-400">
                        {tasting.abv !== "-" ? `ABV ${tasting.abv} · ` : ""}
                        {tasting.note}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800/80 pt-2.5">
                      <span className="rounded bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                        {tasting.priceLabel}
                      </span>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {ratingCount > 0
                            ? `${ratingAvg} (${ratingCount})`
                            : "평점 없음"}
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
          )}
        </div>

        {/* 2. 판매 보틀 목록 */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <ShoppingBag className="h-4 w-4 text-amber-400" />
              <span>판매 보틀 목록 ({selectedBooth.bottles.length})</span>
            </div>
            <span className="text-[11px] text-amber-300/90">
              보틀을 클릭하면 평점·한줄평 등록 및 매진 제안이 가능합니다
            </span>
          </div>

          {selectedBooth.bottles.length === 0 ? (
            <div className="rounded-xl border border-stone-800/70 bg-stone-900/40 p-4 text-center text-xs text-stone-400">
              등록된 판매 보틀 목록이 없습니다.
            </div>
          ) : (
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
                            {bottle.distillery}
                            {bottle.abv !== "-" ? ` · ${bottle.abv}` : ""}
                            {bottle.volume ? ` · ${bottle.volume}` : ""}
                          </div>
                          <div className="mt-0.5 font-semibold text-stone-100 group-hover:text-amber-200">
                            {bottle.name}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-stone-500 group-hover:text-amber-300" />
                      </div>

                      {bottle.note && (
                        <p className="mt-1.5 text-xs text-stone-400">
                          {bottle.note}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-800/80 pt-2.5">
                      <div className="text-sm font-bold text-amber-300">
                        {bottle.price.toLocaleString("ko-KR")}원
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {ratingCount > 0
                            ? `${ratingAvg} (${ratingCount})`
                            : "평점 없음"}
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
          )}
        </div>
      </section>

      {/* 하단 전체 부스 번호순 디렉토리 (이미지 하단 부스 번호순과 동일) */}
      <section className="rounded-2xl border border-amber-900/40 bg-[#181411] p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-100">
              부스 번호순 전체 목록 ({booths.length}개)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowFullDirectory((v) => !v)}
            className="text-xs font-medium text-amber-300 hover:underline"
          >
            {showFullDirectory ? "접기" : "펼치기"}
          </button>
        </div>

        {showFullDirectory && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {booths.map((booth) => {
              const active = booth.id === selectedBooth.id;
              const soldOutBottles = booth.bottles.filter(
                (b) => statuses[b.id]?.isSoldOut
              ).length;

              return (
                <button
                  key={booth.id}
                  type="button"
                  onClick={() => {
                    onSelectBooth(booth.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition ${
                    active
                      ? "border-amber-400 bg-amber-500/15"
                      : "border-stone-800/80 bg-stone-900/50 hover:border-stone-700 hover:bg-stone-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-extrabold ${
                        active ? "text-amber-300" : "text-[#d46a78]"
                      }`}
                    >
                      {booth.code}
                    </span>
                    {soldOutBottles > 0 && (
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                        매진 {soldOutBottles}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs font-bold text-stone-100">
                    {booth.name}
                  </div>
                  <div className="truncate text-[10px] text-stone-400">
                    {booth.nameEn}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
