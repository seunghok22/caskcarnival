import { NextResponse } from "next/server";
import { BOOTHS } from "@/data/booths";
import {
  attachUidCookie,
  getClientIp,
  getOrCreateClientUid,
} from "@/lib/identity";
import {
  checkRelaxedIpRateLimit,
  checkUserContributionLimit,
  isValidItemId,
  saveItemPatch,
} from "@/lib/redis";
import type { ItemPatch } from "@/types/festival";

function cleanField(val: unknown, maxLen: number): string | undefined {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function isValidWhiskybaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      (parsed.hostname === "whiskybase.com" ||
        parsed.hostname === "www.whiskybase.com")
    );
  } catch {
    return false;
  }
}

function getStaticBaseItem(itemId: string) {
  for (const booth of BOOTHS) {
    const t = booth.tastings.find((x) => x.id === itemId);
    if (t) return t;
    const b = booth.bottles.find((x) => x.id === itemId);
    if (b) return b;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const ip = await getClientIp();
    if (!(await checkRelaxedIpRateLimit(ip))) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      itemId?: unknown;
      patch?: Record<string, unknown>;
    };

    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    if (!itemId || !(await isValidItemId(itemId))) {
      return NextResponse.json(
        { error: "존재하지 않는 항목입니다." },
        { status: 404 }
      );
    }

    const raw = body.patch ?? {};
    const base = getStaticBaseItem(itemId);

    const patch: ItemPatch = {};
    const distillery = cleanField(raw.distillery, 60);
    const abv = cleanField(raw.abv, 20);
    const cask = cleanField(raw.cask, 80);
    const age = cleanField(raw.age, 30);
    const vintage = cleanField(raw.vintage, 20);
    const whiskybaseUrl = cleanField(raw.whiskybaseUrl, 250);
    const note = cleanField(raw.note, 150);

    if (whiskybaseUrl && !isValidWhiskybaseUrl(whiskybaseUrl)) {
      return NextResponse.json(
        { error: "Whiskybase URL만 입력할 수 있습니다. (https://www.whiskybase.com/...)" },
        { status: 400 }
      );
    }

    // 기존 정적 데이터에 이미 값이 있는 필드는 덮어쓰지 않고 빈 필드만 허용
    if (distillery && (!base?.distillery || base.distillery === "-")) {
      patch.distillery = distillery;
    }
    if (abv && (!base?.abv || base.abv === "-")) {
      patch.abv = abv.includes("%") ? abv : `${abv}%`;
    }
    if (cask && !base?.cask) {
      patch.cask = cask;
    }
    if (age && !base?.age) {
      patch.age = age;
    }
    if (vintage && !base?.vintage) {
      patch.vintage = vintage;
    }
    if (whiskybaseUrl && !base?.whiskybaseUrl) {
      patch.whiskybaseUrl = whiskybaseUrl;
    }
    if (note && (!base?.note || base.note === "현장 시음")) {
      patch.note = note;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "채울 수 있는 빈 정보 항목이 없습니다." },
        { status: 400 }
      );
    }

    const { uid, isNew } = await getOrCreateClientUid();
    if (!(await checkUserContributionLimit(uid))) {
      const res = NextResponse.json(
        { error: "1인당 제보/수정 한도(20건)를 초과했습니다." },
        { status: 429 }
      );
      return attachUidCookie(res, uid, isNew);
    }

    const saved = await saveItemPatch(itemId, patch);
    const res = NextResponse.json({ itemId, patch: saved });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("POST /api/contributions/patch error:", error);
    return NextResponse.json(
      { error: "정보 반영 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
