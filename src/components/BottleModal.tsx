"use client";

import { useState } from "react";
import {
  X,
  Star,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  Trash2,
} from "lucide-react";
import type { BottleDynamicStatus } from "@/types/festival";
import type { SelectedDetailItem } from "./FestivalApp";

interface BottleModalProps {
  detail: SelectedDetailItem;
  status?: BottleDynamicStatus;
  onClose: () => void;
  onStatusUpdated: (updated: BottleDynamicStatus) => void;
}

const SOLD_OUT_THRESHOLD = 20;

export function BottleModal({
  detail,
  status,
  onClose,
  onStatusUpdated,
}: BottleModalProps) {
  const { kind, item } = detail;
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);
  const [submittingSoldOut, setSubmittingSoldOut] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const localSoldOutKey = `cask_soldout_${item.id}`;
  const localReviewKey = `cask_review_${item.id}`;
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

  const whiskybaseHref =
    item.whiskybaseUrl ||
    `https://www.whiskybase.com/search?q=${encodeURIComponent(item.name)}`;

  async function handleSoldOutVote() {
    if (hasVotedSoldOut || submittingSoldOut) return;
    setSubmittingSoldOut(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/bottles/${item.id}/soldout`, {
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
        text: "매진 제안이 반영되었습니다.",
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
      const res = await fetch(`/api/bottles/${item.id}/review`, {
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

  async function handleDeleteMyReview() {
    if (deletingReview) return;
    setDeletingReview(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/bottles/${item.id}/review`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.status) {
        onStatusUpdated(data.status);
      }

      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error ?? "평가 삭제에 실패했습니다.",
        });
        return;
      }

      localStorage.removeItem(localReviewKey);
      setFeedback({
        type: "success",
        text: "내가 남긴 평가가 삭제되었습니다.",
      });
    } catch {
      setFeedback({
        type: "error",
        text: "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setDeletingReview(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-900/40 bg-[#181411] p-5 shadow-2xl sm:rounded-2xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                {kind === "bottle" ? "판매 보틀" : "시음"}
              </span>
              {kind === "bottle" ? (
                <span>
                  {item.distillery}
                  {item.abv !== "-" ? ` · ${item.abv}` : ""}
                  {item.volume ? ` · ${item.volume}` : ""}
                </span>
              ) : (
                <span>{item.abv !== "-" ? `ABV ${item.abv}` : "테이스팅"}</span>
              )}
            </div>
            <h3 className="mt-1.5 text-lg font-bold text-amber-50">
              {item.name}
            </h3>
            <div className="mt-1 text-base font-bold text-amber-300">
              {kind === "bottle"
                ? `${item.price.toLocaleString("ko-KR")}원`
                : item.priceLabel}
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

        {item.note && (
          <p className="mt-3 text-sm text-stone-300">{item.note}</p>
        )}

        {/* Whiskybase 이동 버튼 */}
        <div className="mt-3">
          <a
            href={whiskybaseHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20"
          >
            <span>Whiskybase에서 보기</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

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
              "매진 처리되었습니다"
            ) : hasVotedSoldOut ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                이미 매진 제안을 완료했습니다
              </>
            ) : submittingSoldOut ? (
              "처리 중..."
            ) : (
              "매진 제안하기"
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
              평균 ★{" "}
              {status?.ratingCount
                ? `${status.ratingAvg} (${status.ratingCount}명)`
                : "아직 없음"}
            </span>
          </div>

          {hasReviewed ? (
            <div className="rounded-lg border border-stone-800 bg-stone-950/60 p-3 text-center text-xs text-stone-400">
              이미 평점 및 한줄평을 작성하셨습니다. 아래 내 평가에서 삭제 후 다시 작성할 수 있습니다.
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
                  <div className="flex items-center justify-between gap-2 text-amber-300">
                    <div className="flex items-center gap-2">
                      <span>{"★".repeat(rev.rating)}</span>
                      {rev.isMine && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                          내 평가
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-stone-500">
                        {new Date(rev.createdAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {rev.isMine && (
                        <button
                          type="button"
                          disabled={deletingReview}
                          onClick={handleDeleteMyReview}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-800/60 bg-rose-950/40 px-2 py-0.5 text-[10px] font-medium text-rose-300 hover:bg-rose-900/50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                          {deletingReview ? "삭제 중" : "삭제"}
                        </button>
                      )}
                    </div>
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
