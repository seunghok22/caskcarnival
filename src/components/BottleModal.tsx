"use client";

import { useState } from "react";
import { X, Star, AlertTriangle, CheckCircle2, MessageSquare } from "lucide-react";
import type { BottleDynamicStatus, BottleItem } from "@/types/festival";

interface BottleModalProps {
  bottle: BottleItem;
  status?: BottleDynamicStatus;
  onClose: () => void;
  onStatusUpdated: (updated: BottleDynamicStatus) => void;
}

const SOLD_OUT_THRESHOLD = 20;

export function BottleModal({
  bottle,
  status,
  onClose,
  onStatusUpdated,
}: BottleModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittingSoldOut, setSubmittingSoldOut] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // localStorage 보조 잠금 (UX 즉시 반영용)
  const localSoldOutKey = `cask_soldout_${bottle.id}`;
  const localReviewKey = `cask_review_${bottle.id}`;
  const hasLocalSoldOut =
    typeof window !== "undefined" && localStorage.getItem(localSoldOutKey) === "1";
  const hasLocalReview =
    typeof window !== "undefined" && localStorage.getItem(localReviewKey) === "1";

  const hasVotedSoldOut = Boolean(status?.hasVotedSoldOut || hasLocalSoldOut);
  const hasReviewed = Boolean(status?.hasReviewed || hasLocalReview);
  const soldOutCount = status?.soldOutCount ?? 0;
  const isSoldOut = status?.isSoldOut ?? false;
  const progressPercent = Math.min(
    100,
    Math.round((soldOutCount / SOLD_OUT_THRESHOLD) * 100)
  );

  async function handleSoldOutVote() {
    if (hasVotedSoldOut || submittingSoldOut) return;
    setSubmittingSoldOut(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/bottles/${bottle.id}/soldout`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.status) {
        onStatusUpdated(data.status);
      }

      if (!res.ok) {
        if (res.status === 409) {
          localStorage.setItem(localSoldOutKey, "1");
        }
        setFeedback({
          type: "error",
          text: data.error ?? "매진 제안에 실패했습니다.",
        });
        return;
      }

      localStorage.setItem(localSoldOutKey, "1");
      setFeedback({
        type: "success",
        text: "매진 제안이 반영되었습니다. (20명 이상 제안 시 매진 적용)",
      });
    } catch {
      setFeedback({
        type: "error",
        text: "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setSubmittingSoldOut(false);
    }
  }

  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hasReviewed || submittingReview) return;

    setSubmittingReview(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/bottles/${bottle.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();

      if (data.status) {
        onStatusUpdated(data.status);
      }

      if (!res.ok) {
        if (res.status === 409) {
          localStorage.setItem(localReviewKey, "1");
        }
        setFeedback({
          type: "error",
          text: data.error ?? "등록에 실패했습니다.",
        });
        return;
      }

      localStorage.setItem(localReviewKey, "1");
      setComment("");
      setFeedback({
        type: "success",
        text: "평점과 한줄평이 등록되었습니다.",
      });
    } catch {
      setFeedback({
        type: "error",
        text: "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-900/40 bg-[#181411] p-5 shadow-2xl sm:rounded-2xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-4">
          <div>
            <div className="text-xs text-stone-400">
              {bottle.distillery} · {bottle.abv} · {bottle.volume}
            </div>
            <h3 className="mt-1 text-lg font-bold text-amber-50">
              {bottle.name}
            </h3>
            <div className="mt-1 text-base font-bold text-amber-300">
              {bottle.price.toLocaleString("ko-KR")}원
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-stone-100"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {bottle.note && (
          <p className="mt-3 text-sm text-stone-300">{bottle.note}</p>
        )}

        {feedback && (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-xs ${
              feedback.type === "success"
                ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-200"
                : "border-rose-700/60 bg-rose-950/40 text-rose-200"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* 매진 제안 영역 */}
        <div className="mt-4 rounded-xl border border-stone-800 bg-stone-900/70 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-100">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span>판매 상태 / 매진 제안</span>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isSoldOut
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-stone-800 text-stone-300"
              }`}
            >
              {isSoldOut
                ? "매진 적용됨"
                : `${soldOutCount} / ${SOLD_OUT_THRESHOLD}명 제안`}
            </span>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-800">
            <div
              className={`h-full transition-all ${
                isSoldOut ? "bg-rose-500" : "bg-amber-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <button
            type="button"
            disabled={hasVotedSoldOut || submittingSoldOut || isSoldOut}
            onClick={handleSoldOutVote}
            className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
              hasVotedSoldOut || isSoldOut
                ? "cursor-not-allowed bg-stone-800 text-stone-400"
                : "bg-rose-600/90 text-white hover:bg-rose-500"
            }`}
          >
            {isSoldOut ? (
              "20명 이상 제안으로 매진 처리되었습니다"
            ) : hasVotedSoldOut ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                이미 매진 제안을 완료했습니다
              </>
            ) : submittingSoldOut ? (
              "처리 중..."
            ) : (
              "이 보틀 매진 제안하기"
            )}
          </button>
        </div>

        {/* 평점 & 한줄평 작성 */}
        <form
          onSubmit={handleReviewSubmit}
          className="mt-4 rounded-xl border border-stone-800 bg-stone-900/70 p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-100">
              평점 & 한줄평 남기기
            </span>
            <span className="text-xs text-amber-300">
              평균 ★ {status?.ratingCount ? `${status.ratingAvg} (${status.ratingCount}명)` : "아직 없음"}
            </span>
          </div>

          {hasReviewed ? (
            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3 text-center text-xs text-stone-400">
              이미 이 보틀에 평점 및 한줄평을 작성하셨습니다.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setRating(score)}
                    className="p-1"
                    aria-label={`${score}점`}
                  >
                    <Star
                      className={`h-6 w-6 transition ${
                        score <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-stone-600"
                      }`}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs text-stone-300">{rating}점</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={100}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="한줄평을 남겨주세요 (선택, 최대 100자)"
                  className="flex-1 rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {submittingReview ? "등록..." : "등록"}
                </button>
              </div>
            </>
          )}
        </form>

        {/* 최근 한줄평 목록 */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-stone-300">
            <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
            <span>최근 한줄평 ({status?.reviews.length ?? 0})</span>
          </div>

          {!status?.reviews.length ? (
            <p className="rounded-xl border border-stone-800/70 bg-stone-900/40 p-3 text-xs text-stone-500">
              아직 등록된 한줄평이 없습니다. 첫 한줄평을 남겨보세요!
            </p>
          ) : (
            <ul className="space-y-2">
              {status.reviews.map((rev) => (
                <li
                  key={rev.id}
                  className="rounded-xl border border-stone-800/80 bg-stone-900/40 p-3 text-xs"
                >
                  <div className="flex items-center justify-between text-amber-300">
                    <span>{"★".repeat(rev.rating)}</span>
                    <span className="text-[10px] text-stone-500">
                      {new Date(rev.createdAt).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {rev.comment && (
                    <p className="mt-1 text-sm text-stone-200">{rev.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
