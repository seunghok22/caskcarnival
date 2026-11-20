import { NextResponse } from "next/server";
import { BOOTHS } from "@/data/booths";
import {
  attachUidCookie,
  getClientIp,
  getOrCreateClientUid,
} from "@/lib/identity";
import {
  addCustomItem,
  checkRelaxedIpRateLimit,
  checkUserContributionLimit,
} from "@/lib/redis";

const VALID_BOOTH_CODES = new Set(BOOTHS.map((b) => b.code));

function cleanStr(val: unknown, maxLen: number): string | undefined {
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

export async function POST(req: Request) {
  try {
    const ip = await getClientIp();
    if (!(await checkRelaxedIpRateLimit(ip))) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const boothCode = cleanStr(body.boothCode, 10);
    const kind = body.kind === "bottle" ? "bottle" : body.kind === "tasting" ? "tasting" : null;
    const name = cleanStr(body.name, 100);

    if (!boothCode || !VALID_BOOTH_CODES.has(boothCode)) {
      return NextResponse.json(
        { error: "올바르지 않은 부스입니다." },
        { status: 400 }
      );
    }
    if (!kind) {
      return NextResponse.json(
        { error: "시음 또는 판매 보틀 구분을 선택해 주세요." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { error: "제품명을 입력해 주세요." },
        { status: 400 }
      );
    }

    const distillery = cleanStr(body.distillery, 60);
    const abvRaw = cleanStr(body.abv, 20);
    const abv = abvRaw ? (abvRaw.includes("%") ? abvRaw : `${abvRaw}%`) : "-";
    const cask = cleanStr(body.cask, 80);
    const age = cleanStr(body.age, 30);
    const vintage = cleanStr(body.vintage, 20);
    const whiskybaseUrl = cleanStr(body.whiskybaseUrl, 250);
    const note = cleanStr(body.note, 150);

    if (whiskybaseUrl && !isValidWhiskybaseUrl(whiskybaseUrl)) {
      return NextResponse.json(
        { error: "Whiskybase URL만 입력할 수 있습니다. (https://www.whiskybase.com/...)" },
        { status: 400 }
      );
    }

    let price: number | undefined;
    let priceLabel: string | undefined;

    if (kind === "bottle") {
      const priceNum = Number(String(body.price ?? "").replace(/[^0-9]/g, ""));
      if (!Number.isFinite(priceNum) || priceNum <= 0 || priceNum > 100_000_000) {
        return NextResponse.json(
          { error: "판매 보틀 가격을 올바른 숫자로 입력해 주세요." },
          { status: 400 }
        );
      }
      price = Math.round(priceNum);
    } else {
      const rawPrice = cleanStr(body.priceLabel, 40);
      if (!rawPrice) {
        priceLabel = "현장 문의";
      } else if (/^\d+$/.test(rawPrice.replace(/,/g, ""))) {
        const num = Number(rawPrice.replace(/,/g, ""));
        priceLabel = num === 0 ? "무료 시음" : `${num.toLocaleString("ko-KR")}원`;
      } else {
        priceLabel = rawPrice;
      }
    }

    const { uid, isNew } = await getOrCreateClientUid();
    if (!(await checkUserContributionLimit(uid))) {
      const res = NextResponse.json(
        { error: "1인당 제보/수정 한도(20건)를 초과했습니다." },
        { status: 429 }
      );
      return attachUidCookie(res, uid, isNew);
    }

    const created = await addCustomItem(
      {
        boothCode,
        kind,
        name,
        distillery,
        abv,
        volume: kind === "bottle" ? "700ml" : undefined,
        price,
        priceLabel,
        note,
        cask,
        vintage,
        age,
        whiskybaseUrl,
      },
      uid
    );

    const res = NextResponse.json({ item: created });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("POST /api/contributions/item error:", error);
    return NextResponse.json(
      { error: "제품 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
