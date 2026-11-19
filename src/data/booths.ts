import type { Booth, BoothZone, BottleItem, TastingItem } from "@/types/festival";
import boothItemsData from "./boothItems.json";

const BOOTH_ITEMS = boothItemsData as Record<
  string,
  { tastings: TastingItem[]; bottles: BottleItem[] }
>;

interface RawBoothDef {
  code: string;
  zone: BoothZone;
  name: string;
  nameEn: string;
  category: string;
  rect: { x: number; y: number; w: number; h: number };
}

const RAW_BOOTHS: RawBoothDef[] = [
  {
    code: "I",
    zone: "I",
    name: "인포메이션",
    nameEn: "Information",
    category: "행사 안내",
    rect: { x: 664, y: 605, w: 52, h: 55 },
  },
  {
    code: "A01",
    zone: "A",
    name: "택배 부스",
    nameEn: "Parcel Service",
    category: "편의 서비스",
    rect: { x: 865, y: 565, w: 55, h: 95 },
  },
  {
    code: "A02",
    zone: "A",
    name: "캐스크 카니발",
    nameEn: "CASK CARNIVAL",
    category: "공식 오피셜 부스",
    rect: { x: 865, y: 430, w: 55, h: 90 },
  },
  {
    code: "A03",
    zone: "A",
    name: "와옥위스키증류소",
    nameEn: "Waoak Distillery",
    category: "크래프트 증류소",
    rect: { x: 865, y: 350, w: 55, h: 45 },
  },
  {
    code: "A04",
    zone: "A",
    name: "원석위스키디스틸러리",
    nameEn: "WONSEOK WHISKY DISTILLERY",
    category: "크래프트 증류소",
    rect: { x: 865, y: 305, w: 55, h: 45 },
  },
  {
    code: "A05",
    zone: "A",
    name: "크래프트브로스",
    nameEn: "CRAFTBROS",
    category: "크래프트 주류 / 수입사",
    rect: { x: 865, y: 260, w: 55, h: 45 },
  },
  {
    code: "A06",
    zone: "A",
    name: "김창수위스키증류소",
    nameEn: "Kimchangsoo Distillery",
    category: "한국 싱글몰트 증류소",
    rect: { x: 865, y: 215, w: 55, h: 45 },
  },
  {
    code: "A07",
    zone: "A",
    name: "브루코리아",
    nameEn: "BrewKorea",
    category: "증류 / 발효 설비",
    rect: { x: 805, y: 140, w: 45, h: 55 },
  },
  {
    code: "A08",
    zone: "A",
    name: "봄내발효기술",
    nameEn: "Bomnae Fermentation",
    category: "발효 / 증류 기술",
    rect: { x: 760, y: 140, w: 45, h: 55 },
  },
  {
    code: "B01",
    zone: "B",
    name: "지자케씨와이코리아(주)",
    nameEn: "JIZAKE CY KOREA(JCK)",
    category: "일본 주류 / 위스키",
    rect: { x: 592, y: 140, w: 42, h: 55 },
  },
  {
    code: "B02",
    zone: "B",
    name: "치프위스키",
    nameEn: "Chief Whisky",
    category: "위스키 셀렉션",
    rect: { x: 550, y: 140, w: 42, h: 55 },
  },
  {
    code: "B03",
    zone: "B",
    name: "갓코가와 증류소",
    nameEn: "Gakkogawa Distillery",
    category: "일본 크래프트 증류소",
    rect: { x: 508, y: 140, w: 42, h: 55 },
  },
  {
    code: "B04",
    zone: "B",
    name: "드램 × 마르스 위스키",
    nameEn: "DRAM × MARS Whisky",
    category: "일본 싱글몰트 위스키",
    rect: { x: 466, y: 140, w: 42, h: 55 },
  },
  {
    code: "B05",
    zone: "B",
    name: "쿠주 증류소",
    nameEn: "Kuju Distillery",
    category: "일본 크래프트 증류소",
    rect: { x: 424, y: 140, w: 42, h: 55 },
  },
  {
    code: "B06",
    zone: "B",
    name: "카메다 증류소",
    nameEn: "Kameda Distillery",
    category: "일본 크래프트 증류소",
    rect: { x: 382, y: 140, w: 42, h: 55 },
  },
  {
    code: "B07",
    zone: "B",
    name: "사쿠라오 증류소",
    nameEn: "Sakurao Distillery",
    category: "일본 싱글몰트 & 진",
    rect: { x: 340, y: 140, w: 42, h: 55 },
  },
  {
    code: "C01",
    zone: "C",
    name: "추사",
    nameEn: "CHUSA",
    category: "한국 오크 숙성 브랜디",
    rect: { x: 268, y: 305, w: 42, h: 45 },
  },
  {
    code: "C02",
    zone: "C",
    name: "야마나시 유자사케 위스키 마시주",
    nameEn: "Masiju",
    category: "사케 / 위스키",
    rect: { x: 226, y: 305, w: 42, h: 45 },
  },
  {
    code: "C03",
    zone: "C",
    name: "(주)와이브라더스컴퍼니",
    nameEn: "Y.BROTHERS COMPANY",
    category: "주류 수입사",
    rect: { x: 184, y: 305, w: 42, h: 45 },
  },
  {
    code: "C04",
    zone: "C",
    name: "코아베스트",
    nameEn: "Corevest",
    category: "주류 수입사",
    rect: { x: 142, y: 305, w: 42, h: 45 },
  },
  {
    code: "C05",
    zone: "C",
    name: "한국 브랜디 협회",
    nameEn: "Korea Brandy Society",
    category: "브랜디 / 증류주",
    rect: { x: 268, y: 260, w: 42, h: 45 },
  },
  {
    code: "C06",
    zone: "C",
    name: "다농바이오",
    nameEn: "DANONG BIO",
    category: "한국 증류주 / 오크 숙성주",
    rect: { x: 226, y: 260, w: 42, h: 45 },
  },
  {
    code: "C07",
    zone: "C",
    name: "진맥 디스틸러리",
    nameEn: "JINMAC Distillery",
    category: "크래프트 증류소",
    rect: { x: 184, y: 260, w: 42, h: 45 },
  },
  {
    code: "C08",
    zone: "C",
    name: "화심주조",
    nameEn: "HWASIMJUJO",
    category: "전통주 / 증류주",
    rect: { x: 142, y: 260, w: 42, h: 45 },
  },
  {
    code: "C09",
    zone: "C",
    name: "위스키내비",
    nameEn: "WHISKYNAVI",
    category: "독립병입자 / 수입사",
    rect: { x: 226, y: 140, w: 84, h: 55 },
  },
  {
    code: "C10",
    zone: "C",
    name: "더 위스키테일즈",
    nameEn: "The WhiskyTales",
    category: "독립병입 / 위스키",
    rect: { x: 184, y: 140, w: 42, h: 55 },
  },
  {
    code: "C11",
    zone: "C",
    name: "구산 증류소",
    nameEn: "Gusan Distillery",
    category: "크래프트 증류소",
    rect: { x: 142, y: 140, w: 42, h: 55 },
  },
  {
    code: "C12",
    zone: "C",
    name: "위스키내비 EXCLUSIVE 판매",
    nameEn: "WHISKYNAVI EXCLUSIVE",
    category: "한정판 전용 판매 부스",
    rect: { x: 100, y: 140, w: 42, h: 55 },
  },
  {
    code: "D01",
    zone: "D",
    name: "더 위스키파인드",
    nameEn: "The WhiskyFind",
    category: "독립병입자",
    rect: { x: 508, y: 475, w: 42, h: 45 },
  },
  {
    code: "D02",
    zone: "D",
    name: "위스키에이지",
    nameEn: "WhiskyAGE",
    category: "독립병입자",
    rect: { x: 466, y: 475, w: 42, h: 45 },
  },
  {
    code: "D03",
    zone: "D",
    name: "스카치 몰트 위스키 소사이어티",
    nameEn: "THE SCOTCH MALT WHISKY SOCIETY",
    category: "SMWS 싱글 캐스크 클럽",
    rect: { x: 382, y: 475, w: 84, h: 45 },
  },
  {
    code: "D04",
    zone: "D",
    name: "스카웃드링크",
    nameEn: "Scout Drinks",
    category: "주류 수입 / 셀렉션",
    rect: { x: 508, y: 430, w: 42, h: 45 },
  },
  {
    code: "D05",
    zone: "D",
    name: "마오웨이키",
    nameEn: "Maoweiki Distillery",
    category: "크래프트 증류소",
    rect: { x: 466, y: 430, w: 42, h: 45 },
  },
  {
    code: "D06",
    zone: "D",
    name: "오마이위스키",
    nameEn: "OMyWhisky",
    category: "위스키 셀렉션",
    rect: { x: 424, y: 430, w: 42, h: 45 },
  },
  {
    code: "D07",
    zone: "D",
    name: "아시아팔레트",
    nameEn: "Asia Palate",
    category: "아시아 위스키 셀렉션",
    rect: { x: 382, y: 430, w: 42, h: 45 },
  },
  {
    code: "D08",
    zone: "D",
    name: "러더 Ltd.",
    nameEn: "Rudder Ltd.",
    category: "일본 독립병입자",
    rect: { x: 550, y: 305, w: 42, h: 45 },
  },
  {
    code: "D09",
    zone: "D",
    name: "앤트 인터내셔널",
    nameEn: "Ant International",
    category: "주류 수입사",
    rect: { x: 508, y: 305, w: 42, h: 45 },
  },
  {
    code: "D10",
    zone: "D",
    name: "위스키베이스",
    nameEn: "Whiskybase",
    category: "아카이브 & 독립병입",
    rect: { x: 466, y: 305, w: 42, h: 45 },
  },
  {
    code: "D11",
    zone: "D",
    name: "캐스크 트레이드",
    nameEn: "Cask Trade",
    category: "캐스크 & 독립병입",
    rect: { x: 424, y: 305, w: 42, h: 45 },
  },
  {
    code: "D12",
    zone: "D",
    name: "칸파이카이",
    nameEn: "Kanpaikai",
    category: "재패니즈 & 독립병입",
    rect: { x: 382, y: 305, w: 42, h: 45 },
  },
  {
    code: "D13",
    zone: "D",
    name: "코마스피 & 바 캠벨타운 로흐",
    nameEn: "KOMASPI & Bar Campbeltown Loch",
    category: "독립병입 & 위스키 바",
    rect: { x: 550, y: 260, w: 42, h: 45 },
  },
  {
    code: "D14",
    zone: "D",
    name: "디스틸러스셀렉트",
    nameEn: "Distillers Select",
    category: "위스키 수입사",
    rect: { x: 508, y: 260, w: 42, h: 45 },
  },
  {
    code: "D15",
    zone: "D",
    name: "티앤티 토야마",
    nameEn: "T&T Toyama",
    category: "일본 위스키 독립병입자",
    rect: { x: 466, y: 260, w: 42, h: 45 },
  },
  {
    code: "D16",
    zone: "D",
    name: "사부로마루",
    nameEn: "Saburomaru Distillery",
    category: "일본 헤비 피트 증류소",
    rect: { x: 424, y: 260, w: 42, h: 45 },
  },
  {
    code: "D17",
    zone: "D",
    name: "바 파크모어 & 바 쿨일라",
    nameEn: "Bar Parkmore & Bar Caol Ila",
    category: "스페셜티 위스키 바",
    rect: { x: 382, y: 260, w: 42, h: 45 },
  },
  {
    code: "E01",
    zone: "E",
    name: "서울효모방",
    nameEn: "Seoul Hyomobang",
    category: "크래프트 주류",
    rect: { x: 748, y: 475, w: 42, h: 45 },
  },
  {
    code: "E02",
    zone: "E",
    name: "오로드",
    nameEn: "OLOD",
    category: "크래프트 주류",
    rect: { x: 706, y: 475, w: 42, h: 45 },
  },
  {
    code: "E03",
    zone: "E",
    name: "진다이브",
    nameEn: "GIN DIVE",
    category: "크래프트 진 / 스피릿",
    rect: { x: 664, y: 475, w: 42, h: 45 },
  },
  {
    code: "E04",
    zone: "E",
    name: "테킬라 돈 나초",
    nameEn: "Tequila Don Nacho",
    category: "아가베 스피릿 / 테킬라",
    rect: { x: 622, y: 475, w: 42, h: 45 },
  },
  {
    code: "E05",
    zone: "E",
    name: "위오크",
    nameEn: "WEOAK",
    category: "오크 숙성 / 위스키",
    rect: { x: 748, y: 430, w: 42, h: 45 },
  },
  {
    code: "E06",
    zone: "E",
    name: "브라운보틀",
    nameEn: "Brown Bottle",
    category: "주류 수입 / 보틀샵",
    rect: { x: 706, y: 430, w: 42, h: 45 },
  },
  {
    code: "E07",
    zone: "E",
    name: "아일 오브 해리스",
    nameEn: "Isle of Harris",
    category: "스코틀랜드 아일랜드 증류소",
    rect: { x: 664, y: 430, w: 42, h: 45 },
  },
  {
    code: "E08",
    zone: "E",
    name: "이노베브",
    nameEn: "INNOBEV",
    category: "주류 수입사",
    rect: { x: 622, y: 430, w: 42, h: 45 },
  },
  {
    code: "E09",
    zone: "E",
    name: "아영 FBC",
    nameEn: "Ayoung FBC",
    category: "종합 주류 수입사",
    rect: { x: 748, y: 305, w: 42, h: 45 },
  },
  {
    code: "E10",
    zone: "E",
    name: "생 킬리안",
    nameEn: "St.Kilian",
    category: "독일 싱글몰트 증류소",
    rect: { x: 706, y: 305, w: 42, h: 45 },
  },
  {
    code: "E11",
    zone: "E",
    name: "티퍼레리",
    nameEn: "Tipperary",
    category: "아이리시 위스키",
    rect: { x: 664, y: 305, w: 42, h: 45 },
  },
  {
    code: "E12",
    zone: "E",
    name: "스페이스 컴퍼니 코리아",
    nameEn: "SPACE COMPANY KOREA",
    category: "주류 수입사",
    rect: { x: 748, y: 260, w: 42, h: 45 },
  },
  {
    code: "E13",
    zone: "E",
    name: "태평양조",
    nameEn: "Taepyung Brewing",
    category: "크래프트 양조 / 증류",
    rect: { x: 706, y: 260, w: 42, h: 45 },
  },
  {
    code: "E14",
    zone: "E",
    name: "비더블유아이코리아",
    nameEn: "BWI KOREA",
    category: "프리미엄 위스키 수입사",
    rect: { x: 664, y: 260, w: 42, h: 45 },
  },
  {
    code: "F01",
    zone: "F",
    name: "설하째",
    nameEn: "Seolhajae",
    category: "푸드 & 페어링",
    rect: { x: 268, y: 605, w: 42, h: 55 },
  },
  {
    code: "F02",
    zone: "F",
    name: "도심과 약과",
    nameEn: "DOSIMGWA YAKGWA",
    category: "디저트 & 위스키 페어링",
    rect: { x: 226, y: 605, w: 42, h: 55 },
  },
  {
    code: "F03",
    zone: "F",
    name: "더 더치 치즈앤모어",
    nameEn: "THE DUTCH CHEESE&MORE",
    category: "치즈 & 샤퀴테리 페어링",
    rect: { x: 184, y: 605, w: 42, h: 55 },
  },
  {
    code: "F04",
    zone: "F",
    name: "오뎅바 낫개",
    nameEn: "Oden Bar Natgae",
    category: "푸드 & 하이볼 페어링",
    rect: { x: 122, y: 605, w: 62, h: 55 },
  },
  {
    code: "F05",
    zone: "F",
    name: "위 브란치 쿠퍼리지",
    nameEn: "Wee Branch Cooperage",
    category: "오크 캐스크 쿠퍼리지",
    rect: { x: 100, y: 465, w: 42, h: 55 },
  },
  {
    code: "G01",
    zone: "G",
    name: "몬스터케이브",
    nameEn: "MonsterCave",
    category: "위스키 / 와인 셀렉션",
    rect: { x: 592, y: 605, w: 42, h: 55 },
  },
  {
    code: "G02",
    zone: "G",
    name: "피엔에스와인컴퍼니",
    nameEn: "PNS Wine Company",
    category: "주류 수입사",
    rect: { x: 550, y: 605, w: 42, h: 55 },
  },
  {
    code: "G03",
    zone: "G",
    name: "플러스보틀 & 진기 셀렉션",
    nameEn: "Plus Bottle & JINKI'S SELECTION",
    category: "보틀 셀렉션",
    rect: { x: 508, y: 605, w: 42, h: 55 },
  },
  {
    code: "G04",
    zone: "G",
    name: "한국버번위스키클럽",
    nameEn: "Korea Bourbon Whisk[e]y Club",
    category: "아메리칸 버번 & 라이",
    rect: { x: 466, y: 605, w: 42, h: 55 },
  },
  {
    code: "G05",
    zone: "G",
    name: "지에스티(주)",
    nameEn: "GST",
    category: "주류 / 글라스웨어",
    rect: { x: 424, y: 605, w: 42, h: 55 },
  },
  {
    code: "G06",
    zone: "G",
    name: "라벨제작소 (오늘의술)",
    nameEn: "Whiskylabel_kr",
    category: "커스텀 라벨 & 굿즈",
    rect: { x: 382, y: 605, w: 42, h: 55 },
  },
  {
    code: "G07",
    zone: "G",
    name: "윌로우드",
    nameEn: "WILLOW WOOD",
    category: "우드 크래프트 & 바웨어",
    rect: { x: 340, y: 605, w: 42, h: 55 },
  },
];

export const BOOTHS: Booth[] = RAW_BOOTHS.map((raw) => {
  const items = BOOTH_ITEMS[raw.code] ?? { tastings: [], bottles: [] };
  return {
    id: `booth-${raw.code.toLowerCase()}`,
    code: raw.code,
    zone: raw.zone,
    name: raw.name,
    nameEn: raw.nameEn,
    category: raw.category,
    description: `${raw.name} (${raw.nameEn})`,
    rect: raw.rect,
    tastings: items.tastings,
    bottles: items.bottles,
  };
});

export const ALL_BOTTLE_IDS = BOOTHS.flatMap((booth) =>
  booth.bottles.map((bottle) => bottle.id)
);

export const ALL_ITEM_IDS = BOOTHS.flatMap((booth) => [
  ...booth.tastings.map((tasting) => tasting.id),
  ...booth.bottles.map((bottle) => bottle.id),
]);

// 같은 부스 내에서 시음(tasting)과 판매 보틀(bottle)의 이름이 같으면
// 평점·한줄평 키(reviewKey)를 공유하고, 매진 상태는 각 항목 ID별로 독립 관리합니다.
const ITEM_REVIEW_KEY_MAP: Record<string, string> = {};
const REVIEW_KEY_GROUP_MAP: Record<string, string[]> = {};

for (const booth of BOOTHS) {
  const bottleByName = new Map<string, string>();
  for (const bottle of booth.bottles) {
    const norm = bottle.name.trim().toLowerCase();
    bottleByName.set(norm, bottle.id);
    ITEM_REVIEW_KEY_MAP[bottle.id] = bottle.id;
    REVIEW_KEY_GROUP_MAP[bottle.id] = [bottle.id];
  }

  for (const tasting of booth.tastings) {
    const norm = tasting.name.trim().toLowerCase();
    const matchedBottleId = bottleByName.get(norm);
    const reviewKey = matchedBottleId ?? tasting.id;
    ITEM_REVIEW_KEY_MAP[tasting.id] = reviewKey;
    if (!REVIEW_KEY_GROUP_MAP[reviewKey]) {
      REVIEW_KEY_GROUP_MAP[reviewKey] = [];
    }
    REVIEW_KEY_GROUP_MAP[reviewKey].push(tasting.id);
  }
}

export function getReviewKey(itemId: string): string {
  return ITEM_REVIEW_KEY_MAP[itemId] ?? itemId;
}

export function getSharedReviewItemIds(itemId: string): string[] {
  const key = getReviewKey(itemId);
  return REVIEW_KEY_GROUP_MAP[key] ?? [itemId];
}
