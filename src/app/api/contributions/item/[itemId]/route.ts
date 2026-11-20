import { NextResponse } from "next/server";
import {
  attachUidCookie,
  getClientIp,
  getOrCreateClientUid,
} from "@/lib/identity";
import { checkRelaxedIpRateLimit, deleteCustomItem } from "@/lib/redis";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const ip = await getClientIp();
    if (!(await checkRelaxedIpRateLimit(ip))) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 }
      );
    }

    const { itemId } = await context.params;
    const { uid, isNew } = await getOrCreateClientUid();
    const result = await deleteCustomItem(itemId, uid);

    if (!result.deleted) {
      const status = result.reason === "forbidden" ? 403 : 404;
      const msg =
        result.reason === "forbidden"
          ? "본인이 추가한 제품만 삭제할 수 있습니다."
          : "존재하지 않는 제품입니다.";
      const res = NextResponse.json({ error: msg }, { status });
      return attachUidCookie(res, uid, isNew);
    }

    const res = NextResponse.json({ deleted: true, itemId });
    return attachUidCookie(res, uid, isNew);
  } catch (error) {
    console.error("DELETE /api/contributions/item/[itemId] error:", error);
    return NextResponse.json(
      { error: "제품 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
