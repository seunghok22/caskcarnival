"use client";

import { useEffect, useState } from "react";
import {
  Wine,
  ShoppingBag,
  Star,
  AlertTriangle,
  ChevronRight,
  ListFilter,
  Bookmark,
} from "lucide-react";
import { getReviewKey } from "@/data/booths";
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
  wantedKeys: Set<string>;
  onToggleWanted: (itemId: string) => void;
  onSelectBottle: (bottle: BottleItem) => void;
  onSelectTasting: (tasting: TastingItem) => void;
}

export function BoothDetail({
  booths,
  selectedBooth,
  onSelectBooth,
  statuses,
  wantedKeys,
  onToggleWanted,
  onSelectBottle,
  onSelectTasting,
}: BoothDetailProps) {
  const [activeTab, setActiveTab] = useState<"tasting" | "bottle">(
    selectedBooth.tastings.length === 0 && selectedBooth.bottles.length > 0
      ? "bottle"
      : "tasting"
  );
  const [showFullDirectory, setShowFullDirectory] = useState(true);

  useEffect(() => {
    if (selectedBooth.tastings.length === 0 && selectedBooth.bottles.length > 0) {
      setActiveTab("bottle");
    } else {
      setActiveTab("tasting");
    }
  }, [selectedBooth.id, selectedBooth.tastings.length, selectedBooth.bottles.length]);

  return (
    <div className="flex flex-col gap-5">
      {/* 선택된 부스 상세 (탭 분리 + 컴팩트 리스트형) */}
      <section className="rounded-2xl border border-amber-900/40 bg-[#181411] p-4 shadow-lg">
        {/* 선택된 부스 헤더 */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-stone-800 pb-4">
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
          </div>
        </div>

        {/* 1. 시음 / 판매 보틀 탭 */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:inline-flex">
            <button
              type="button"
              onClick={() => setActiveTab("tasting")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                activeTab === "tasting"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700 hover:text-stone-200"
              }`}
            >
              <Wine className="h-3.5 w-3.5" />
              <span>시음 목록 ({selectedBooth.tastings.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bottle")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                activeTab === "bottle"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-stone-800 bg-stone-900/60 text-stone-400 hover:border-stone-700 hover:text-stone-200"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>판매 보틀 ({selectedBooth.bottles.length})</span>
            </button>
          </div>

          <span className="hidden text-[11px] text-stone-400 sm:inline">
            항목 클릭 시 상세 정보·평점·매진 제안 가능
          </span>
        </div>

        {/* 2. 컴팩트 리스트형 (시음 목록 탭) */}
        {activeTab === "tasting" &&
          (selectedBooth.tastings.length === 0 ? (
            <div className="rounded-xl border border-stone-800/70 bg-stone-900/40 p-5 text-center text-xs text-stone-400">
              등록된 시음 목록이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-stone-800/80 overflow-hidden rounded-xl border border-stone-800 bg-stone-900/40">
              {selectedBooth.tastings.map((tasting) => {
                const st = statuses[tasting.id];
                const isSoldOut = st?.isSoldOut ?? false;
                const soldOutCount = st?.soldOutCount ?? 0;
                const ratingAvg = st?.ratingAvg ?? 0;
                const ratingCount = st?.ratingCount ?? 0;
                const isWanted = wantedKeys.has(getReviewKey(tasting.id));

                return (
                  <div
                    key={tasting.id}
                    className={`flex items-center gap-2 px-3 py-2.5 transition ${
                      isSoldOut
                        ? "bg-rose-950/20 hover:bg-rose-950/35"
                        : "hover:bg-stone-800/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleWanted(tasting.id)}
                      aria-label="wanted"
                      title="wanted"
                      className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-amber-300"
                    >
                      <Bookmark
                        className={`h-4 w-4 ${
                          isWanted
                            ? "fill-amber-400 text-amber-400"
                            : "text-stone-500"
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectTasting(tasting)}
                      className="group flex min-w-0 flex-1 flex-col gap-1 text-left"
                    >
                      {/* 1행: 보틀명 + 가격 + 화살표 */}
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`truncate text-sm font-medium ${
                            isSoldOut
                              ? "text-stone-400 line-through"
                              : "text-stone-100 group-hover:text-amber-200"
                          }`}
                        >
                          {tasting.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded bg-stone-800/90 px-2 py-0.5 text-xs font-semibold text-amber-300">
                            {tasting.priceLabel}
                          </span>
                          <ChevronRight className="h-4 w-4 text-stone-500 group-hover:text-amber-300" />
                        </div>
                      </div>

                      {/* 2행: 도수/메타 + 평점 + 매진 배지 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
                        <div className="flex items-center gap-2 truncate">
                          {tasting.abv !== "-" && <span>ABV {tasting.abv}</span>}
                          {tasting.age && <span>· {tasting.age}</span>}
                          <span className="inline-flex items-center gap-1 text-amber-300/90">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {ratingCount > 0
                              ? `${ratingAvg} (${ratingCount})`
                              : "평점 없음"}
                          </span>
                        </div>

                        {isSoldOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            매진 확정
                          </span>
                        ) : soldOutCount > 0 ? (
                          <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[10px] text-stone-300">
                            매진 제안 {soldOutCount}/20
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

        {/* 2. 컴팩트 리스트형 (판매 보틀 탭) */}
        {activeTab === "bottle" &&
          (selectedBooth.bottles.length === 0 ? (
            <div className="rounded-xl border border-stone-800/70 bg-stone-900/40 p-5 text-center text-xs text-stone-400">
              등록된 판매 보틀 목록이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-stone-800/80 overflow-hidden rounded-xl border border-stone-800 bg-stone-900/40">
              {selectedBooth.bottles.map((bottle) => {
                const st = statuses[bottle.id];
                const isSoldOut = st?.isSoldOut ?? false;
                const soldOutCount = st?.soldOutCount ?? 0;
                const ratingAvg = st?.ratingAvg ?? 0;
                const ratingCount = st?.ratingCount ?? 0;
                const isWanted = wantedKeys.has(getReviewKey(bottle.id));

                return (
                  <div
                    key={bottle.id}
                    className={`flex items-center gap-2 px-3 py-2.5 transition ${
                      isSoldOut
                        ? "bg-rose-950/20 hover:bg-rose-950/35"
                        : "hover:bg-stone-800/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleWanted(bottle.id)}
                      aria-label="wanted"
                      title="wanted"
                      className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-amber-300"
                    >
                      <Bookmark
                        className={`h-4 w-4 ${
                          isWanted
                            ? "fill-amber-400 text-amber-400"
                            : "text-stone-500"
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectBottle(bottle)}
                      className="group flex min-w-0 flex-1 flex-col gap-1 text-left"
                    >
                      {/* 1행: 보틀명 + 가격 + 화살표 */}
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`truncate text-sm font-medium ${
                            isSoldOut
                              ? "text-stone-400 line-through"
                              : "text-stone-100 group-hover:text-amber-200"
                          }`}
                        >
                          {bottle.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-sm font-bold text-amber-300">
                            {bottle.price.toLocaleString("ko-KR")}원
                          </span>
                          <ChevronRight className="h-4 w-4 text-stone-500 group-hover:text-amber-300" />
                        </div>
                      </div>

                      {/* 2행: 증류소/도수/숙성 + 평점 + 매진 배지 */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
                        <div className="flex items-center gap-1.5 truncate">
                          {bottle.distillery && bottle.distillery !== "-" && (
                            <span>{bottle.distillery}</span>
                          )}
                          {bottle.abv !== "-" && <span>· {bottle.abv}</span>}
                          {bottle.age && <span>· {bottle.age}</span>}
                          <span className="inline-flex items-center gap-1 text-amber-300/90">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {ratingCount > 0
                              ? `${ratingAvg} (${ratingCount})`
                              : "평점 없음"}
                          </span>
                        </div>

                        {isSoldOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            매진 확정
                          </span>
                        ) : soldOutCount > 0 ? (
                          <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[10px] text-stone-300">
                            매진 제안 {soldOutCount}/20
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
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
