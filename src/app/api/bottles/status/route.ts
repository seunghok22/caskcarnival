import { NextResponse } from "next/server";
import { ALL_BOTTLE_IDS } from "@/data/booths";
import { attachUidCookie, getOrCreateClientUid } from "@/lib/identity";
import { getAllBottleStatuses } from "@/lib/redis";

export async function GET() {
  try {
    const { uid, isNew } = await getOrCreateClientUid();
    const statuses = await getAllBottleStatuses(ALL_BOTTLE_IDS, uid);
    const res = NextResponse.json({ statuses });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("GET /api/bottles/status error:", error);
    return NextResponse.json(
      { error: "상태를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
