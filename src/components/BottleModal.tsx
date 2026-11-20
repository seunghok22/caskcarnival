"use client";

import { useEffect, useState } from "react";
import {
  X,
  Star,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  ExternalLink,
  Trash2,
  Bookmark,
  Pencil,
} from "lucide-react";
import type { BottleDynamicStatus, ItemPatch } from "@/types/festival";
import { getReviewKey } from "@/data/booths";
import type { SelectedDetailItem } from "./FestivalApp";

interface BottleModalProps {
  detail: SelectedDetailItem;
  status?: BottleDynamicStatus;
  isWanted: boolean;
  onToggleWanted: () => void;
  onReviewSubmitted: (quantity: number) => void;
  onReviewDeleted: () => void;
  onPatchApplied: (itemId: string, patch: ItemPatch) => void;
  onCustomItemDeleted: (itemId: string) => void;
  onClose: () => void;
  onStatusUpdated: (updated: BottleDynamicStatus) => void;
}

const SOLD_OUT_THRESHOLD = 20;

export function BottleModal({
  detail,
  status,
  isWanted,
  onToggleWanted,
  onReviewSubmitted,
  onReviewDeleted,
  onPatchApplied,
  onCustomItemDeleted,
  onClose,
  onStatusUpdated,
}: BottleModalProps) {
  const { kind, item } = detail;
  const [rating, setRating] = useState<number>(5);
  const [quantity, setQuantity] = useState<number>(1);
  const [comment, setComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);
  const [submittingSoldOut, setSubmittingSoldOut] = useState(false);
  const [showPatchForm, setShowPatchForm] = useState(false);
  const [submittingPatch, setSubmittingPatch] = useState(false);
  const [deletingCustomItem, setDeletingCustomItem] = useState(false);
  const [patchDistillery, setPatchDistillery] = useState("");
  const [patchAbv, setPatchAbv] = useState("");
  const [patchCask, setPatchCask] = useState("");
  const [patchAge, setPatchAge] = useState("");
  const [patchVintage, setPatchVintage] = useState("");
  const [patchWhiskybase, setPatchWhiskybase] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 모달이 열릴 때 해당 항목의 최신 한줄평/상태를 단건 조회합니다.
  useEffect(() => {
    let active = true;
    fetch(`/api/bottles/${item.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.status) {
          onStatusUpdated(data.status as BottleDynamicStatus);
        }
      })
      .catch(() => {
        // ignore background refresh errors
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const missingDistillery = !item.distillery || item.distillery === "-";
  const missingAbv = !item.abv || item.abv === "-";
  const missingCask = !item.cask;
  const missingAge = !item.age;
  const missingVintage = !item.vintage;
  const missingWhiskybase = !item.whiskybaseUrl;
  const hasAnyMissingField =
    missingDistillery ||
    missingAbv ||
    missingCask ||
    missingAge ||
    missingVintage ||
    missingWhiskybase;

  const reviewKey = getReviewKey(item.id);
  const localSoldOutKey = `cask_soldout_${item.id}`;
  const localReviewKey = `cask_review_${reviewKey}`;
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

  const whiskybaseHref = item.whiskybaseUrl?.trim() || null;

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

  async function handleCancelSoldOutVote() {
    if (!hasVotedSoldOut || submittingSoldOut) return;
    setSubmittingSoldOut(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/bottles/${item.id}/soldout`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.status) {
        onStatusUpdated(data.status);
      }

      if (!res.ok) {
        if (res.status === 404) {
          localStorage.removeItem(localSoldOutKey);
          setFeedback({
            type: "success",
            text: "매진 제안 상태가 초기화되었습니다.",
          });
          return;
        }
        setFeedback({
          type: "error",
          text: data.error ?? "매진 제안 취소에 실패했습니다.",
        });
        return;
      }

      localStorage.removeItem(localSoldOutKey);
      setFeedback({
        type: "success",
        text: "매진 제안이 취소되었습니다.",
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
      onReviewSubmitted(quantity);
      setComment("");
      setQuantity(1);
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
        if (res.status === 404) {
          localStorage.removeItem(localReviewKey);
          onReviewDeleted();
          setFeedback({
            type: "success",
            text: "평가 잠금이 해제되었습니다. 다시 작성할 수 있습니다.",
          });
          return;
        }
        setFeedback({
          type: "error",
          text: data.error ?? "평가 삭제에 실패했습니다.",
        });
        return;
      }

      localStorage.removeItem(localReviewKey);
      onReviewDeleted();
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

  async function handlePatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingPatch) return;
    setSubmittingPatch(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/contributions/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          patch: {
            distillery: missingDistillery ? patchDistillery : undefined,
            abv: missingAbv ? patchAbv : undefined,
            cask: missingCask ? patchCask : undefined,
            age: missingAge ? patchAge : undefined,
            vintage: missingVintage ? patchVintage : undefined,
            whiskybaseUrl: missingWhiskybase ? patchWhiskybase : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error ?? "정보 수정에 실패했습니다.",
        });
        return;
      }
      if (data.patch) {
        onPatchApplied(item.id, data.patch as ItemPatch);
      }
      setShowPatchForm(false);
      setPatchDistillery("");
      setPatchAbv("");
      setPatchCask("");
      setPatchAge("");
      setPatchVintage("");
      setPatchWhiskybase("");
      setFeedback({
        type: "success",
        text: "빈 정보가 즉시 반영되었습니다. 제보해 주셔서 감사합니다!",
      });
    } catch {
      setFeedback({
        type: "error",
        text: "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setSubmittingPatch(false);
    }
  }

  async function handleDeleteCustomItem() {
    if (deletingCustomItem) return;
    setDeletingCustomItem(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/contributions/item/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.error ?? "제품 삭제에 실패했습니다.",
        });
        return;
      }
      onCustomItemDeleted(item.id);
    } catch {
      setFeedback({
        type: "error",
        text: "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setDeletingCustomItem(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-900/40 bg-[#181411] p-5 shadow-2xl sm:rounded-2xl">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                {kind === "bottle" ? "판매 보틀" : "시음"}
              </span>
              {item.isUserContributed && (
                <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                  유저 제보
                </span>
              )}
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
                ? item.price > 0
                  ? `${item.price.toLocaleString("ko-KR")}원`
                  : item.price === 0
                  ? "무료"
                  : "가격 미정"
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

        {/* 캐스크 / 빈티지 / 숙성기간 세부 스펙 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-stone-800/90 bg-stone-900/60 px-3 py-2">
            <div className="text-[10px] font-medium text-stone-400">
              캐스크 정보
            </div>
            <div className="mt-0.5 break-words text-xs font-semibold text-stone-100">
              {item.cask || "-"}
            </div>
          </div>
          <div className="rounded-xl border border-stone-800/90 bg-stone-900/60 px-3 py-2">
            <div className="text-[10px] font-medium text-stone-400">
              빈티지
            </div>
            <div className="mt-0.5 truncate text-xs font-semibold text-stone-100">
              {item.vintage || "-"}
            </div>
          </div>
          <div className="rounded-xl border border-stone-800/90 bg-stone-900/60 px-3 py-2">
            <div className="text-[10px] font-medium text-stone-400">
              숙성기간
            </div>
            <div className="mt-0.5 truncate text-xs font-semibold text-stone-100">
              {item.age || "-"}
            </div>
          </div>
        </div>

        {/* Whiskybase 이동 버튼 + wanted 북마크 버튼 */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {whiskybaseHref ? (
            <a
              href={whiskybaseHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20"
            >
              <span>Whiskybase에서 보기</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2 text-xs font-semibold text-stone-500"
            >
              <span>Whiskybase에서 보기</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleWanted}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              isWanted
                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                : "border-stone-700 bg-stone-900/80 text-stone-300 hover:border-amber-500/50 hover:text-amber-200"
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 ${
                isWanted ? "fill-amber-400 text-amber-400" : "text-stone-400"
              }`}
            />
            <span>wanted</span>
          </button>

          {hasAnyMissingField && (
            <button
              type="button"
              onClick={() => setShowPatchForm((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                showPatchForm
                  ? "border-sky-400 bg-sky-500/20 text-sky-200"
                  : "border-stone-700 bg-stone-900/80 text-stone-300 hover:border-sky-500/50 hover:text-sky-200"
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>빈 정보 채우기</span>
            </button>
          )}

          {item.isUserContributed && item.isMine && (
            <button
              type="button"
              disabled={deletingCustomItem}
              onClick={handleDeleteCustomItem}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-800/70 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deletingCustomItem ? "삭제 중..." : "제보 제품 삭제"}</span>
            </button>
          )}
        </div>

        {/* 빈 정보 채우기 폼 (비어있는 필드만 노출) */}
        {showPatchForm && hasAnyMissingField && (
          <form
            onSubmit={handlePatchSubmit}
            className="mt-3 rounded-xl border border-sky-900/60 bg-sky-950/20 p-3.5 text-xs"
          >
            <div className="mb-2 font-semibold text-sky-200">
              비어 있는 정보만 입력해 바로 반영할 수 있습니다
            </div>
            <div className="grid grid-cols-2 gap-2">
              {missingDistillery && (
                <input
                  type="text"
                  maxLength={60}
                  value={patchDistillery}
                  onChange={(e) => setPatchDistillery(e.target.value)}
                  placeholder="증류소 (예: Springbank)"
                  className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-sky-400 focus:outline-none"
                />
              )}
              {missingAbv && (
                <input
                  type="text"
                  maxLength={20}
                  value={patchAbv}
                  onChange={(e) => setPatchAbv(e.target.value)}
                  placeholder="도수 (예: 52.5%)"
                  className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-sky-400 focus:outline-none"
                />
              )}
              {missingCask && (
                <input
                  type="text"
                  maxLength={80}
                  value={patchCask}
                  onChange={(e) => setPatchCask(e.target.value)}
                  placeholder="캐스크 (예: Oloroso Sherry)"
                  className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-sky-400 focus:outline-none"
                />
              )}
              {missingAge && (
                <input
                  type="text"
                  maxLength={30}
                  value={patchAge}
                  onChange={(e) => setPatchAge(e.target.value)}
                  placeholder="숙성기간 (예: 15년)"
                  className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-sky-400 focus:outline-none"
                />
              )}
              {missingVintage && (
                <input
                  type="text"
                  maxLength={20}
                  value={patchVintage}
                  onChange={(e) => setPatchVintage(e.target.value)}
                  placeholder="빈티지 (예: 2010)"
                  className="rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-sky-400 focus:outline-none"
                />
              )}
            </div>
            {missingWhiskybase && (
              <input
                type="url"
                maxLength={250}
                value={patchWhiskybase}
                onChange={(e) => setPatchWhiskybase(e.target.value)}
                placeholder="Whiskybase URL (https://www.whiskybase.com/...)"
                className="mt-2 w-full rounded-lg border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-100 placeholder:text-stone-500 focus:border-sky-400 focus:outline-none"
              />
            )}
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPatchForm(false)}
                className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-300"
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={submittingPatch}
                className="rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-stone-950 hover:bg-sky-400 disabled:opacity-50"
              >
                {submittingPatch ? "저장 중..." : "정보 반영하기"}
              </button>
            </div>
          </form>
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

          {hasVotedSoldOut ? (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-800/80 py-2 text-xs font-medium text-stone-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                {isSoldOut
                  ? "매진 처리됨 (본인 매진 제안 포함)"
                  : "매진 제안을 완료했습니다"}
              </div>
              <button
                type="button"
                disabled={submittingSoldOut}
                onClick={handleCancelSoldOutVote}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900 py-2 text-xs font-semibold text-stone-200 transition hover:border-rose-500/60 hover:bg-rose-950/40 hover:text-rose-200 disabled:opacity-50"
              >
                {submittingSoldOut ? "취소 중..." : "내 매진 제안 취소하기"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={submittingSoldOut || isSoldOut}
              onClick={handleSoldOutVote}
              className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition ${
                isSoldOut
                  ? "cursor-not-allowed bg-stone-800 text-stone-400"
                  : "bg-rose-600/90 text-white hover:bg-rose-500"
              }`}
            >
              {isSoldOut
                ? "매진 처리되었습니다"
                : submittingSoldOut
                ? "처리 중..."
                : "매진 제안하기"}
            </button>
          )}
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
            <div className="flex flex-col items-center gap-2.5 rounded-lg border border-stone-800 bg-stone-950/60 p-3 text-center text-xs text-stone-400">
              <span>이미 평점 및 한줄평을 작성하셨습니다.</span>
              <button
                type="button"
                disabled={deletingReview}
                onClick={handleDeleteMyReview}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-800/70 bg-rose-950/50 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/60 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingReview ? "삭제 중..." : "내 평가 삭제하고 다시 작성하기"}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
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
                  <span className="ml-1 text-xs text-stone-300">{rating}점</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-stone-300">
                  <span className="text-stone-400">수량</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-7 w-7 rounded-lg border border-stone-700 bg-stone-950 font-bold text-stone-200 hover:border-amber-500"
                    aria-label="수량 감소"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) {
                        setQuantity(Math.max(1, Math.min(99, Math.floor(v))));
                      }
                    }}
                    className="h-7 w-11 rounded-lg border border-stone-700 bg-stone-950 text-center text-xs font-semibold text-stone-100 focus:border-amber-500 focus:outline-none"
                    aria-label="구매 수량"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                    className="h-7 w-7 rounded-lg border border-stone-700 bg-stone-950 font-bold text-stone-200 hover:border-amber-500"
                    aria-label="수량 증가"
                  >
                    +
                  </button>
                </div>
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
