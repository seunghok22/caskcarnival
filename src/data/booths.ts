import type { Booth } from "@/types/festival";

export const BOOTHS: Booth[] = [
  {
    id: "booth-a1",
    code: "A-01",
    name: "하일랜드 & 스페이사이드 셀렉션",
    category: "스카치 싱글몰트",
    description: "셰리 캐스크 중심의 싱글몰트 시음 및 한정 보틀 판매 부스",
    mapPosition: { x: 22, y: 32 },
    tastings: [
      {
        id: "t-a1-1",
        name: "글렌알라키 12년",
        abv: "46%",
        note: "건포도, 다크 초콜릿, 꿀",
        priceLabel: "무료 시음 (10ml)",
      },
      {
        id: "t-a1-2",
        name: "글렌드로낙 18년 알라다이스",
        abv: "46%",
        note: "올로로소 셰리, 호두, 스파이스",
        priceLabel: "8,000원 (15ml)",
      },
    ],
    bottles: [
      {
        id: "b-a1-1",
        name: "글렌알라키 15년",
        distillery: "GlenAllachie",
        abv: "46%",
        volume: "700ml",
        price: 155000,
        note: "페드로 히메네즈 & 올로로소 셰리 캐스크",
      },
      {
        id: "b-a1-2",
        name: "글렌드로낙 캐스크 스트렝스 배치 12",
        distillery: "GlenDronach",
        abv: "58.2%",
        volume: "700ml",
        price: 210000,
        note: "풍부한 셰리 뉘앙스와 강렬한 바디감",
      },
    ],
  },
  {
    id: "booth-a2",
    code: "A-02",
    name: "아일라 피트 하우스",
    category: "피트 위스키",
    description: "강렬한 스모키함과 해양성 풍미를 자랑하는 아일라 위스키 전문 부스",
    mapPosition: { x: 74, y: 28 },
    tastings: [
      {
        id: "t-a2-1",
        name: "아드벡 10년",
        abv: "46%",
        note: "레몬 제스트, 훈연 베이컨, 에스프레소",
        priceLabel: "무료 시음 (10ml)",
      },
      {
        id: "t-a2-2",
        name: "옥토모어 14.1",
        abv: "59.6%",
        note: "강력한 피트, 바닐라, 구운 오크",
        priceLabel: "12,000원 (15ml)",
      },
    ],
    bottles: [
      {
        id: "b-a2-1",
        name: "라가불린 16년",
        distillery: "Lagavulin",
        abv: "43%",
        volume: "700ml",
        price: 145000,
        note: "묵직한 피트와 셰리의 클래식한 조화",
      },
      {
        id: "b-a2-2",
        name: "포트 샬롯 10년",
        distillery: "Bruichladdich",
        abv: "50%",
        volume: "700ml",
        price: 118000,
        note: "헤비 피트와 부드러운 몰트 단맛",
      },
    ],
  },
  {
    id: "booth-b1",
    code: "B-01",
    name: "켄터키 버번 & 라이",
    category: "아메리칸 위스키",
    description: "배럴 프루프 버번과 스파이시한 라이 위스키 라인업",
    mapPosition: { x: 28, y: 72 },
    tastings: [
      {
        id: "t-b1-1",
        name: "와일드 터키 레어 브리드",
        abv: "58.4%",
        note: "캐러멜, 오렌지 필, 구운 옥수수",
        priceLabel: "5,000원 (15ml)",
      },
      {
        id: "t-b1-2",
        name: "일라이저 크레이그 배럴 프루프",
        abv: "62.1%",
        note: "메이플 시럽, 다크 체리, 오크",
        priceLabel: "9,000원 (15ml)",
      },
    ],
    bottles: [
      {
        id: "b-b1-1",
        name: "블랜튼 싱글 배럴",
        distillery: "Buffalo Trace",
        abv: "46.5%",
        volume: "700ml",
        price: 175000,
        note: "바닐라, 흑설탕, 균형 잡힌 피니시",
      },
      {
        id: "b-b1-2",
        name: "미히터스 US*1 배럴 스트렝스 라이",
        distillery: "Michter's",
        abv: "55.1%",
        volume: "700ml",
        price: 195000,
        note: "후추, 버터스카치, 허브 스파이스",
      },
    ],
  },
  {
    id: "booth-b2",
    code: "B-02",
    name: "독립병입자 & 월드 캐스크",
    category: "독립병입 / 재패니즈",
    description: "싱글 캐스크 한정판과 희귀 독립병입 보틀을 만날 수 있는 부스",
    mapPosition: { x: 76, y: 70 },
    tastings: [
      {
        id: "t-b2-1",
        name: "카발란 솔리스트 비노 바리끄",
        abv: "57.8%",
        note: "열대과일, 와인 타닌, 크리미 바닐라",
        priceLabel: "10,000원 (15ml)",
      },
    ],
    bottles: [
      {
        id: "b-b2-1",
        name: "요이치 싱글몰트",
        distillery: "Nikka",
        abv: "45%",
        volume: "700ml",
        price: 138000,
        note: "은은한 피트, 멜론, 바닷바람",
      },
      {
        id: "b-b2-2",
        name: "시그나토리 벤 네비스 10년 CS",
        distillery: "Signatory Vintage",
        abv: "59.4%",
        volume: "700ml",
        price: 185000,
        note: "퍼스트 필 올로로소 셰리 버트",
      },
    ],
  },
];

export const ALL_BOTTLE_IDS = BOOTHS.flatMap((booth) =>
  booth.bottles.map((bottle) => bottle.id)
);
