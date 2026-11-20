"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wine,
  ShoppingBag,
  Star,
  AlertTriangle,
  ChevronRight,
  ListFilter,
  Bookmark,
  Plus,
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
  wantedKeys: Set<string>;
  onToggleWanted: (itemId: string) => void;
  onOpenAddItem: (kind: "tasting" | "bottle") => void;
  onSelectBottle: (bottle: BottleItem) => void;
  onSelectTasting: (tasting: TastingItem) => void;
}

type AllBottleSort =
  | "default"
  | "rating_desc"
  | "rating_asc"
  | "price_asc"
  | "price_desc";

interface UnifiedEntry {
  key: string;
  kind: "tasting" | "bottle";
  booth: Booth;
  item: TastingItem | BottleItem;
  distillery: string | null;
  numericPrice: number | null;
  priceDisplay: string;
}

function parseTastingPrice(priceLabel: string): number | null {
  if (priceLabel.includes("무료")) return 0;
  const match = priceLabel.replace(/,/g, "").match(/(\d+)\s*원/);
  if (!match) return null;
  return Number(match[1]);
}

export function BoothDetail({
  booths,
  selectedBooth,
  onSelectBooth,
  statuses,
  wantedKeys,
  onToggleWanted,
  onOpenAddItem,
  onSelectBottle,
  onSelectTasting,
}: BoothDetailProps) {
  const [activeTab, setActiveTab] = useState<"tasting" | "bottle">(
    selectedBooth.tastings.length === 0 && selectedBooth.bottles.length > 0
      ? "bottle"
      : "tasting"
  );
  const [showFullDirectory, setShowFullDirectory] = useState(true);
  const [directoryView, setDirectoryView] = useState<"booths" | "bottles">(
    "booths"
  );
  const [excludeSoldOut, setExcludeSoldOut] = useState(false);
  const [selectedDistillery, setSelectedDistillery] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<AllBottleSort>("default");

  const allEntries = useMemo<UnifiedEntry[]>(() => {
    const list: UnifiedEntry[] = [];
    for (const booth of booths) {
      for (const tasting of booth.tastings) {
        list.push({
          key: `t-${tasting.id}`,
          kind: "tasting",
          booth,
          item: tasting,
          distillery: tasting.distillery?.trim() || null,
          numericPrice: parseTastingPrice(tasting.priceLabel),
          priceDisplay: tasting.priceLabel,
        });
      }
      for (const bottle of booth.bottles) {
        const dist =
          bottle.distillery && bottle.distillery !== "-"
            ? bottle.distillery.trim()
            : null;
        list.push({
          key: `b-${bottle.id}`,
          kind: "bottle",
          booth,
          item: bottle,
          distillery: dist,
          numericPrice: bottle.price,
          priceDisplay: `${bottle.price.toLocaleString("ko-KR")}원`,
        });
      }
    }
    return list;
  }, [booths]);

  const distilleries = useMemo(() => {
    const set = new Set<string>();
    for (const entry of allEntries) {
      if (entry.distillery) set.add(entry.distillery);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [allEntries]);

  const filteredEntries = useMemo(() => {
    const filtered = allEntries.filter((entry) => {
      if (excludeSoldOut && statuses[entry.item.id]?.isSoldOut) {
        return false;
      }
      if (
        selectedDistillery !== "ALL" &&
        entry.distillery !== selectedDistillery
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === "default") return filtered;

    return [...filtered].sort((a, b) => {
      if (sortBy === "rating_desc" || sortBy === "rating_asc") {
        const stA = statuses[a.item.id];
        const stB = statuses[b.item.id];
        const hasA = (stA?.ratingCount ?? 0) > 0;
        const hasB = (stB?.ratingCount ?? 0) > 0;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        const diff = (stA?.ratingAvg ?? 0) - (stB?.ratingAvg ?? 0);
        return sortBy === "rating_desc" ? -diff : diff;
      }

      if (sortBy === "price_asc" || sortBy === "price_desc") {
        const pA = a.numericPrice;
        const pB = b.numericPrice;
        if (pA === null && pB === null) return 0;
        if (pA === null) return 1;
        if (pB === null) return -1;
        const diff = pA - pB;
        return sortBy === "price_desc" ? -diff : diff;
      }

      return 0;
    });
  }, [allEntries, excludeSoldOut, selectedDistillery, sortBy, statuses]);

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

        {/* 1. 시음 / 판매 보틀 탭 + 제품 추가 버튼 */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

          <button
            type="button"
            onClick={() => onOpenAddItem(activeTab)}
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20 sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>제품 추가</span>
          </button>
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
                const isWanted = wantedKeys.has(tasting.id);

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
                        <div className="flex min-w-0 items-center gap-1.5">
                          {tasting.isUserContributed && (
                            <span className="shrink-0 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                              제보
                            </span>
                          )}
                          <span
                            className={`truncate text-sm font-medium ${
                              isSoldOut
                                ? "text-stone-400 line-through"
                                : "text-stone-100 group-hover:text-amber-200"
                            }`}
                          >
                            {tasting.name}
                          </span>
                        </div>
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
                const isWanted = wantedKeys.has(bottle.id);

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
                        <div className="flex min-w-0 items-center gap-1.5">
                          {bottle.isUserContributed && (
                            <span className="shrink-0 rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                              제보
                            </span>
                          )}
                          <span
                            className={`truncate text-sm font-medium ${
                              isSoldOut
                                ? "text-stone-400 line-through"
                                : "text-stone-100 group-hover:text-amber-200"
                            }`}
                          >
                            {bottle.name}
                          </span>
                        </div>
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

      {/* 하단 전체 부스 번호순 디렉토리 / 전체 보틀 목록 */}
      <section className="rounded-2xl border border-amber-900/40 bg-[#181411] p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-100">
              {directoryView === "booths"
                ? `부스 번호순 전체 목록 (${booths.length}개)`
                : `전체 보틀 목록 (${filteredEntries.length}개)`}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-stone-800 bg-stone-900/80 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setDirectoryView("booths");
                  setShowFullDirectory(true);
                }}
                className={`rounded-md px-2.5 py-1 transition ${
                  directoryView === "booths"
                    ? "bg-amber-500/20 text-amber-200"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                부스 목록
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectoryView("bottles");
                  setShowFullDirectory(true);
                }}
                className={`rounded-md px-2.5 py-1 transition ${
                  directoryView === "bottles"
                    ? "bg-amber-500/20 text-amber-200"
                    : "text-stone-400 hover:text-stone-200"
                }`}
              >
                전체 보틀
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowFullDirectory((v) => !v)}
              className="text-xs font-medium text-amber-300 hover:underline"
            >
              {showFullDirectory ? "접기" : "펼치기"}
            </button>
          </div>
        </div>

        {showFullDirectory && directoryView === "booths" && (
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

        {showFullDirectory && directoryView === "bottles" && (
          <div className="mt-3 flex flex-col gap-3">
            {/* 필터 & 정렬 바 */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExcludeSoldOut((v) => !v)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  excludeSoldOut
                    ? "border-amber-400 bg-amber-500/20 text-amber-200"
                    : "border-stone-700 bg-stone-900/80 text-stone-300 hover:border-stone-600"
                }`}
              >
                매진 제외
              </button>

              <select
                value={selectedDistillery}
                onChange={(e) => setSelectedDistillery(e.target.value)}
                aria-label="증류소 필터"
                className="rounded-xl border border-stone-700 bg-stone-900/90 px-3 py-1.5 text-xs font-medium text-stone-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="ALL">증류소: 전체</option>
                {distilleries.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as AllBottleSort)}
                aria-label="정렬 기준"
                className="rounded-xl border border-stone-700 bg-stone-900/90 px-3 py-1.5 text-xs font-medium text-stone-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="default">정렬: 기본순</option>
                <option value="rating_desc">평점 높은순</option>
                <option value="rating_asc">평점 낮은순</option>
                <option value="price_asc">가격 낮은순</option>
                <option value="price_desc">가격 높은순</option>
              </select>
            </div>

            {/* 전체 보틀 슬림 리스트 */}
            {filteredEntries.length === 0 ? (
              <div className="rounded-xl border border-stone-800/70 bg-stone-900/40 p-5 text-center text-xs text-stone-400">
                조건에 맞는 보틀이 없습니다.
              </div>
            ) : (
              <div className="max-h-[540px] divide-y divide-stone-800/80 overflow-y-auto rounded-xl border border-stone-800 bg-stone-900/40">
                {filteredEntries.map((entry) => {
                  const st = statuses[entry.item.id];
                  const isSoldOut = st?.isSoldOut ?? false;
                  const soldOutCount = st?.soldOutCount ?? 0;
                  const ratingAvg = st?.ratingAvg ?? 0;
                  const ratingCount = st?.ratingCount ?? 0;
                  const isWanted = wantedKeys.has(entry.item.id);

                  return (
                    <div
                      key={entry.key}
                      className={`flex items-center gap-2 px-3 py-2.5 transition ${
                        isSoldOut
                          ? "bg-rose-950/20 hover:bg-rose-950/35"
                          : "hover:bg-stone-800/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleWanted(entry.item.id)}
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
                        onClick={() => {
                          onSelectBooth(entry.booth.id);
                          if (entry.kind === "bottle") {
                            onSelectBottle(entry.item as BottleItem);
                          } else {
                            onSelectTasting(entry.item as TastingItem);
                          }
                        }}
                        className="group flex min-w-0 flex-1 flex-col gap-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 rounded bg-[#8b303e] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                              {entry.booth.code}
                            </span>
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                entry.kind === "bottle"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-stone-800 text-stone-300"
                              }`}
                            >
                              {entry.kind === "bottle" ? "판매" : "시음"}
                            </span>
                            <span
                              className={`truncate text-sm font-medium ${
                                isSoldOut
                                  ? "text-stone-400 line-through"
                                  : "text-stone-100 group-hover:text-amber-200"
                              }`}
                            >
                              {entry.item.name}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="text-xs font-bold text-amber-300">
                              {entry.priceDisplay}
                            </span>
                            <ChevronRight className="h-4 w-4 text-stone-500 group-hover:text-amber-300" />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
                          <div className="flex items-center gap-1.5 truncate">
                            <span>{entry.booth.name}</span>
                            {entry.distillery && (
                              <span>· {entry.distillery}</span>
                            )}
                            {entry.item.abv !== "-" && (
                              <span>· {entry.item.abv}</span>
                            )}
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
            )}
          </div>
        )}
      </section>
    </div>
  );
}
