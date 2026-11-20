import { NextResponse } from "next/server";
import { attachUidCookie, getOrCreateClientUid } from "@/lib/identity";
import { getBottleStatus, isValidItemId } from "@/lib/redis";

export async function GET(
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

    const { uid, isNew } = await getOrCreateClientUid();
    const status = await getBottleStatus(bottleId, uid);
    const res = NextResponse.json({ status });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("GET /api/bottles/[bottleId] error:", error);
    return NextResponse.json(
      { error: "상세 상태를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
