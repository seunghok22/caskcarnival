"use client";

import { useState } from "react";
import { Search, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { Booth, BoothZone } from "@/types/festival";

interface BoothMapProps {
  booths: Booth[];
  selectedBoothId: string;
  onSelectBooth: (boothId: string) => void;
}

const ZONE_FILTERS: { label: string; value: BoothZone | "ALL" }[] = [
  { label: "전체 (71)", value: "ALL" },
  { label: "A구역", value: "A" },
  { label: "B구역", value: "B" },
  { label: "C구역", value: "C" },
  { label: "D구역", value: "D" },
  { label: "E구역", value: "E" },
  { label: "F구역", value: "F" },
  { label: "G구역", value: "G" },
  { label: "I (안내)", value: "I" },
];

export function BoothMap({
  booths,
  selectedBoothId,
  onSelectBooth,
}: BoothMapProps) {
  const [activeZone, setActiveZone] = useState<BoothZone | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredBoothId, setHoveredBoothId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);

  const selectedBooth =
    booths.find((b) => b.id === selectedBoothId) ?? booths[0];
  const hoveredBooth = hoveredBoothId
    ? booths.find((b) => b.id === hoveredBoothId)
    : null;
  const previewBooth = hoveredBooth ?? selectedBooth;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  function isBoothMatched(booth: Booth): boolean {
    const zoneMatch = activeZone === "ALL" || booth.zone === activeZone;
    if (!zoneMatch) return false;
    if (!normalizedQuery) return true;
    return (
      booth.code.toLowerCase().includes(normalizedQuery) ||
      booth.name.toLowerCase().includes(normalizedQuery) ||
      booth.nameEn.toLowerCase().includes(normalizedQuery)
    );
  }

  return (
    <section className="rounded-2xl border border-amber-900/40 bg-[#181411] p-4 shadow-lg">
      {/* 상단 헤더 & 검색/필터 */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-amber-100">
            행사장 부스 배치도
          </h2>
          <p className="text-xs text-stone-400">
            지도에서 부스(A01~G07, I)를 클릭하면 하단에서 시음 및 판매 보틀을 확인할 수 있습니다.
          </p>
        </div>

        {/* 부스 검색창 */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="부스 번호(예: D03) 또는 이름 검색"
            className="w-full rounded-xl border border-stone-700 bg-stone-900/90 py-1.5 pl-8 pr-3 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* 구역 필터 탭 & 줌 컨트롤 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ZONE_FILTERS.map((zf) => {
            const active = activeZone === zf.value;
            return (
              <button
                key={zf.value}
                type="button"
                onClick={() => setActiveZone(zf.value)}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? "border-amber-400 bg-amber-500/20 text-amber-200"
                    : "border-stone-800 bg-stone-900/70 text-stone-400 hover:border-stone-700 hover:text-stone-200"
                }`}
              >
                {zf.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
            className="rounded-lg border border-stone-800 bg-stone-900 p-1.5 text-stone-300 hover:border-stone-700"
            title="축소"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-lg border border-stone-800 bg-stone-900 px-2 py-1 text-[11px] text-stone-300 hover:border-stone-700"
            title="기본 배율"
          >
            <RotateCcw className=" inline h-3 w-3 mr-1" />
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, Number((z + 0.25).toFixed(2))))}
            className="rounded-lg border border-stone-800 bg-stone-900 p-1.5 text-stone-300 hover:border-stone-700"
            title="확대"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 원본 도면 스타일 인터랙티브 SVG 맵 */}
      <div className="overflow-x-auto rounded-xl border border-stone-700 bg-[#fcfaf8] shadow-inner">
        <div
          style={{
            width: `${100 * zoom}%`,
            minWidth: "680px",
          }}
          className="transition-all duration-150"
        >
          <svg
            viewBox="0 0 960 690"
            className="block h-auto w-full select-none"
            role="img"
            aria-label="Cask Carnival 행사장 부스 지도"
          >
            {/* 도면 배경 */}
            <rect x="0" y="0" width="960" height="690" fill="#fcfaf8" />

            {/* 상단 ROOM A ~ ROOM F 영역 */}
            <g stroke="#8b303e" strokeWidth="1.6">
              {/* ROOM A */}
              <rect x="100" y="20" width="100" height="120" fill="#f3dfe2" />
              {/* ROOM B */}
              <rect x="200" y="20" width="100" height="120" fill="#f3dfe2" />
              {/* A-B와 C 사이 빈 공간 */}
              <rect x="300" y="20" width="40" height="120" fill="#fcfaf8" />
              {/* ROOM C */}
              <rect x="340" y="20" width="100" height="120" fill="#f3dfe2" />
              {/* ROOM D */}
              <rect x="440" y="20" width="100" height="120" fill="#f3dfe2" />
              {/* ROOM E */}
              <rect x="540" y="20" width="94" height="120" fill="#f3dfe2" />
              {/* E와 F 사이 복도 */}
              <rect x="634" y="20" width="41" height="120" fill="#fcfaf8" />
              {/* ROOM F */}
              <rect x="675" y="20" width="65" height="120" fill="#f3dfe2" />
            </g>

            {/* ROOM 텍스트 */}
            <g
              fill="#5c1f28"
              fontFamily="sans-serif"
              textAnchor="middle"
              fontWeight="700"
            >
              <text x="150" y="72" fontSize="12">
                ROOM
              </text>
              <text x="150" y="92" fontSize="18">
                A
              </text>

              <text x="250" y="72" fontSize="12">
                ROOM
              </text>
              <text x="250" y="92" fontSize="18">
                B
              </text>

              <text x="390" y="72" fontSize="12">
                ROOM
              </text>
              <text x="390" y="92" fontSize="18">
                C
              </text>

              <text x="490" y="72" fontSize="12">
                ROOM
              </text>
              <text x="490" y="92" fontSize="18">
                D
              </text>

              <text x="587" y="72" fontSize="12">
                ROOM
              </text>
              <text x="587" y="92" fontSize="18">
                E
              </text>

              <text x="707" y="72" fontSize="12">
                ROOM
              </text>
              <text x="707" y="92" fontSize="18">
                F
              </text>
            </g>

            {/* 메인 홀 외벽 테두리 */}
            <rect
              x="100"
              y="140"
              width="820"
              height="520"
              fill="none"
              stroke="#8b303e"
              strokeWidth="1.8"
            />

            {/* 좌측 화장실 돌출부 */}
            <g stroke="#8b303e" strokeWidth="1.6" fill="#fcfaf8">
              <rect x="60" y="268" width="40" height="72" />
            </g>
            <g fill="#5c1f28" textAnchor="middle" fontFamily="sans-serif">
              <circle cx="75" cy="292" r="3" />
              <path d="M71 297 h8 v10 h-8 z" />
              <circle cx="86" cy="292" r="3" />
              <path d="M82 297 h8 l-2 10 h-4 z" />
              <text x="80" y="324" fontSize="10" fontWeight="700">
                화장실
              </text>
            </g>

            {/* 좌하단 칠링 존 (핑크 영역) */}
            <rect
              x="101"
              y="385"
              width="209"
              height="220"
              fill="#f3dfe2"
            />
            <text
              x="212"
              y="498"
              fill="#4a1921"
              fontSize="16"
              fontWeight="800"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              칠링 존
            </text>

            {/* 우상단 코너 빈 박스 & 좌하단 코너 빈 박스 (원본 도면 동일) */}
            <rect
              x="850"
              y="140"
              width="70"
              height="55"
              fill="#fcfaf8"
              stroke="#8b303e"
              strokeWidth="1.5"
            />
            <rect
              x="100"
              y="605"
              width="22"
              height="55"
              fill="#fcfaf8"
              stroke="#8b303e"
              strokeWidth="1.5"
            />

            {/* 프로그램 입구 표시 (상단) */}
            <g fill="#6d1d29" textAnchor="middle" fontFamily="sans-serif">
              <polygon points="663,144 657,154 669,154" />
              <text x="688" y="168" fontSize="11" fontWeight="700">
                프로그램 입구
              </text>
            </g>

            {/* 하단 출구 / 입구 표시 */}
            <g fill="#6d1d29" textAnchor="middle" fontFamily="sans-serif">
              {/* 출구 ▼ */}
              <polygon points="755,638 748,626 762,626" />
              <text x="755" y="654" fontSize="12" fontWeight="800">
                출구
              </text>

              {/* 입구 ▲ */}
              <polygon points="822,625 815,637 829,637" />
              <text x="822" y="654" fontSize="12" fontWeight="800">
                입구
              </text>
            </g>

            {/* 71개 전체 부스 렌더링 */}
            {booths.map((booth) => {
              const isSelected = booth.id === selectedBoothId;
              const isHovered = booth.id === hoveredBoothId;
              const hasActiveFilter =
                normalizedQuery.length > 0 || activeZone !== "ALL";
              const matched = isBoothMatched(booth);
              const isHighlightedMatch = hasActiveFilter && matched;

              const fill = isSelected
                ? "#8b303e"
                : isHovered
                ? "#f5d0c5"
                : isHighlightedMatch
                ? "#dcfce7"
                : !matched
                ? "#f1eeec"
                : "#fcfaf8";

              const stroke = isSelected
                ? "#f59e0b"
                : isHighlightedMatch
                ? "#16a34a"
                : "#8b303e";

              const textFill = isSelected
                ? "#ffffff"
                : isHighlightedMatch
                ? "#14532d"
                : !matched
                ? "#b8b0ac"
                : "#2b181b";

              const cx = booth.rect.x + booth.rect.w / 2;
              const cy = booth.rect.y + booth.rect.h / 2;

              return (
                <g
                  key={booth.id}
                  onClick={() => onSelectBooth(booth.id)}
                  onMouseEnter={() => setHoveredBoothId(booth.id)}
                  onMouseLeave={() => setHoveredBoothId(null)}
                  className="cursor-pointer transition-opacity"
                >
                  <rect
                    x={booth.rect.x}
                    y={booth.rect.y}
                    width={booth.rect.w}
                    height={booth.rect.h}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected || isHighlightedMatch ? "2.4" : "1.5"}
                  />

                  <text
                    x={cx}
                    y={cy + 4}
                    fill={textFill}
                    fontSize="11.5"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="sans-serif"
                  >
                    {booth.code}
                  </text>
                </g>
              );
            })}

            {/* 마우스 호버 시 부스명 툴팁 */}
            {hoveredBooth &&
              (() => {
                const label = `${hoveredBooth.code} · ${hoveredBooth.name}`;
                const boxWidth = Math.max(96, label.length * 10.5 + 24);
                const boxHeight = 28;
                const centerX = hoveredBooth.rect.x + hoveredBooth.rect.w / 2;
                const clampedX = Math.min(
                  Math.max(centerX - boxWidth / 2, 12),
                  960 - boxWidth - 12
                );
                const showBelow = hoveredBooth.rect.y < 150;
                const boxY = showBelow
                  ? hoveredBooth.rect.y + hoveredBooth.rect.h + 8
                  : hoveredBooth.rect.y - boxHeight - 8;

                return (
                  <g className="pointer-events-none">
                    <rect
                      x={clampedX}
                      y={boxY}
                      width={boxWidth}
                      height={boxHeight}
                      rx={8}
                      fill="#1c1714"
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                    />
                    <text
                      x={clampedX + boxWidth / 2}
                      y={boxY + 18}
                      fill="#fef3c7"
                      fontSize="12"
                      fontWeight="700"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      {label}
                    </text>
                  </g>
                );
              })()}
          </svg>
        </div>
      </div>

      {/* 현재 선택/호버된 부스 요약 바 */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-stone-900/90 px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#8b303e] px-2 py-0.5 text-xs font-extrabold text-white">
            {previewBooth.code}
          </span>
          <span className="text-sm font-bold text-amber-100">
            {previewBooth.name}
          </span>
          <span className="text-xs text-stone-400">
            {previewBooth.nameEn}
          </span>
        </div>
      </div>
    </section>
  );
}
