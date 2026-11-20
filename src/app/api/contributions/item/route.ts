import { NextResponse } from "next/server";
import {
  BOOTHS,
  findStaticReviewKeyByName,
  getReviewKey,
  normalizeItemName,
} from "@/data/booths";
import {
  attachUidCookie,
  getClientIp,
  getOrCreateClientUid,
} from "@/lib/identity";
import {
  acquireOppositeLinkLock,
  addCustomItem,
  checkRelaxedIpRateLimit,
  checkUserContributionLimit,
  isValidItemId,
} from "@/lib/redis";

const BOOTH_BY_CODE = new Map(BOOTHS.map((b) => [b.code, b]));

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

    const targetBooth = boothCode ? BOOTH_BY_CODE.get(boothCode) : undefined;
    if (!boothCode || !targetBooth) {
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
    const peated = cleanStr(body.peated, 20);
    const whiskybaseUrl = cleanStr(body.whiskybaseUrl, 250);
    const note = cleanStr(body.note, 150);
    const rawSharedReviewKey = cleanStr(body.sharedReviewKey, 80);

    if (rawSharedReviewKey && !(await isValidItemId(rawSharedReviewKey))) {
      return NextResponse.json(
        { error: "연결할 원본 제품을 찾을 수 없습니다." },
        { status: 400 }
      );
    }

    // 명시적 연결 키가 없어도 같은 부스 내 동일 이름의 정적 항목이 있으면 자동 연결
    const sharedReviewKey =
      rawSharedReviewKey || findStaticReviewKeyByName(boothCode, name);

    // 정적 목록에 이미 같은 제품이 등록되어 있는지 확인 (0 Redis calls)
    const normName = normalizeItemName(name);
    const existingStaticList =
      kind === "bottle" ? targetBooth.bottles : targetBooth.tastings;
    const alreadyInStatic = existingStaticList.some(
      (item) =>
        normalizeItemName(item.name) === normName ||
        (sharedReviewKey ? getReviewKey(item.id) === sharedReviewKey : false)
    );
    if (alreadyInStatic) {
      return NextResponse.json(
        {
          error:
            kind === "bottle"
              ? "이미 판매 보틀 목록에 등록된 제품입니다."
              : "이미 시음 목록에 등록된 제품입니다.",
        },
        { status: 409 }
      );
    }

    if (whiskybaseUrl && !isValidWhiskybaseUrl(whiskybaseUrl)) {
      return NextResponse.json(
        { error: "Whiskybase URL만 입력할 수 있습니다. (https://www.whiskybase.com/...)" },
        { status: 400 }
      );
    }

    let price: number | undefined;
    let priceLabel: string | undefined;

    if (kind === "bottle") {
      const rawDigits = String(body.price ?? "").replace(/[^0-9]/g, "");
      if (!rawDigits) {
        price = -1; // 미입력: 가격 미정
      } else {
        const priceNum = Number(rawDigits);
        if (!Number.isFinite(priceNum) || priceNum < 0 || priceNum > 100_000_000) {
          return NextResponse.json(
            { error: "판매 보틀 가격을 올바른 숫자로 입력해 주세요." },
            { status: 400 }
          );
        }
        price = Math.round(priceNum); // 0이면 무료, 양수면 판매가
      }
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

    // 연결 항목(반대 목록 추가)의 동시 중복 생성 방지 (O(1) SETNX)
    if (sharedReviewKey) {
      const acquired = await acquireOppositeLinkLock(
        boothCode,
        kind,
        sharedReviewKey
      );
      if (!acquired) {
        const res = NextResponse.json(
          {
            error:
              kind === "bottle"
                ? "이미 판매 보틀 목록에 추가된 제품입니다."
                : "이미 시음 목록에 추가된 제품입니다.",
          },
          { status: 409 }
        );
        return attachUidCookie(res, uid, isNew);
      }
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
        peated,
        whiskybaseUrl,
        sharedReviewKey,
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
