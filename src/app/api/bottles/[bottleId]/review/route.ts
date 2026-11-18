import { NextResponse } from "next/server";
import { ALL_BOTTLE_IDS } from "@/data/booths";
import {
  attachUidCookie,
  getClientIp,
  getOrCreateClientUid,
} from "@/lib/identity";
import { addBottleReview, checkRelaxedIpRateLimit } from "@/lib/redis";

export async function POST(
  req: Request,
  context: { params: Promise<{ bottleId: string }> }
) {
  try {
    const { bottleId } = await context.params;
    if (!ALL_BOTTLE_IDS.includes(bottleId)) {
      return NextResponse.json(
        { error: "존재하지 않는 보틀입니다." },
        { status: 404 }
      );
    }

    const body = (await req.json()) as {
      rating?: unknown;
      comment?: unknown;
    };

    const rating = Number(body.rating);
    const comment =
      typeof body.comment === "string" ? body.comment.trim() : "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "평점은 1~5 사이의 정수여야 합니다." },
        { status: 400 }
      );
    }

    if (comment.length > 100) {
      return NextResponse.json(
        { error: "한줄평은 100자 이내로 작성해 주세요." },
        { status: 400 }
      );
    }

    const ip = await getClientIp();
    const allowed = await checkRelaxedIpRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    const { uid, isNew } = await getOrCreateClientUid();
    const { alreadyReviewed, status } = await addBottleReview(
      bottleId,
      uid,
      rating,
      comment
    );

    if (alreadyReviewed) {
      const res = NextResponse.json(
        { error: "이미 이 보틀에 평점 및 한줄평을 남기셨습니다.", status },
        { status: 409 }
      );
      return attachUidCookie(res, uid, isNew);
    }

    const res = NextResponse.json({ status });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("POST /api/bottles/[bottleId]/review error:", error);
    return NextResponse.json(
      { error: "평점 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
