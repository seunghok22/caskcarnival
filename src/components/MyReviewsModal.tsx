"use client";

import { useEffect, useState } from "react";
import { X, Star, ChevronRight, Copy, Check } from "lucide-react";
import { getReviewKey } from "@/data/booths";
import type { Booth } from "@/types/festival";
import type { ReviewedItemMeta } from "./FestivalApp";

interface MyReviewApiItem {
  reviewKey: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface MyReviewsModalProps {
  booths: Booth[];
  reviewedItemMap: Record<string, ReviewedItemMeta>;
  onSelectEntry: (
    boothId: string,
    kind: "tasting" | "bottle",
    itemId: string
  ) => void;
  onClose: () => void;
}

export function MyReviewsModal({
  booths,
  reviewedItemMap,
  onSelectEntry,
  onClose,
}: MyReviewsModalProps) {
  const [reviews, setReviews] = useState<MyReviewApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews/mine", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => {
        if (active && Array.isArray(data.reviews)) {
          setReviews(data.reviews as MyReviewApiItem[]);
        }
      })
      .catch(() => {
        if (active) setError("내 평가 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function resolveMeta(reviewKey: string) {
    const savedMeta = reviewedItemMap[reviewKey];
    const preferredId = savedMeta?.itemId;
    const quantity = savedMeta?.quantity ?? 1;
    for (const booth of booths) {
      if (preferredId) {
        const b = booth.bottles.find((x) => x.id === preferredId);
        if (b) {
          return {
            booth,
            kind: "bottle" as const,
            itemId: b.id,
            name: b.name,
            quantity,
            priceText:
              b.price > 0
                ? `${b.price.toLocaleString("ko-KR")}원`
                : b.price === 0
                ? "무료"
                : "가격 미정",
            distillery: b.distillery && b.distillery !== "-" ? b.distillery : undefined,
            abv: b.abv && b.abv !== "-" ? b.abv : undefined,
            cask: b.cask,
            age: b.age,
            vintage: b.vintage,
            peated: b.peated,
            whiskybaseUrl: b.whiskybaseUrl,
          };
        }
        const t = booth.tastings.find((x) => x.id === preferredId);
        if (t) {
          return {
            booth,
            kind: "tasting" as const,
            itemId: t.id,
            name: t.name,
            quantity,
            priceText: t.priceLabel,
            distillery: t.distillery,
            abv: t.abv && t.abv !== "-" ? t.abv : undefined,
            cask: t.cask,
            age: t.age,
            vintage: t.vintage,
            peated: t.peated,
            whiskybaseUrl: t.whiskybaseUrl,
          };
        }
      }

      const bMatch = booth.bottles.find(
        (x) => (x.sharedReviewKey || getReviewKey(x.id)) === reviewKey
      );
      if (bMatch) {
        return {
          booth,
          kind: "bottle" as const,
          itemId: bMatch.id,
          name: bMatch.name,
          quantity,
          priceText:
            bMatch.price > 0
              ? `${bMatch.price.toLocaleString("ko-KR")}원`
              : bMatch.price === 0
              ? "무료"
              : "가격 미정",
          distillery:
            bMatch.distillery && bMatch.distillery !== "-"
              ? bMatch.distillery
              : undefined,
          abv: bMatch.abv && bMatch.abv !== "-" ? bMatch.abv : undefined,
          cask: bMatch.cask,
          age: bMatch.age,
          vintage: bMatch.vintage,
          peated: bMatch.peated,
          whiskybaseUrl: bMatch.whiskybaseUrl,
        };
      }
      const tMatch = booth.tastings.find(
        (x) => (x.sharedReviewKey || getReviewKey(x.id)) === reviewKey
      );
      if (tMatch) {
        return {
          booth,
          kind: "tasting" as const,
          itemId: tMatch.id,
          name: tMatch.name,
          quantity,
          priceText: tMatch.priceLabel,
          distillery: tMatch.distillery,
          abv: tMatch.abv && tMatch.abv !== "-" ? tMatch.abv : undefined,
          cask: tMatch.cask,
          age: tMatch.age,
          vintage: tMatch.vintage,
          peated: tMatch.peated,
          whiskybaseUrl: tMatch.whiskybaseUrl,
        };
      }
    }
    return null;
  }

  async function handleCopyText() {
    if (reviews.length === 0) return;

    const lines: string[] = [
      `[Cask Carnival 2026 내 평가 기록 (총 ${reviews.length}건)]`,
      "",
    ];

    reviews.forEach((rev, index) => {
      const meta = resolveMeta(rev.reviewKey);
      const title = meta
        ? `[${meta.booth.code}] ${meta.name} (${meta.booth.name})`
        : rev.reviewKey;
      const fullStars = Math.floor(rev.rating);
      const hasHalf = rev.rating - fullStars >= 0.5;
      const stars =
        "★".repeat(fullStars) +
        (hasHalf ? "½" : "") +
        "☆".repeat(Math.max(0, 5 - fullStars - (hasHalf ? 1 : 0)));

      lines.push(`${index + 1}. ${title}`);

      if (meta) {
        const specs: string[] = [];
        if (meta.distillery) specs.push(`증류소: ${meta.distillery}`);
        if (meta.abv) specs.push(`도수: ${meta.abv}`);
        if (meta.cask) specs.push(`캐스크: ${meta.cask}`);
        if (meta.age) specs.push(`숙성기간: ${meta.age}`);
        if (meta.vintage) specs.push(`빈티지: ${meta.vintage}`);
        if (meta.peated) specs.push(`피트: ${meta.peated}`);
        if (specs.length > 0) {
          lines.push(`   ${specs.join(" | ")}`);
        }
      }

      const qtyPart =
        meta && meta.quantity > 1 ? ` × ${meta.quantity}` : "";
      const pricePart = meta?.priceText
        ? `가격: ${meta.priceText}${qtyPart} | `
        : "";
      lines.push(`   ${pricePart}평점: ${stars} (${rev.rating}점)`);
      if (rev.comment) {
        lines.push(`   한줄평: ${rev.comment}`);
      }
      if (meta?.whiskybaseUrl) {
        lines.push(`   Whiskybase: ${meta.whiskybaseUrl}`);
      }
      lines.push("");
    });

    const text = lines.join("\n").trim();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("클립보드 복사에 실패했습니다.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-900/40 bg-[#181411] p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-3.5">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <h3 className="text-base font-bold text-amber-50">
              내 평가 모아보기 ({reviews.length})
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {reviews.length > 0 && (
              <button
                type="button"
                onClick={handleCopyText}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  copied
                    ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200"
                    : "border-stone-700 bg-stone-900 text-stone-200 hover:border-amber-400 hover:text-amber-200"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>텍스트 복사</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-stone-100"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="py-8 text-center text-xs text-stone-400">
              불러오는 중...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-800/60 bg-rose-950/30 p-4 text-center text-xs text-rose-200">
              {error}
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-6 text-center text-xs text-stone-400">
              아직 작성한 평가가 없습니다. 시음하거나 구매한 보틀에 평점과 한줄평을 남겨보세요!
            </div>
          ) : (
            <div className="divide-y divide-stone-800/80 overflow-hidden rounded-xl border border-stone-800 bg-stone-900/40">
              {reviews.map((rev) => {
                const meta = resolveMeta(rev.reviewKey);
                return (
                  <button
                    key={rev.reviewKey}
                    type="button"
                    onClick={() => {
                      if (meta) {
                        onSelectEntry(meta.booth.id, meta.kind, meta.itemId);
                        onClose();
                      }
                    }}
                    className="group flex w-full flex-col gap-1.5 px-3.5 py-3 text-left transition hover:bg-stone-800/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {meta && (
                          <span className="shrink-0 rounded bg-[#8b303e] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            {meta.booth.code}
                          </span>
                        )}
                        <span className="truncate text-sm font-semibold text-stone-100 group-hover:text-amber-200">
                          {meta ? meta.name : rev.reviewKey}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-xs font-bold text-amber-300">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{Number(rev.rating).toFixed(1)}점</span>
                        <ChevronRight className="h-3.5 w-3.5 text-stone-500 group-hover:text-amber-300" />
                      </div>
                    </div>

                    {rev.comment ? (
                      <p className="whitespace-pre-line break-words text-xs text-stone-200">
                        {rev.comment}
                      </p>
                    ) : (
                      <p className="text-[11px] text-stone-500">
                        (한줄평 없음)
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-stone-500">
                      <span>
                        {meta
                          ? `${meta.booth.name} · ${meta.priceText}${
                              meta.quantity > 1 ? ` × ${meta.quantity}` : ""
                            }`
                          : ""}
                      </span>
                      <span>
                        {new Date(rev.createdAt).toLocaleString("ko-KR", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
