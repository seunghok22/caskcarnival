"use client";

import { useState } from "react";
import { X, PlusCircle } from "lucide-react";
import type { Booth, CustomBoothItem } from "@/types/festival";

interface AddItemModalProps {
  booth: Booth;
  defaultKind: "tasting" | "bottle";
  onClose: () => void;
  onItemAdded: (item: CustomBoothItem) => void;
}

export function AddItemModal({
  booth,
  defaultKind,
  onClose,
  onItemAdded,
}: AddItemModalProps) {
  const [kind, setKind] = useState<"tasting" | "bottle">(defaultKind);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [distillery, setDistillery] = useState("");
  const [abv, setAbv] = useState("");
  const [cask, setCask] = useState("");
  const [age, setAge] = useState("");
  const [vintage, setVintage] = useState("");
  const [peated, setPeated] = useState("");
  const [whiskybaseUrl, setWhiskybaseUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/contributions/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boothCode: booth.code,
          kind,
          name,
          price: kind === "bottle" ? price : undefined,
          priceLabel: kind === "tasting" ? priceLabel : undefined,
          distillery,
          abv,
          cask,
          age,
          vintage,
          peated,
          whiskybaseUrl,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "제품 추가에 실패했습니다.");
        return;
      }
      if (data.item) {
        onItemAdded(data.item as CustomBoothItem);
      }
      onClose();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-amber-900/40 bg-[#181411] p-5 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#8b303e] px-2 py-0.5 text-xs font-extrabold text-white">
                {booth.code}
              </span>
              <span className="text-xs font-medium text-stone-400">
                {booth.name}
              </span>
            </div>
            <h3 className="mt-1.5 flex items-center gap-1.5 text-base font-bold text-amber-50">
              <PlusCircle className="h-4 w-4 text-amber-400" />
              <span>새 제품 제보 / 추가</span>
            </h3>
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          {/* 구분 선택 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("tasting")}
              className={`rounded-xl border py-2 font-bold transition ${
                kind === "tasting"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-stone-800 bg-stone-900/60 text-stone-400"
              }`}
            >
              시음 목록에 추가
            </button>
            <button
              type="button"
              onClick={() => setKind("bottle")}
              className={`rounded-xl border py-2 font-bold transition ${
                kind === "bottle"
                  ? "border-amber-400 bg-amber-500/20 text-amber-200"
                  : "border-stone-800 bg-stone-900/60 text-stone-400"
              }`}
            >
              판매 보틀에 추가
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-stone-300">
              제품명 *
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 스프링뱅크 15년"
              className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {kind === "bottle" ? (
            <div>
              <label className="mb-1 block font-semibold text-stone-300">
                판매 가격 (원, 선택)
              </label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="예: 250000 (미입력 시 가격 미정)"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block font-semibold text-stone-300">
                시음 가격 (선택)
              </label>
              <input
                type="text"
                maxLength={40}
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="예: 무료 시음 또는 5000 (미입력 시 현장 문의)"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-stone-400">증류소</label>
              <input
                type="text"
                maxLength={60}
                value={distillery}
                onChange={(e) => setDistillery(e.target.value)}
                placeholder="예: Springbank"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-stone-400">도수</label>
              <input
                type="text"
                maxLength={20}
                value={abv}
                onChange={(e) => setAbv(e.target.value)}
                placeholder="예: 46%"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-stone-400">캐스크</label>
              <input
                type="text"
                maxLength={80}
                value={cask}
                onChange={(e) => setCask(e.target.value)}
                placeholder="예: 1st Fill Oloroso"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-stone-400">숙성기간</label>
              <input
                type="text"
                maxLength={30}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="예: 15년"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-stone-400">빈티지</label>
              <input
                type="text"
                maxLength={20}
                value={vintage}
                onChange={(e) => setVintage(e.target.value)}
                placeholder="예: 2010"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-stone-400">피트 여부</label>
              <select
                value={peated}
                onChange={(e) => setPeated(e.target.value)}
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="">선택 안 함</option>
                <option value="피트">피트 (Peated)</option>
                <option value="라이트 피트">라이트 피트 (Lightly Peated)</option>
                <option value="헤비 피트">헤비 피트 (Heavily Peated)</option>
                <option value="논피트">논피트 (Unpeated)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-stone-400">메모/노트</label>
              <input
                type="text"
                maxLength={150}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="선택 입력"
                className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-stone-400">
              Whiskybase 링크 (선택)
            </label>
            <input
              type="url"
              maxLength={250}
              value={whiskybaseUrl}
              onChange={(e) => setWhiskybaseUrl(e.target.value)}
              placeholder="https://www.whiskybase.com/whiskies/whisky/..."
              className="w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-700 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-stone-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "추가하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
