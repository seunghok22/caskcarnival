import { NextResponse } from "next/server";
import {
  attachUidCookie,
  getClientIp,
  getOrCreateClientUid,
} from "@/lib/identity";
import {
  cancelSoldOutVote,
  checkRelaxedIpRateLimit,
  isValidItemId,
  voteSoldOut,
} from "@/lib/redis";

export async function POST(
  _req: Request,
  context: { params: Promise<{ bottleId: string }> }
) {
  try {
    const { bottleId } = await context.params;
    if (!(await isValidItemId(bottleId))) {
      return NextResponse.json(
        { error: "존재하지 않는 항목입니다." },
        { status: 404 }
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
    const { alreadyVoted, status } = await voteSoldOut(bottleId, uid);

    if (alreadyVoted) {
      const res = NextResponse.json(
        { error: "이미 매진 제안을 하셨습니다.", status },
        { status: 409 }
      );
      return attachUidCookie(res, uid, isNew);
    }

    const res = NextResponse.json({ status });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("POST /api/bottles/[bottleId]/soldout error:", error);
    return NextResponse.json(
      { error: "매진 제안 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ bottleId: string }> }
) {
  try {
    const { bottleId } = await context.params;
    if (!(await isValidItemId(bottleId))) {
      return NextResponse.json(
        { error: "존재하지 않는 항목입니다." },
        { status: 404 }
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
    const { canceled, status } = await cancelSoldOutVote(bottleId, uid);

    if (!canceled) {
      const res = NextResponse.json(
        { error: "취소할 매진 제안 내역이 없습니다.", status },
        { status: 404 }
      );
      return attachUidCookie(res, uid, isNew);
    }

    const res = NextResponse.json({ status });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("DELETE /api/bottles/[bottleId]/soldout error:", error);
    return NextResponse.json(
      { error: "매진 제안 취소 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
