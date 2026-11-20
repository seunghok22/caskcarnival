import { NextResponse } from "next/server";
import { attachUidCookie, getOrCreateClientUid } from "@/lib/identity";
import { getMyReviews } from "@/lib/redis";

export async function GET() {
  try {
    const { uid, isNew } = await getOrCreateClientUid();
    const reviews = await getMyReviews(uid);
    const res = NextResponse.json({ reviews });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("GET /api/reviews/mine error:", error);
    return NextResponse.json(
      { error: "내 평가 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
