"use client";

import { MapPin } from "lucide-react";
import type { Booth, BottleDynamicStatus } from "@/types/festival";

interface BoothMapProps {
  booths: Booth[];
  selectedBoothId: string;
  onSelectBooth: (boothId: string) => void;
  statuses: Record<string, BottleDynamicStatus>;
}

export function BoothMap({
  booths,
  selectedBoothId,
  onSelectBooth,
  statuses,
}: BoothMapProps) {
  return (
    <section className="rounded-2xl border border-amber-900/40 bg-[#181411] p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-amber-200">
            행사장 부스 지도
          </h2>
          <p className="text-xs text-stone-400">
            부스를 클릭하면 아래에 시음 및 판매 보틀 목록이 표시됩니다.
          </p>
        </div>
        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 border border-amber-500/20">
          {booths.length}개 부스
        </span>
      </div>

      {/* 정적 평면도 기반 인터랙티브 부스 맵 */}
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-stone-800 bg-gradient-to-br from-[#211b16] via-[#171310] to-[#120f0d]">
        {/* 구역 가이드 라인 */}
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="h-full w-full bg-[linear-gradient(to_right,#a8a29e_1px,transparent_1px),linear-gradient(to_bottom,#a8a29e_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        {/* 입구 / 무대 표식 */}
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-stone-700 bg-stone-900/90 px-3 py-0.5 text-[10px] tracking-wider text-stone-400">
          MAIN STAGE
        </div>
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-stone-700 bg-stone-900/90 px-3 py-0.5 text-[10px] tracking-wider text-stone-400">
          ENTRANCE
        </div>

        {/* 부스 핀 */}
        {booths.map((booth) => {
          const isSelected = booth.id === selectedBoothId;
          const soldOutCount = booth.bottles.filter(
            (b) => statuses[b.id]?.isSoldOut
          ).length;

          return (
            <button
              key={booth.id}
              type="button"
              onClick={() => onSelectBooth(booth.id)}
              style={{
                left: `${booth.mapPosition.x}%`,
                top: `${booth.mapPosition.y}%`,
              }}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-left transition-all ${
                isSelected
                  ? "z-10 scale-105 border-amber-400 bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                  : "border-stone-700 bg-stone-900/90 hover:border-amber-500/60 hover:bg-stone-800/90"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <MapPin
                  className={`h-3.5 w-3.5 ${
                    isSelected ? "text-amber-300" : "text-stone-400"
                  }`}
                />
                <span className="text-xs font-bold text-amber-100">
                  {booth.code}
                </span>
                {soldOutCount > 0 && (
                  <span className="rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-medium text-rose-300">
                    매진 {soldOutCount}
                  </span>
                )}
              </div>
              <div className="mt-0.5 max-w-[110px] truncate text-[11px] text-stone-300">
                {booth.name}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
