const LOGIN_REQUIRED_MESSAGE = "상품 저장을 위해 로그인이 필요합니다.";

const calculators = {
  china: {
    title: "중국사입",
    formTitle: "중국사입",
    formulaTitle: "중국사입 계산기 입력 구조",
    points: ["제품 구매 원가", "환율 및 수량", "중국 내륙 운송비", "구매대행 수수료"],
  },
  "china-korea": {
    title: "중국→한국",
    formTitle: "중국→한국 물류",
    formulaTitle: "중국에서 한국까지 비용 입력 구조",
    points: ["LCL 부피", "사업자회원 LCL 운임", "통관 비용", "관세", "부가세"],
  },
  "korea-coupang": {
    title: "한국→쿠팡",
    formTitle: "한국→쿠팡 입고",
    formulaTitle: "쿠팡 입고 전 비용 입력 구조",
    points: ["파레트 기준 일반트럭 운송비", "박스 단위 작업비", "라벨 비용", "포장 및 기타 비용"],
  },
  coupang: {
    title: "쿠팡 소모 비용",
    formTitle: "쿠팡 소모 비용",
    formulaTitle: "쿠팡 판매 소모 비용 입력 구조",
    points: ["쿠팡수수료", "배송/광고/반품비", "기타 판매 소모 비용"],
  },
  final: {
    title: "최종 비용",
    formTitle: "최종 비용 요약",
    formulaTitle: "최종 비용 요약 구조",
    points: ["중국사입 총 비용", "중국→한국 물류 총 비용", "한국→쿠팡 입고 총 비용", "쿠팡 소모 비용 총액", "최종 예상 총 비용"],
  },
  marginCalculator: {
    title: "마진·판매가",
    formTitle: "마진·판매가 계산기",
    formulaTitle: "마진·판매가 계산 구조",
    points: ["판매가와 배송비 수입", "매입·배송·광고 비용", "플랫폼 수수료", "부가세", "목표 마진 판매가"],
  },
  purchaseCalculator: {
    title: "중국사입 원가",
    formTitle: "중국사입 원가 계산기",
    formulaTitle: "중국사입 원가 계산 구조",
    points: ["환율과 제품단가", "수량·중량·부피", "대행·카드 수수료", "운임·통관·세금", "제품별 매입단가"],
  },
  adBreakEvenCalculator: {
    title: "광고 손익분기",
    formTitle: "광고 손익분기 계산기",
    formulaTitle: "광고 손익분기 계산 구조",
    points: ["판매가와 총원가", "수수료와 부가세", "목표 마진", "ROAS·CPC·전환율", "허용 광고비"],
  },
  cashFlowCalculator: {
    title: "사입·정산 현금흐름",
    formTitle: "사입·정산 현금흐름 계산기",
    formulaTitle: "사입·정산 현금흐름 구조",
    points: ["월초 현금", "정산금과 기타 수입", "고정비", "변동비", "월말 잔액과 발주 가능금액"],
  },
};

const standaloneCalculatorByCategory = {
  margin: "marginCalculator",
  "china-purchase": "purchaseCalculator",
  "ad-break-even": "adBreakEvenCalculator",
  "agency-margin": "adBreakEvenCalculator",
  "cash-flow": "cashFlowCalculator",
};
const categoryByStandaloneCalculator = Object.fromEntries(
  Object.entries(standaloneCalculatorByCategory)
    .filter(([category]) => category !== "agency-margin")
    .map(([category, calculatorId]) => [calculatorId, category]),
);

const COUPANG_CATEGORY_PLACEHOLDER = "세부 카테고리 선택";
const coupangCommissionSourceLabel = "2019년 11월 25일 기준";
const coupangCommissionCategories = [
  ["가전디지털 > 기본 수수료", 7.8],
  ["가전디지털 > 게임 > 성인용게임(19)", 6.8],
  ["가전디지털 > 게임 > 휴대용게임", 6.8],
  ["가전디지털 > 게임 > PC게임", 6.8],
  ["가전디지털 > 게임 > TV/비디오게임", 6.8],
  ["가전디지털 > 냉난방가전 > 냉난방에어컨", 5.8],
  ["가전디지털 > 냉방가전 > 멀티형에어컨", 5.8],
  ["가전디지털 > 냉방가전 > 벽걸이형에어컨", 5.8],
  ["가전디지털 > 냉방가전 > 스탠드형에어컨", 5.8],
  ["가전디지털 > 냉방가전 > 이동식 스탠드형에어컨", 5.8],
  ["가전디지털 > 카메라/카메라용품 > 기타카메라", 6],
  ["가전디지털 > 카메라/카메라용품 > 디지털카메라", 5.8],
  ["가전디지털 > 카메라/카메라용품 > 초소형/히든카메라", 6],
  ["가전디지털 > 카메라/카메라용품 > 카메라렌즈", 5.8],
  ["가전디지털 > 카메라/카메라용품 > 캠코더/비디오카메라", 6],
  ["가전디지털 > 카메라/카메라용품 > DSLR/SLR카메라", 5.8],
  ["가전디지털 > 태블릿PC/액세서리 > 태블릿PC", 5],
  ["가전디지털 > 생활가전 > 냉장고", 5.8],
  ["가전디지털 > 생활가전 > 세탁기", 5.8],
  ["가전디지털 > 빔/스크린 > 빔/프로젝터", 5.8],
  ["가전디지털 > 영상가전 > 영상액세서리", 5.8],
  ["가전디지털 > 영상가전 > TV", 5.8],
  ["가전디지털 > 영상가전 > VTR/DVD플레이어", 5.8],
  ["가전디지털 > 컴퓨터/게임 > 컴퓨터", 5],
  ["가전디지털 > 컴퓨터주변기기 > 3D프린터", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 기타프린터", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 레이져복합기", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 레이져프린터", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 모니터", 4.5],
  ["가전디지털 > 컴퓨터주변기기 > 복사기", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 스캐너", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 잉크젯복합기", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 잉크젯프린터", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 포토프린터", 5.8],
  ["가전디지털 > 컴퓨터주변기기 > 마우스/키보드", 6.5],
  ["가전디지털 > 컴퓨터주변기기 > 유무선공유기", 6.5],
  ["가전디지털 > 컴퓨터주변기기 > 태블릿/노트북악세사리", 6.4],
  ["가전디지털 > 컴퓨터주변기기 > 기타", 6.4],
  ["가구/홈인테리어 > 기본 수수료", 10.8],
  ["도서 > 기본 수수료", 10.8],
  ["음반 > 기본 수수료", 10.8],
  ["문구/사무용품 > 기본 수수료", 10.8],
  ["문구/사무용품 > 문구/팬시용품 > 광학용품", 8.8],
  ["문구/사무용품 > 사무용지류 > 포토전용지", 7.8],
  ["출산/유아 > 기본 수수료", 10],
  ["출산/유아 > 기저귀/물티슈 > 기저귀크림/파우더", 9.8],
  ["출산/유아 > 영유아물티슈 > 영유아물티슈", 8.2],
  ["출산/유아 > 영유아식품", 7.8],
  ["출산/유아 > 분유 > 유아분유", 6.4],
  ["출산/유아 > 기저귀 > 배변훈련팬티", 6.4],
  ["출산/유아 > 기저귀 > 수영장기저귀", 6.4],
  ["출산/유아 > 기저귀 > 일회용기저귀", 6.4],
  ["출산/유아 > 기저귀 > 천기저귀", 6.4],
  ["스포츠/레저용품 > 기본 수수료", 10.8],
  ["스포츠/레저용품 > 골프용품 > 골프거리측정기/GPS", 7.6],
  ["스포츠/레저용품 > 골프용품 > 골프클럽", 7.6],
  ["스포츠/레저용품 > 골프용품 > 골프풀세트", 7.6],
  ["스포츠/레저용품 > 자전거용품 > 성인용자전거", 7.6],
  ["스포츠/레저용품 > 자전거용품 > 아동용자전거", 7.6],
  ["스포츠/레저용품 > 스포츠의류", 10.5],
  ["스포츠/레저용품 > 스포츠신발", 10.5],
  ["뷰티 > 기본 수수료", 9.6],
  ["생활용품 > 기본 수수료", 7.8],
  ["생활용품 > 의료위생/보조용품 > 금연용품(19)", 10.8],
  ["생활용품 > 의료위생/보조용품 > 기타금연/흡연용품", 10.8],
  ["생활용품 > 의료위생/보조용품 > 환자보조용품", 10],
  ["생활용품 > 의료위생/보조용품 > 흡연용품(19)", 10.8],
  ["생활용품 > 공구/철물/DIY > 건전지/충전기", 10.8],
  ["생활용품 > 공구/철물/DIY > 건축/도장재료", 10.8],
  ["생활용품 > 공구/철물 > 가스부품", 10.8],
  ["생활용품 > 공구/철물 > 공구세트", 10.8],
  ["생활용품 > 공구/철물 > 공구함", 10.8],
  ["생활용품 > 공구/철물 > 기타공구및철물용품", 10.8],
  ["생활용품 > 공구/철물 > 대공용품", 10.8],
  ["생활용품 > 공구/철물 > 목장갑", 10.8],
  ["생활용품 > 공구/철물 > 보호복/작업복", 10.8],
  ["생활용품 > 공구/철물 > 수공구", 10.8],
  ["생활용품 > 공구/철물 > 수도부품", 10.8],
  ["생활용품 > 공구/철물 > 안전용품", 10.8],
  ["생활용품 > 공구/철물 > 자물쇠/보조키/도어락", 10.8],
  ["생활용품 > 공구/철물 > 철물용품", 10.8],
  ["생활용품 > 공구/철물 > 측적용공구", 10.8],
  ["생활용품 > 조명/배선/전기코드류 > 손전등", 10.8],
  ["생활용품 > 조명/배선/전기코드류 > 전구", 10.8],
  ["생활용품 > 조명/배선/전기코드류 > 전선/브라켓", 10.8],
  ["생활용품 > 조명/배선/전기코드류 > LED패널", 10.8],
  ["생활용품 > 방향/탈취/살충제 > 모기퇴치용품", 10],
  ["생활용품 > 수납/정리잡화 > 기타가정용품", 10.8],
  ["생활용품 > 수납/정리잡화 > 수납/정리용품", 10.8],
  ["생활용품 > 수납/정리잡화 > 압축팩/커버", 10.8],
  ["생활용품 > 수납/정리잡화 > 옷걸이/벽걸이", 10.8],
  ["생활용품 > 안전용품 > 가정/생활안전용품", 10.8],
  ["생활용품 > 안전용품 > 안전사고방지용품", 10.8],
  ["생활용품 > 청소/세탁/욕실용품", 10.8],
  ["생활용품 > 해충퇴치용품 > 살충/방충용품", 10],
  ["생활용품 > 성인용품(19)", 9.6],
  ["생활용품 > 의료위생/보조용품 > 전자담배(19)", 10.8],
  ["식품 > 기본 수수료", 10.6],
  ["식품 > 영양제 > 유아건강식품", 7.6],
  ["식품 > 채소류 > 감자/고구마", 7.6],
  ["식품 > 신선식품 > 쌀/잡곡류", 5.8],
  ["식품 > 면/라면", 10.9],
  ["완구/취미 > 기본 수수료", 10.8],
  ["완구/취미 > RC완구 > RC드론/쿼드콥터", 7.8],
  ["자동차용품 > 기본 수수료", 10],
  ["자동차용품 > 차량정비용품 > 타이어용품", 9.6],
  ["자동차용품 > 차량정비용품 > 휠/휠악세서리", 9.6],
  ["자동차용품 > 차량용전자기기 > 경보기/스마트키", 7.8],
  ["자동차용품 > 차량용전자기기 > 스마트기기용품", 7.8],
  ["자동차용품 > 차량용전자기기 > 차량용음향기기", 7.8],
  ["자동차용품 > 차량용전자기기 > 후방카메라/감지기", 7.8],
  ["자동차용품 > 오토바이용품", 7.6],
  ["자동차용품 > 방향제/디퓨저 > 차량용방향제", 7.8],
  ["자동차용품 > 공기청정/방향/탈취 > 세정제/세정티슈", 7.8],
  ["자동차용품 > 공기청정/방향/탈취 > 탈취제/세정제", 7.8],
  ["자동차용품 > 차량가전용품 > 내비게이션", 6.8],
  ["자동차용품 > 차량가전용품 > 블랙박스", 6.8],
  ["자동차용품 > 차량가전용품 > 하이패스", 6.8],
  ["주방용품 > 기본 수수료", 10.8],
  ["주방용품 > 조리보조도구 > 제면기", 7.8],
  ["패션 > 기본 수수료", 10.5],
  ["패션 > 쥬얼리 > 순금/골드바/돌반지", 4],
  ["패션 > 패션의류", 10.5],
  ["패션 > 패션잡화", 10.5],
  ["반려/애완용품 > 기본 수수료", 10.8],
].map(([name, rate]) => ({
  label: `${name} (${rate}%)`,
  rate,
}));
const coupangCommissionCategoryOptions = [
  COUPANG_CATEGORY_PLACEHOLDER,
  ...coupangCommissionCategories.map(({ label }) => label),
];
const coupangSalesVatRateByType = {
  "일반 과세자": 10,
  "간이 과세자": 1.5,
  면세: 0,
};
const coupangCommissionRateByLabel = Object.fromEntries(
  coupangCommissionCategories.map(({ label, rate }) => [label, rate]),
);
const legacyCoupangCategoryMap = {
  "디지털/가전": "가전디지털 > 기본 수수료 (7.8%)",
  생활용품: "생활용품 > 기본 수수료 (7.8%)",
  주방용품: "주방용품 > 기본 수수료 (10.8%)",
  패션잡화: "패션 > 패션잡화 (10.5%)",
  식품: "식품 > 기본 수수료 (10.6%)",
  기타: COUPANG_CATEGORY_PLACEHOLDER,
};
const legacyCoupangFeeTypeMap = {
  "쿠팡 판매 수수료": "쿠팡수수료",
  "직접 입력": "쿠팡수수료",
};
const lclBusinessRate = {
  sourceLabel: "LCL화물 기본 운임표 수정본 기준",
  minCbm: 1,
  cargoBaseFreightKrw: 65000,
  ferryBaseFreightKrw: 78000,
  stepCbm: 0.1,
  stepPriceKrw: 9000,
  tableMaxCbm: 25,
  simpleExportClearanceKrw: 22000,
  formalExportClearanceKrw: 40000,
  originCertificateKrw: 35000,
  palletWrappingPerPalletKrw: 35000,
  coupangPalletWrappingPerPalletKrw: 30000,
  terminalFees: [
    { maxCbm: 2, feeKrw: 16000 },
    { maxCbm: 4, feeKrw: 26000 },
    { maxCbm: 6, feeKrw: 32000 },
    { maxCbm: 8, feeKrw: 36000 },
    { maxCbm: 12, feeKrw: 45000 },
    { maxCbm: 15, feeKrw: 55000 },
    { maxCbm: 20, feeKrw: 65000 },
    { maxCbm: 25, feeKrw: 80000 },
  ],
  itemFees: [
    { maxItems: 4, feeKrw: 0 },
    { maxItems: 6, feeKrw: 5500 },
    { maxItems: 10, feeKrw: 15000 },
    { maxItems: 20, feeKrw: 23000 },
    { maxItems: 25, feeKrw: 35000 },
  ],
};
const coupangInboundTruckRate = {
  sourceLabel: "쿠팡센터 입고 일반트럭 운송비 평균 참고",
  perPalletKrw: 30000,
  destination: "쿠팡 인천45센터",
};
const importSettlementRate = {
  sourceLabel: "수입 자금정산서 기준",
  sampleTaxableBaseKrw: 506703,
  sampleImportVatKrw: 50670,
  customsBrokerFeeKrw: 30000,
  customsBrokerVatRate: 10,
  customsBrokerVatKrw: 3000,
  sampleTotalKrw: 83670,
  sampleItem: "PET BATHTUB",
};

const defaultStages = {
  china: {
    customsExchangeRate: 197.27,
    vendorExchangeRate: 196.34,
    productUnitCny: 0,
    quantity: 0,
    totalWeightKg: 0,
    totalVolumeCbm: 0,
    chinaInlandFreightCny: 0,
    cardFeeRate: 0,
    otherPurchaseCostKrw: 0,
  },
  "china-korea": {
    shippingMethod: "LCL 화물선",
    lclVolumeCbm: 0,
    totalWeightKg: 0,
    internationalFreightKrw: 0,
    terminalTransportFeeKrw: 0,
    agencyServiceType: "배송대행 수수료",
    agencyRate: 0,
    exportClearanceType: "약식수출통관",
    exportClearanceFeeKrw: 0,
    itemCount: 1,
    itemAdditionalFeeKrw: 0,
    originCertificate: "없음",
    originCertificateFeeKrw: 0,
    palletWrapping: "파레트 없이",
    palletWrappingPalletCount: 0,
    palletWrappingFeeKrw: 0,
    customsClearanceFeeKrw: 0,
    extraCustomsFeeKrw: 0,
    dutyRate: 0,
    vatRate: 10,
    extraLogisticsKrw: 0,
  },
  "korea-coupang": {
    palletCount: 0,
    generalTruckFreightKrw: 0,
    domesticFreightKrw: 0,
    boxCount: 0,
    boxWorkFeeKrw: 0,
    labelFeePerBoxKrw: 0,
    packingFeePerBoxKrw: 0,
    otherInboundFeeKrw: 0,
  },
  coupang: {
    salePriceKrw: 0,
    shoppingMallFeeType: "쿠팡수수료",
    shoppingCategory: COUPANG_CATEGORY_PLACEHOLDER,
    coupangFeeRate: 0,
    fulfillmentSize: "사이즈 선택",
    outboundShippingFeeKrw: 0,
    salesVatType: "일반 과세자",
    salesVatRate: 10,
    adCostKrw: 0,
    returnCostKrw: 0,
    otherSellingFeeKrw: 0,
  },
  marginCalculator: {
    salePriceKrw: 0,
    shippingRevenueKrw: 0,
    purchaseCostKrw: 0,
    purchaseShippingKrw: 0,
    courierCostKrw: 0,
    packingCostKrw: 0,
    giftEtcCostKrw: 0,
    adCostKrw: 0,
    categoryFeeRate: 10,
    linkageFeeRate: 0,
    shippingFeeRate: 0,
    vatType: "일반 과세자",
    vatRate: 10,
    targetMarginRate: 20,
  },
  purchaseCalculator: {
    customsExchangeRate: 197.27,
    vendorExchangeRate: 196.34,
    productUnitCny: 0,
    quantity: 0,
    totalWeightKg: 0,
    totalVolumeCbm: 0,
    chinaInlandFreightCny: 0,
    agencyRate: 8,
    cardFeeRate: 0,
    expectedFreightKrw: 0,
    shippingMethod: "해상",
    customsClearanceFeeKrw: 0,
    taxableBaseKrw: 0,
    dutyRate: 0,
    vatRate: 10,
    originCertificate: "없음",
    originCertificateFeeKrw: 0,
    otherPurchaseCostKrw: 0,
  },
  adBreakEvenCalculator: {
    salePriceKrw: 0,
    unitCostKrw: 0,
    platformFeeRate: 10,
    vatType: "일반 과세자",
    vatRate: 10,
    targetMarginRate: 10,
    currentRoas: 0,
    cpcKrw: 0,
    conversionRate: 1,
    monthlyAdBudgetKrw: 0,
    expectedOrderCount: 0,
  },
  cashFlowCalculator: {
    beginningCashKrw: 0,
    settlementIncomeKrw: 0,
    otherIncomeKrw: 0,
    targetEndingCashKrw: 0,
    safetyCashKrw: 0,
    productPurchaseKrw: 0,
    logisticsCostKrw: 0,
    adCostKrw: 0,
    packingWorkCostKrw: 0,
    returnCsCostKrw: 0,
    payrollKrw: 0,
    rentKrw: 0,
    insuranceTaxKrw: 0,
    utilitiesKrw: 0,
    softwareKrw: 0,
    otherFixedCostKrw: 0,
    otherVariableCostKrw: 0,
  },
};

const defaultFinalSummary = {
  mode: "calculated",
  directTotals: {
    china: 0,
    "china-korea": 0,
    "korea-coupang": 0,
    coupang: 0,
  },
};

const stageSchemas = {
  china: {
    resultCards: [
      { label: "제품별 매입단가", key: "productUnitKrw", format: "currency", full: true },
      { label: "중국사입 총 비용 원화", key: "total", format: "currency" },
      { label: "중국사입 총 비용 위안화", key: "totalCny", format: "cny" },
    ],
    result: {
      primaryLabel: "제품별 매입단가",
      primaryKey: "productUnitKrw",
      secondaryLabel: "중국사입 총 비용",
      secondaryKey: "total",
    },
    fieldsets: [
      {
        legend: "환율",
        fields: [
          { key: "customsExchangeRate", label: "관세청 고시환율", unit: "원", inputmode: "decimal" },
          { key: "vendorExchangeRate", label: "업체 고시환율", unit: "원", inputmode: "decimal" },
        ],
      },
      {
        legend: "매입 및 운송",
        fields: [
          { key: "productUnitCny", label: "제품단가", unit: "¥" },
          { key: "productUnitKrw", label: "제품단가 원화", unit: "원", computed: true },
          { key: "quantity", label: "제품수량", unit: "EA" },
          { key: "totalWeightKg", label: "총 중량", unit: "KG" },
          { key: "totalVolumeCbm", label: "총 부피", unit: "CBM", inputmode: "decimal" },
          { key: "chinaInlandFreightCny", label: "중국 내륙 운송비", unit: "¥" },
          { key: "productPurchaseCny", label: "제품구매비용", unit: "¥", computed: true },
          { key: "productPurchaseKrw", label: "제품구매비용 원화", unit: "원", computed: true },
        ],
      },
      {
        legend: "사입 합계",
        fields: [
          { key: "cardFeeRate", label: "카드수수료", unit: "%" },
          { key: "cardFeeKrw", label: "카드수수료 비용", unit: "원", computed: true },
          { key: "otherPurchaseCostKrw", label: "기타 사입비", unit: "원" },
          { key: "total", label: "중국사입 총 비용 원화", unit: "원", computed: true },
          { key: "totalCny", label: "중국사입 총 비용 위안화", unit: "¥", computed: true, format: "decimal", decimals: 2 },
        ],
      },
    ],
  },
  "china-korea": {
    result: {
      primaryLabel: "LCL 해상운임 예상치",
      primaryKey: "internationalFreightKrw",
      secondaryLabel: "중국→한국 물류 총 비용",
      secondaryKey: "total",
    },
    fieldsets: [
      {
        legend: "운송",
        fields: [
          { key: "shippingMethod", label: "운송방법", unit: "", type: "select", options: ["LCL 화물선", "LCL 훼리선"] },
          { key: "lclVolumeCbm", label: "LCL 부피", unit: "CBM", inputmode: "decimal" },
          { key: "totalWeightKg", label: "총 중량", unit: "KG" },
          { key: "lclBillingCbm", label: "청구 부피", unit: "CBM", computed: true, format: "decimal" },
          { key: "internationalFreightKrw", label: "LCL 해상운임 예상치", unit: "원" },
          { key: "terminalTransportFeeKrw", label: "터미널 운송료 예상치", unit: "원" },
          { key: "taxableBaseKrw", label: "세금계산 기준금액", unit: "원", computed: true },
        ],
      },
      {
        legend: "대행 비용",
        fields: [
          {
            key: "agencyServiceType",
            label: "대행 방식",
            unit: "",
            type: "select",
            options: ["배송대행 수수료", "구매대행 수수료", "없음"],
          },
          { key: "agencyRate", label: "대행 수수료율", unit: "%" },
          { key: "agencyFeeKrw", label: "대행 수수료", unit: "원", computed: true },
        ],
      },
      {
        legend: "부대 비용",
        fields: [
          {
            key: "exportClearanceType",
            label: "수출통관 방식",
            unit: "",
            type: "select",
            options: ["약식수출통관", "정식수출통관"],
          },
          { key: "exportClearanceFeeKrw", label: "수출통관비", unit: "원" },
          { key: "itemCount", label: "품목 건수", unit: "건" },
          { key: "itemAdditionalFeeKrw", label: "품목 추가비", unit: "원" },
          {
            key: "originCertificate",
            label: "원산지증명서",
            unit: "",
            type: "select",
            options: ["없음", "원산지증명서"],
          },
          { key: "originCertificateFeeKrw", label: "원산지증명서 비용", unit: "원" },
          {
            key: "palletWrapping",
            label: "파레트/랩핑 방식",
            unit: "",
            type: "select",
            options: ["파레트 없이", "일반 파레트&랩핑", "쿠팡 파레트&랩핑"],
          },
          { key: "palletWrappingPalletCount", label: "파레트 수량", unit: "PLT", lockWhenNoPallet: true },
          { key: "palletWrappingFeeKrw", label: "파레트/랩핑 비용", unit: "원", lockWhenNoPallet: true },
          { key: "extraLogisticsKrw", label: "기타 물류비", unit: "원" },
        ],
      },
      {
        legend: "통관 및 세금",
        fields: [
          { key: "customsClearanceFeeKrw", label: "통관수수료 예상치", unit: "원" },
          { key: "customsClearanceFeeVatKrw", label: "통관수수료 부가세", unit: "원", computed: true },
          { key: "extraCustomsFeeKrw", label: "기타 통관비", unit: "원" },
          { key: "dutyRate", label: "관세율", unit: "%", lockWhenOriginCertificate: true },
          { key: "dutyKrw", label: "관세", unit: "원", computed: true },
          { key: "vatRate", label: "수입 부가세율", unit: "%" },
          { key: "vatKrw", label: "수입 부가세", unit: "원", computed: true },
          { key: "total", label: "중국→한국 물류 총 비용", unit: "원", computed: true, full: true },
        ],
      },
    ],
  },
  "korea-coupang": {
    result: {
      primaryLabel: "일반트럭 운송비 예상치",
      primaryKey: "generalTruckFreightKrw",
      secondaryLabel: "한국→쿠팡 입고 총 비용",
      secondaryKey: "total",
    },
    fieldsets: [
      {
        legend: "입고 수량",
        fields: [
          { key: "palletCount", label: "파레트 수량", unit: "PLT" },
          { key: "generalTruckFreightKrw", label: "일반트럭 운송비 예상치", unit: "원" },
          { key: "boxCount", label: "박스 수량", unit: "BOX" },
          { key: "domesticFreightKrw", label: "기타 국내 운송비", unit: "원" },
        ],
      },
      {
        legend: "작업 및 포장",
        fields: [
          { key: "boxWorkFeeKrw", label: "박스당 작업비", unit: "원" },
          { key: "labelFeePerBoxKrw", label: "박스당 라벨비", unit: "원" },
          { key: "packingFeePerBoxKrw", label: "박스당 포장재 비용", unit: "원" },
          { key: "otherInboundFeeKrw", label: "기타 입고비", unit: "원" },
          { key: "boxTotalKrw", label: "박스 작업 총 비용", unit: "원", computed: true },
          { key: "total", label: "한국→쿠팡 입고 총 비용", unit: "원", computed: true, full: true },
        ],
      },
    ],
  },
  coupang: {
    result: {
      primaryLabel: "쿠팡 수수료",
      primaryKey: "commissionKrw",
      secondaryLabel: "쿠팡 소모 비용 총액",
      secondaryKey: "total",
    },
    fieldsets: [
      {
        legend: "매출",
        fields: [
          { key: "salePriceKrw", label: "판매가", unit: "원" },
        ],
      },
      {
        legend: "쿠팡 비용",
        fields: [
          {
            key: "shoppingCategory",
            label: "세부 카테고리",
            unit: "",
            type: "select",
            options: coupangCommissionCategoryOptions,
          },
          { key: "coupangFeeRate", label: "쿠팡 수수료율", unit: "%" },
          { key: "commissionKrw", label: "쿠팡 수수료", unit: "원", computed: true },
        ],
      },
      {
        legend: "입출고 및 배송",
        fields: [
          {
            key: "fulfillmentSize",
            label: "입출고/배송 사이즈",
            unit: "",
            type: "select",
            options: ["사이즈 선택", "극소형", "소형", "중형", "대형", "특대형"],
          },
          { key: "outboundShippingFeeKrw", label: "출고/배송비", unit: "원" },
        ],
      },
      {
        legend: "부가세",
        fields: [
          {
            key: "salesVatType",
            label: "과세 유형",
            unit: "",
            type: "select",
            options: ["일반 과세자", "간이 과세자", "면세"],
          },
          { key: "salesVatRate", label: "예상부담률", unit: "%", lockWhenSalesVatExempt: true },
          { key: "salesVatKrw", label: "판매 부가세", unit: "원", computed: true },
          { key: "settlementAmount", label: "정산금액", unit: "원", computed: true },
        ],
      },
      {
        legend: "판매 소모 비용",
        fields: [
          { key: "adCostKrw", label: "광고비", unit: "원" },
          { key: "returnCostKrw", label: "반품비", unit: "원" },
          { key: "otherSellingFeeKrw", label: "기타 판매비", unit: "원" },
          { key: "total", label: "쿠팡 소모 비용 총액", unit: "원", computed: true, full: true },
        ],
      },
    ],
  },
  marginCalculator: {
    resultCards: [
      { label: "정산금액", key: "settlementAmount", format: "currency" },
      { label: "순이익", key: "netProfit", format: "currency", toneKey: "netProfit" },
      { label: "마진율", key: "marginRate", format: "percent", toneKey: "netProfit" },
      { label: "목표 마진 판매가", key: "targetSalePriceKrw", format: "currency" },
    ],
    fieldsets: [
      {
        legend: "매출",
        fields: [
          { key: "salePriceKrw", label: "판매가", unit: "원" },
          { key: "shippingRevenueKrw", label: "배송비 수입", unit: "원" },
        ],
      },
      {
        legend: "매입 및 운영비",
        fields: [
          { key: "purchaseCostKrw", label: "매입가격", unit: "원" },
          { key: "purchaseShippingKrw", label: "매입 운송비", unit: "원" },
          { key: "courierCostKrw", label: "택배비", unit: "원" },
          { key: "packingCostKrw", label: "포장비", unit: "원" },
          { key: "giftEtcCostKrw", label: "사은품/기타비", unit: "원" },
          { key: "adCostKrw", label: "광고비", unit: "원" },
          { key: "purchaseTotalKrw", label: "매입비 총합", unit: "원", computed: true },
        ],
      },
      {
        legend: "수수료 및 부가세",
        fields: [
          { key: "categoryFeeRate", label: "카테고리 수수료율", unit: "%" },
          { key: "linkageFeeRate", label: "연동 수수료율", unit: "%" },
          { key: "shippingFeeRate", label: "배송비 수수료율", unit: "%" },
          { key: "totalFeeKrw", label: "수수료 총액", unit: "원", computed: true },
          {
            key: "vatType",
            label: "부가세 유형",
            unit: "",
            type: "select",
            options: ["일반 과세자", "간이/면세"],
          },
          { key: "vatRate", label: "부가세율", unit: "%" },
          { key: "vatKrw", label: "예상 부가세", unit: "원", computed: true },
          { key: "targetMarginRate", label: "목표 마진율", unit: "%" },
          { key: "breakEvenSalePriceKrw", label: "손익분기 판매가", unit: "원", computed: true },
        ],
      },
    ],
  },
  purchaseCalculator: {
    resultCards: [
      { label: "제품별 매입단가", key: "unitPurchaseCostKrw", format: "currency" },
      { label: "총 매입예상비용", key: "totalExpectedCostKrw", format: "currency" },
      { label: "구매대행 총비용", key: "agencyTotalKrw", format: "currency" },
      { label: "세금/통관 총액", key: "taxAndCustomsTotalKrw", format: "currency" },
    ],
    fieldsets: [
      {
        legend: "환율",
        fields: [
          { key: "customsExchangeRate", label: "관세청 고시환율", unit: "원", inputmode: "decimal" },
          { key: "vendorExchangeRate", label: "업체 고시환율", unit: "원", inputmode: "decimal" },
        ],
      },
      {
        legend: "제품 및 사입",
        fields: [
          { key: "productUnitCny", label: "제품단가", unit: "¥" },
          { key: "productUnitKrw", label: "제품단가 원화", unit: "원", computed: true },
          { key: "quantity", label: "제품수량", unit: "EA" },
          { key: "totalWeightKg", label: "총 중량", unit: "KG" },
          { key: "totalVolumeCbm", label: "총 부피", unit: "CBM", inputmode: "decimal" },
          { key: "chinaInlandFreightCny", label: "중국 내륙 운송비", unit: "¥" },
          { key: "chinaInlandFreightKrw", label: "중국 내륙 운송비 원화", unit: "원", computed: true },
          { key: "productPurchaseKrw", label: "제품구매비용 원화", unit: "원", computed: true },
        ],
      },
      {
        legend: "대행 및 운임",
        fields: [
          { key: "agencyRate", label: "구매대행 수수료율", unit: "%" },
          { key: "agencyFeeKrw", label: "구매대행 비용", unit: "원", computed: true },
          { key: "cardFeeRate", label: "카드 수수료율", unit: "%" },
          { key: "cardFeeKrw", label: "카드 수수료", unit: "원", computed: true },
          {
            key: "shippingMethod",
            label: "운송방법",
            unit: "",
            type: "select",
            options: ["해상", "항공", "직접입력"],
          },
          { key: "expectedFreightKrw", label: "예상 운임비", unit: "원" },
          { key: "agencyTotalKrw", label: "구매대행 총비용", unit: "원", computed: true },
        ],
      },
      {
        legend: "통관 및 세금",
        fields: [
          { key: "taxableBaseKrw", label: "세금계산 기준금액", unit: "원" },
          { key: "customsClearanceFeeKrw", label: "통관비용", unit: "원" },
          {
            key: "originCertificate",
            label: "원산지증명서",
            unit: "",
            type: "select",
            options: ["없음", "원산지증명서"],
          },
          { key: "originCertificateFeeKrw", label: "원산지증명서 비용", unit: "원" },
          { key: "dutyRate", label: "관세율", unit: "%", lockWhenOriginCertificate: true },
          { key: "dutyKrw", label: "관세", unit: "원", computed: true },
          { key: "vatRate", label: "수입 부가세율", unit: "%" },
          { key: "importVatKrw", label: "수입 부가세", unit: "원", computed: true },
          { key: "otherPurchaseCostKrw", label: "기타 사입비", unit: "원" },
          { key: "totalExpectedCostKrw", label: "총 매입예상비용", unit: "원", computed: true, full: true },
        ],
      },
    ],
  },
  adBreakEvenCalculator: {
    resultCards: [
      { label: "주문당 허용 광고비", key: "allowableAdCostKrw", format: "currency", toneKey: "allowableAdCostKrw" },
      { label: "최소 ROAS", key: "breakEvenRoas", format: "percent", toneKey: "allowableAdCostKrw" },
      { label: "손익분기 CPC", key: "breakEvenCpcKrw", format: "currency", toneKey: "allowableAdCostKrw" },
      { label: "광고 후 예상 순이익", key: "monthlyProfitAfterAdKrw", format: "currency", toneKey: "monthlyProfitAfterAdKrw" },
      { label: "위험 상태", key: "riskStatus", format: "text", toneKey: "riskLevel" },
    ],
    fieldsets: [
      {
        legend: "상품 기준",
        fields: [
          { key: "salePriceKrw", label: "판매가", unit: "원" },
          { key: "unitCostKrw", label: "개당 총원가", unit: "원" },
          { key: "platformFeeRate", label: "플랫폼 수수료율", unit: "%" },
          {
            key: "vatType",
            label: "부가세 유형",
            unit: "",
            type: "select",
            options: ["일반 과세자", "간이/면세"],
          },
          { key: "vatRate", label: "부가세율", unit: "%" },
          { key: "targetMarginRate", label: "목표 마진율", unit: "%" },
          { key: "profitBeforeAdKrw", label: "광고 전 이익", unit: "원", computed: true },
        ],
      },
      {
        legend: "광고 지표",
        fields: [
          { key: "currentRoas", label: "현재 ROAS", unit: "%" },
          { key: "cpcKrw", label: "CPC", unit: "원" },
          { key: "conversionRate", label: "전환율", unit: "%" },
          { key: "monthlyAdBudgetKrw", label: "월 광고예산", unit: "원" },
          { key: "expectedOrderCount", label: "예상 주문수", unit: "건" },
          { key: "budgetExpectedOrders", label: "예산 기준 예상 주문수", unit: "건", computed: true },
          { key: "orderAdCostKrw", label: "주문당 광고비", unit: "원", computed: true },
        ],
      },
    ],
  },
  cashFlowCalculator: {
    resultCards: [
      { label: "월말 예상 잔액", key: "endingCashKrw", format: "currency", toneKey: "endingCashKrw" },
      { label: "목표 대비 차액", key: "targetGapKrw", format: "currency", toneKey: "targetGapKrw" },
      { label: "다음 발주 가능금액", key: "availablePurchaseBudgetKrw", format: "currency", toneKey: "availablePurchaseBudgetKrw" },
      { label: "고정비/변동비", key: "costRatioLabel", format: "text" },
      { label: "현금 상태", key: "cashStatus", format: "text", toneKey: "cashRiskLevel" },
    ],
    fieldsets: [
      {
        legend: "월초 및 수입",
        fields: [
          { key: "beginningCashKrw", label: "월초 시작 현금", unit: "원" },
          { key: "settlementIncomeKrw", label: "쇼핑몰 정산금", unit: "원" },
          { key: "otherIncomeKrw", label: "기타 수입", unit: "원" },
          { key: "targetEndingCashKrw", label: "목표 월말 잔액", unit: "원" },
          { key: "safetyCashKrw", label: "안전 현금 기준", unit: "원" },
          { key: "incomeTotalKrw", label: "수입 합계", unit: "원", computed: true },
        ],
      },
      {
        legend: "변동비",
        fields: [
          { key: "productPurchaseKrw", label: "상품매입비", unit: "원" },
          { key: "logisticsCostKrw", label: "국제/국내 물류비", unit: "원" },
          { key: "adCostKrw", label: "광고비", unit: "원" },
          { key: "packingWorkCostKrw", label: "포장/작업비", unit: "원" },
          { key: "returnCsCostKrw", label: "반품/CS 비용", unit: "원" },
          { key: "otherVariableCostKrw", label: "기타 변동비", unit: "원" },
          { key: "variableCostTotalKrw", label: "변동비 합계", unit: "원", computed: true },
        ],
      },
      {
        legend: "고정비",
        fields: [
          { key: "payrollKrw", label: "인건비", unit: "원" },
          { key: "rentKrw", label: "임차료", unit: "원" },
          { key: "insuranceTaxKrw", label: "4대보험/세금", unit: "원" },
          { key: "utilitiesKrw", label: "공과금/통신비", unit: "원" },
          { key: "softwareKrw", label: "솔루션 사용료", unit: "원" },
          { key: "otherFixedCostKrw", label: "기타 고정비", unit: "원" },
          { key: "fixedCostTotalKrw", label: "고정비 합계", unit: "원", computed: true },
          { key: "totalExpenseKrw", label: "총 지출", unit: "원", computed: true, full: true },
        ],
      },
    ],
  },
};

const fieldLookup = Object.fromEntries(
  Object.entries(stageSchemas).map(([stage, schema]) => [
    stage,
    Object.fromEntries(schema.fieldsets.flatMap((fieldset) => fieldset.fields.map((field) => [field.key, field]))),
  ]),
);

const chinaHelp = {
  customsExchangeRate: {
    eyebrow: "환율 기준",
    title: "관세청 고시환율",
    body: "통관·세금 기준을 잡을 때 참고하는 공식 환율입니다. 실제 사입 결제 환율과 분리해서 봐야 합니다.",
    points: ["공식 고시 기준", "관세·부가세 검토용", "업체 환율과 차이 비교"],
    formula: "세금 기준 검토: 세금계산 기준금액 × 관세청 고시환율",
    image: "customs",
  },
  vendorExchangeRate: {
    eyebrow: "결제 기준",
    title: "업체 고시환율",
    body: "구매대행 업체나 결제 업체가 적용하는 실제 결제 환율입니다. 현재 중국사입 원화 환산은 이 값을 우선 사용합니다.",
    points: ["실제 결제 기준", "제품단가 원화 환산", "중국 내륙 운송비 환산"],
    formula: "제품단가 원화 = 제품단가(¥) × 업체 고시환율",
    image: "vendor",
  },
  productUnitCny: {
    eyebrow: "제품 원가",
    title: "제품단가",
    body: "1688·타오바오 등 중국 상품 페이지에서 확인하는 개당 위안화 가격입니다.",
    points: ["개당 구매가", "수량과 곱해 구매비 계산", "원화 단가의 출발점"],
    formula: "제품구매비용(¥) = 제품단가(¥) × 제품수량",
    image: "price",
  },
  productUnitKrw: {
    eyebrow: "자동 환산",
    title: "제품단가 원화",
    body: "제품단가를 업체 고시환율로 환산한 개당 원화 비용입니다.",
    points: ["자동 계산값", "제품 1개 기준", "총 매입단가 판단용"],
    formula: "제품단가 원화 = 제품단가(¥) × 업체 고시환율",
    image: "price",
  },
  quantity: {
    eyebrow: "구매 수량",
    title: "제품수량",
    body: "이번 사입 건에서 구매할 총 제품 개수입니다. 제품구매비용과 단가 계산에 직접 반영됩니다.",
    points: ["EA 단위", "총 구매비 계산", "제품별 매입단가 기준"],
    formula: "제품구매비용 = 제품단가 × 제품수량",
    image: "quantity",
  },
  totalWeightKg: {
    eyebrow: "물류 참고값",
    title: "총 중량",
    body: "중국사입 단계에서는 참고값으로 받고, 이후 중국→한국 물류비 산정 기준으로 확장할 수 있는 값입니다.",
    points: ["KG 단위", "운임 산정 참고", "현재 중국사입 총액에는 미반영"],
    formula: "향후 운임 계산: 총 중량 × KG당 운임",
    image: "weight",
  },
  totalVolumeCbm: {
    eyebrow: "물류 참고값",
    title: "총 부피",
    body: "판매자에게 포장 후 전체 부피를 물어보고 입력하는 값입니다. 특히 해상·항공 운송비를 산정할 때 중량만큼 중요한 기준이 됩니다.",
    points: ["판매자에게 포장 부피 확인", "CBM 단위 입력", "중국→한국 운송비 산정 핵심값"],
    formula: "운송비 검토: 총 중량 + 총 부피(CBM)를 함께 비교",
    image: "volume",
  },
  chinaInlandFreightCny: {
    eyebrow: "중국 내 비용",
    title: "중국 내륙 운송비",
    body: "중국 판매처에서 배대지나 구매대행 창고까지 이동하는 현지 운송비입니다.",
    points: ["중국 내부 운송", "위안화 입력", "원화 자동 환산"],
    formula: "운송비 원화 = 중국 내륙 운송비(¥) × 업체 고시환율",
    image: "truck",
  },
  chinaInlandFreightKrw: {
    eyebrow: "자동 환산",
    title: "중국 내륙 운송비 원화",
    body: "중국 내륙 운송비를 업체 고시환율로 바꾼 값입니다.",
    points: ["자동 계산값", "중국사입 총 비용에 포함", "사입 단계 운송비"],
    formula: "운송비 원화 = 중국 내륙 운송비(¥) × 업체 고시환율",
    image: "truck",
  },
  productPurchaseCny: {
    eyebrow: "구매 총액",
    title: "제품구매비용",
    body: "제품단가와 수량을 곱한 위안화 기준 제품 구매 총액입니다.",
    points: ["자동 계산값", "위안화 총 구매액", "구매대행 수수료 기준"],
    formula: "제품구매비용(¥) = 제품단가(¥) × 제품수량",
    image: "invoice",
  },
  productPurchaseKrw: {
    eyebrow: "구매 총액",
    title: "제품구매비용 원화",
    body: "위안화 제품구매비용을 업체 고시환율로 환산한 원화 기준 구매 총액입니다.",
    points: ["자동 계산값", "원화 총 구매액", "중국사입 총 비용의 핵심"],
    formula: "제품구매비용 원화 = 제품구매비용(¥) × 업체 고시환율",
    image: "invoice",
  },
  agencyRate: {
    eyebrow: "대행 비용",
    title: "구매대행 수수료",
    body: "구매대행 업체가 구매 총액에 부과하는 비율입니다.",
    points: ["퍼센트 입력", "구매대행 비용 계산", "중국사입 총 비용에 포함"],
    formula: "구매대행 비용 = (제품구매비용 원화 + 내륙 운송비 원화) × 수수료율",
    image: "fee",
  },
  agencyFeeKrw: {
    eyebrow: "자동 계산",
    title: "구매대행 비용",
    body: "입력한 수수료율을 기준으로 계산된 구매대행 비용입니다.",
    points: ["자동 계산값", "구매대행 수수료 결과", "중국사입 총 비용에 포함"],
    formula: "구매대행 비용 = 기준금액 × 수수료율",
    image: "fee",
  },
  total: {
    eyebrow: "단계 합계",
    title: "중국사입 총 비용",
    body: "제품 구매비, 중국 내륙 운송비, 카드수수료, 기타 사입비를 합산한 중국사입 단계의 총액입니다. 구매대행·배송대행 수수료는 다음 중국→한국 단계에서 따로 계산합니다.",
    points: ["원화 총액", "위안화 환산 총액과 함께 확인", "다음 물류 단계의 기준값"],
    formula: "중국사입 총 비용 = 제품구매비용 원화 + 내륙 운송비 원화 + 카드수수료 + 기타 사입비",
    image: "total",
  },
  totalCny: {
    eyebrow: "단계 합계",
    title: "중국사입 총 비용 위안화",
    body: "중국사입 총 비용 원화 값을 적용 환율로 다시 환산한 위안화 기준 총액입니다. 실제 중국 결제액과 원화 부대비용의 환산값을 함께 보는 용도입니다.",
    points: ["위안화 기준 합계", "원화 총액과 함께 비교", "환율 입력값에 따라 변동"],
    formula: "중국사입 총 비용 위안화 = 중국사입 총 비용 원화 ÷ 적용 환율",
    image: "total",
  },
};

const fieldHelp = {
  china: chinaHelp,
  "china-korea": {
    shippingMethod: {
      eyebrow: "운송 방식",
      title: "운송방법",
      body: "현재 중국→한국 구간은 LCL 운송 기준으로 계산합니다. 화물선은 대체로 저렴하고, 훼리선은 일정이 빠를 수 있습니다.",
      points: ["화물선 기본 1CBM 65,000원", "훼리선 기본 1CBM 78,000원", "1CBM 초과 0.1CBM마다 9,000원"],
      formula: "LCL 해상운임 예상치 = 기본 1CBM 운임 + 추가 CBM 운임",
      image: "lclRate",
    },
    lclVolumeCbm: {
      eyebrow: "LCL 부피",
      title: "LCL 부피",
      body: "판매자나 포워더에게 포장 후 총 부피를 확인해 입력합니다. LCL은 중량보다 부피 1CBM 단위 과금이 핵심입니다.",
      points: ["1CBM = 1m × 1m × 1m", "상자는 최장면 기준 측정", "부피만으로 운임 산정"],
      formula: "청구 부피 = 입력 CBM을 요금표 구간으로 올림",
      image: "lclRate",
    },
    totalWeightKg: {
      eyebrow: "운송 참고값",
      title: "총 중량",
      body: "중국사입 단계에서 입력한 총 중량이 자동으로 넘어옵니다. 물류사 견적이나 항공 운임 검토 시 참고하는 값이며, 필요하면 이 단계에서 직접 수정할 수 있습니다.",
      points: ["앞 단계 값 자동 입력", "직접 수정 가능", "물류사 견적 참고"],
      formula: "총 중량 = 중국사입 단계 총 중량 기본 반영",
      image: "weight",
    },
    lclBillingCbm: {
      eyebrow: "청구 기준",
      title: "청구 부피",
      body: "최신 LCL 기본 운임표 기준으로 계산되는 청구 CBM입니다. 1CBM 이하 물량은 기본 1CBM 비용으로 봅니다.",
      points: ["1CBM 최소 구간", "1CBM 이후 0.1CBM 단위", "25CBM 초과는 별도 협의 필요"],
      formula: "1CBM 초과분은 0.1CBM 단위 올림",
      image: "lclRate",
    },
    internationalFreightKrw: {
      eyebrow: "국제 운임",
      title: "LCL 해상운임 최저가 기준 예상치",
      body: `${lclBusinessRate.sourceLabel}으로 먼저 입력되는 기준 예상치입니다. 실제 청구 운임은 중국발 해상운임지수와 업체 정책에 따라 변동되므로, 받은 견적이 있으면 직접 수정하세요.`,
      highlight: "기준 예상치: 화물선 1CBM 65,000원 / 훼리선 1CBM 78,000원 / 추가 0.1CBM당 9,000원",
      points: ["화물선 기본 65,000원", "훼리선 기본 78,000원", "추가 운임 0.1CBM당 9,000원"],
      formula: "예상치 = 기본 1CBM 운임 + max(청구CBM - 1CBM, 0) × 0.1CBM 단가",
      image: "lclRate",
    },
    terminalTransportFeeKrw: {
      eyebrow: "터미널 비용",
      title: "터미널 운송료 예상치",
      body: "입항 후 터미널에서 잡히는 운송료입니다. LCL 부피를 청구 CBM으로 올림한 뒤 구간표 기준 예상치를 먼저 넣어두지만, 터미널·포워더별 청구액이 다르면 직접 수정하세요.",
      highlight: "기준 예상치: 1~2CBM 16,000원 / 8~12CBM 45,000원 / 20~25CBM 80,000원",
      points: ["1~2CBM 16,000원", "8~12CBM 45,000원", "20~25CBM 80,000원", "세금 기준금액이 아니라 물류비에 포함"],
      formula: "터미널 운송료 = 청구 CBM 구간별 비용",
      image: "lclRate",
    },
    agencyServiceType: {
      eyebrow: "대행 비용",
      title: "대행 방식",
      body: "셀러가 이용하는 업체 구조에 따라 배송대행 수수료 또는 구매대행 수수료를 선택합니다. 대행을 쓰지 않거나 별도 청구가 없으면 없음으로 둡니다.",
      points: ["배송대행 수수료", "구매대행 수수료", "없음 선택 시 0원"],
      formula: "대행 수수료 = 중국사입 총 비용 × 대행 수수료율",
      image: "fee",
    },
    agencyRate: {
      eyebrow: "대행 비용",
      title: "대행 수수료율",
      body: "배송대행 또는 구매대행 업체가 청구하는 수수료율입니다. 중국사입 총 비용을 기준으로 예상 수수료를 계산합니다.",
      points: ["업체 요율 입력", "중국→한국 물류 총 비용에 포함", "없음 선택 시 계산 제외"],
      formula: "대행 수수료 = 중국사입 총 비용 × 대행 수수료율",
      image: "fee",
    },
    agencyFeeKrw: {
      eyebrow: "대행 비용",
      title: "대행 수수료",
      body: "선택한 대행 방식과 수수료율을 기준으로 계산된 비용입니다. 중국사입 단계가 아니라 중국→한국 물류 단계의 비용으로 합산합니다.",
      points: ["자동 계산값", "물류 단계 비용", "최종 비용에 합산"],
      formula: "대행 수수료 = 중국사입 총 비용 × 대행 수수료율",
      image: "fee",
    },
    exportClearanceType: {
      eyebrow: "수출 통관",
      title: "수출통관 방식",
      body: "중국 출고 단계에서 적용되는 수출통관 방식입니다. 기본은 약식수출통관 22,000원으로 계산합니다.",
      points: ["약식수출통관 22,000원", "정식수출통관 40,000원", "수입통관비와 별도"],
      formula: "수출통관비 = 선택한 통관 방식별 고정비",
      image: "lclRate",
    },
    exportClearanceFeeKrw: {
      eyebrow: "수출 통관",
      title: "수출통관비",
      body: "선택한 수출통관 방식에 따라 기준값을 먼저 넣어두는 비용입니다. 포워더나 대행업체의 실제 청구액이 있으면 직접 수정합니다.",
      highlight: "직접 수정 가능: 약식 22,000원 / 정식 40,000원은 기준 예상치입니다.",
      points: ["약식 22,000원", "정식 40,000원", "중국 출고 비용에 포함"],
      formula: "수출통관비 = 직접 입력값",
      image: "lclRate",
    },
    itemCount: {
      eyebrow: "품목 추가",
      title: "품목 건수",
      body: "품목 수가 많아질 때 적용되는 작업 비용을 계산하기 위한 값입니다. 1~4건은 무료입니다.",
      points: ["1~4건 무료", "5~6건 5,500원", "21~25건 35,000원"],
      formula: "품목 추가비 = 품목 건수 구간별 작업 비용",
      image: "lclRate",
    },
    itemAdditionalFeeKrw: {
      eyebrow: "품목 추가",
      title: "품목 추가비",
      body: "입력한 품목 건수에 따라 기준값을 먼저 넣어두는 작업 비용입니다. 업체가 품목 추가비를 다르게 청구하면 직접 수정합니다.",
      highlight: "직접 수정 가능: 5건부터 비용 발생 기준이며, 업체별 품목 작업비가 다를 수 있습니다.",
      points: ["5건부터 비용 발생", "25건 초과 별도 협의", "품목 수 기준 작업비"],
      formula: "품목 추가비 = 직접 입력값",
      image: "lclRate",
    },
    originCertificate: {
      eyebrow: "무관세 조건",
      title: "원산지증명서",
      body: "중국 원산지증명서를 발급받는 경우의 옵션입니다. 선택 시 기준 서류 비용을 먼저 넣고, 관세율은 0%로 고정해 무관세 기준으로 계산합니다.",
      highlight: "기준 예상치: 원산지증명서 발급비 35,000원. 업체 청구액이 다르면 비용 입력칸에서 직접 수정하세요.",
      points: ["원산지증명서 비용 35,000원", "선택 시 관세율 0% 고정", "수입 부가세 10%는 별도 계산"],
      formula: "원산지증명서 선택 = 서류비 추가 + 관세 0원",
      image: "lclRate",
    },
    originCertificateFeeKrw: {
      eyebrow: "무관세 조건",
      title: "원산지증명서 비용",
      body: "원산지증명서 발급을 선택하면 반영되는 서류 비용입니다. 기준값은 35,000원이지만 업체마다 다를 수 있으므로 실제 발급비가 있으면 직접 입력합니다.",
      highlight: "직접 수정 가능: 35,000원은 기준 예상치이며, 발급 대행업체·품목·서류 조건에 따라 달라질 수 있습니다.",
      points: ["미선택 0원", "선택 35,000원", "선택 시 관세 0원"],
      formula: "원산지증명서 비용 = 직접 입력값, 미선택 시 0원",
      image: "lclRate",
    },
    palletWrapping: {
      eyebrow: "선택 비용",
      title: "파레트/랩핑 방식",
      body: "파레트 없이 보낼 수 있는 물량이면 '파레트 없이'를 선택합니다. 파레트 작업이 필요한 경우에만 일반 또는 쿠팡 파레트&랩핑을 선택하고 수량을 입력합니다.",
      points: ["파레트 없이 0원", "일반 파레트&랩핑 1PLT당 35,000원", "쿠팡 파레트&랩핑 1PLT당 30,000원"],
      formula: "파레트/랩핑 비용 = 파레트 수량 × 선택 방식 단가",
      image: "lclRate",
    },
    palletWrappingPalletCount: {
      eyebrow: "선택 비용",
      title: "파레트 수량",
      body: "파레트 작업을 선택했을 때 몇 파레트로 작업할지 입력합니다. 파레트 없이 발송하면 이 값은 0으로 고정됩니다.",
      points: ["파레트 없이 선택 시 0PLT", "파레트 작업 선택 시 수량 입력", "쿠팡 파레트도 수량당 계산"],
      formula: "파레트/랩핑 비용 = 파레트 수량 × 단가",
      image: "lclRate",
    },
    palletWrappingFeeKrw: {
      eyebrow: "선택 비용",
      title: "파레트/랩핑 비용",
      body: "선택한 파레트 방식과 수량을 기준으로 먼저 넣어두는 비용입니다. 파레트 작업비와 랩핑비는 업체마다 달라질 수 있으므로 견적이 있으면 직접 수정합니다.",
      highlight: "직접 수정 가능: 일반 35,000원/PLT, 쿠팡 30,000원/PLT는 기준 예상치입니다.",
      points: ["파레트 없이 0원", "일반 35,000원 × PLT", "쿠팡 30,000원 × PLT"],
      formula: "파레트/랩핑 비용 = 직접 입력값",
      image: "lclRate",
    },
    extraLogisticsKrw: {
      eyebrow: "추가 물류",
      title: "기타 물류비",
      body: "표에 없는 추가 비용이나 별도 협의 비용을 입력합니다. 예를 들어 25CBM 초과 운송, 국내 파트너 포워딩 청구 비용, 특수 작업비가 여기에 해당합니다.",
      points: ["25CBM 초과 별도 협의", "국내 운송 실비", "기타 예외 비용"],
      formula: "중국→한국 물류 총 비용에 직접 합산",
      image: "lclRate",
    },
    taxableBaseKrw: {
      eyebrow: "세금 기준",
      title: "세금계산 기준금액",
      body: "수입 정산서의 과세금액에 해당하는 내부 기준값입니다. 관세와 수입 부가세를 계산하기 위한 값이며, 터미널 운송료와 통관수수료는 이 기준금액에는 넣지 않고 물류 총 비용에만 더합니다.",
      points: ["중국사입 총 비용 + LCL 해상운임", "관세·수입 부가세 계산 기준", "터미널 운송료는 총 비용에 별도 합산"],
      formula: "세금계산 기준금액 = 중국사입 총 비용 + LCL 해상운임 예상치",
      image: "taxBase",
    },
    customsClearanceFeeKrw: {
      eyebrow: "통관 비용",
      title: "통관수수료 예상치",
      body: `수입 자금정산서에 나온 통관수수료입니다. ${importSettlementRate.sourceLabel}으로 30,000원을 기준값으로 넣었지만, 관세사·포워더 청구액이 다르면 직접 수정합니다.`,
      highlight: "직접 수정 가능: 통관수수료 30,000원은 참고 정산서 기준 예상치입니다.",
      points: ["통관수수료 30,000원", "관세·수입 부가세와 별도", "수입 신고 대행 비용"],
      formula: "통관수수료 예상치 = 직접 입력값",
      image: "importSettlement",
    },
    customsClearanceFeeVatKrw: {
      eyebrow: "통관 비용",
      title: "통관수수료 부가세",
      body: "통관수수료 30,000원에 붙는 부가세입니다. 정산서에서는 3,000원으로 확인됩니다.",
      points: ["통관수수료 부가세 3,000원", "수입 부가세와 다른 항목", "통관 비용 총액에 포함"],
      formula: "통관수수료 부가세 = 통관수수료 × 10%",
      image: "importSettlement",
    },
    extraCustomsFeeKrw: {
      eyebrow: "통관 비용",
      title: "기타 통관비",
      body: "정산서 기준 통관수수료 외에 별도 청구된 통관 관련 비용이 있으면 입력합니다.",
      points: ["예외 통관 비용", "추가 서류·검사 비용", "직접 입력"],
      formula: "중국→한국 물류 총 비용에 직접 합산",
      image: "importSettlement",
    },
    dutyRate: {
      eyebrow: "관세 기준",
      title: "관세율",
      body: "상품 품목에 따라 적용되는 관세율입니다. 원산지증명서를 선택하면 중국 무관세 기준으로 보고 관세율을 0%로 고정합니다.",
      points: ["원산지증명서 선택 시 0%", "미선택 시 직접 입력", "수입 부가세는 별도 계산"],
      formula: "관세 = 세금계산 기준금액 × 관세율",
      image: "taxBase",
    },
    dutyKrw: {
      eyebrow: "자동 계산",
      title: "관세",
      body: "관세율을 세금계산 기준금액에 적용한 값입니다. 원산지증명서를 선택한 경우 0원으로 계산합니다.",
      points: ["원산지증명서 선택 시 0원", "미선택 시 관세율 반영", "물류 총액에 포함"],
      formula: "관세 = 세금계산 기준금액 × 관세율",
      image: "taxBase",
    },
    vatRate: {
      eyebrow: "부가세 기준",
      title: "수입 부가세율",
      body: "수입 단계에서 세금계산 기준금액에 적용되는 부가세율입니다. 정산서 예시는 과세금액 506,703원에 10%가 적용되어 50,670원이 나왔습니다.",
      points: ["정산서 기준 10%", "세금계산 기준금액에 적용", "관세가 있으면 관세 포함 후 계산"],
      formula: "수입 부가세 = (세금계산 기준금액 + 관세) × 10%",
      image: "importSettlement",
    },
    vatKrw: {
      eyebrow: "자동 계산",
      title: "수입 부가세",
      body: "수입 자금정산서에서 가장 크게 보이는 세금 항목입니다. 예시 정산서에서는 50,670원으로 확인됩니다.",
      points: ["과세금액 기준", "정산서 예시 50,670원", "통관수수료 부가세와 별도"],
      formula: "수입 부가세 = (세금계산 기준금액 + 관세) × 수입 부가세율",
      image: "importSettlement",
    },
    total: {
      eyebrow: "단계 합계",
      title: "중국→한국 물류 총 비용",
      body: "LCL 해상운임, 터미널 운송료, 수출통관비, 선택 작업비, 통관수수료, 관세, 수입 부가세를 모두 합산한 중국→한국 구간의 총 비용입니다.",
      points: ["터미널 운송료 포함", "통관수수료와 부가세 포함", "최종 비용 화면으로 전달"],
      formula: "물류 총 비용 = 해상운임 + 터미널 + 수출통관 + 선택비 + 수입통관 + 세금",
      image: "total",
    },
  },
  "korea-coupang": {
    palletCount: {
      eyebrow: "일반트럭",
      title: "파레트 수량",
      body: "입항 후 쿠팡센터까지 일반트럭으로 이동할 때의 파레트 수량입니다. 파레트 없이 보내는 경우 0으로 두고, 실제 배차 견적이 있으면 운송비를 직접 수정합니다.",
      points: ["파레트 단위 발송 시 입력", "파레트 없이 발송하면 0", "센터·거리·대기 조건에 따라 변동"],
      formula: "일반트럭 운송비 예상치 = 파레트 수량 × 30,000원",
      image: "incheonTruck",
    },
    generalTruckFreightKrw: {
      eyebrow: "운송 견적",
      title: "일반트럭 운송비 예상치",
      body: "쿠팡센터 입고용 일반트럭 운송비를 1파레트 평균 참고가로 먼저 계산합니다. 밀크런 기준이 아니며, 운송사 견적이 있으면 그 금액으로 직접 수정합니다.",
      highlight: "직접 수정 가능: 1파레트 평균 참고가는 약 30,000원입니다. 실제 청구액은 센터, 거리, 대기시간, 재배차 조건에 따라 달라질 수 있습니다.",
      points: ["1파레트 약 30,000원 기준", "VAT 포함 참고 단가", "밀크런 아님"],
      formula: "일반트럭 운송비 = 직접 입력값",
      image: "incheonTruck",
    },
    boxCount: {
      eyebrow: "입고 수량",
      title: "박스 수량",
      body: "쿠팡 물류센터로 입고할 박스 개수입니다. 박스당 작업비, 라벨비, 포장재 비용 계산의 기준이 됩니다.",
      points: ["BOX 단위", "작업비 계산 기준", "입고 준비 비용에 영향"],
      formula: "박스 작업 총 비용 = 박스 수량 × 박스당 비용",
      image: "box",
    },
    domesticFreightKrw: {
      eyebrow: "국내 운송",
      title: "기타 국내 운송비",
      body: "일반트럭 운송비 예상치 외에 추가로 발생하는 국내 운송비를 입력합니다. 재배차, 추가 상차지, 대기료, 별도 센터 이동비처럼 예외 비용을 넣는 자리입니다.",
      points: ["예외 운송비 입력", "일반트럭 예상치와 별도", "입고 총액에 직접 포함"],
      formula: "한국→쿠팡 입고 총 비용에 직접 합산",
      image: "incheonTruck",
    },
    boxWorkFeeKrw: {
      eyebrow: "작업 비용",
      title: "박스당 작업비",
      body: "검수, 분류, 합포장, 박스 정리처럼 박스 단위로 발생하는 작업비입니다.",
      points: ["BOX당 단가", "작업 대행비 입력", "박스 수량과 곱해 계산"],
      formula: "작업비 총액 = 박스 수량 × 박스당 작업비",
      image: "box",
    },
    labelFeePerBoxKrw: {
      eyebrow: "라벨 비용",
      title: "박스당 라벨비",
      body: "쿠팡 입고 라벨, 바코드 부착, 박스 식별 라벨 등에 드는 박스당 비용입니다.",
      points: ["BOX당 라벨 작업", "입고 준비 비용", "박스 수량과 곱해 계산"],
      formula: "라벨 총액 = 박스 수량 × 박스당 라벨비",
      image: "label",
    },
    packingFeePerBoxKrw: {
      eyebrow: "포장 비용",
      title: "박스당 포장재 비용",
      body: "박스, 테이프, 완충재, 재포장 등에 들어가는 박스당 포장재 비용입니다.",
      points: ["BOX당 포장재", "상품 파손 방지 비용", "박스 수량과 곱해 계산"],
      formula: "포장재 총액 = 박스 수량 × 박스당 포장재 비용",
      image: "box",
    },
    otherInboundFeeKrw: {
      eyebrow: "기타 입고",
      title: "기타 입고비",
      body: "예약 변경, 추가 검수, 보관, 예외 작업처럼 별도로 붙는 입고 전 비용입니다.",
      points: ["예외 비용 반영", "입고 준비 총액 보정", "직접 합산"],
      formula: "한국→쿠팡 입고 총 비용에 직접 합산",
      image: "inbound",
    },
    boxTotalKrw: {
      eyebrow: "자동 계산",
      title: "박스 작업 총 비용",
      body: "박스 수량과 박스당 작업·라벨·포장재 비용을 곱해 계산한 금액입니다.",
      points: ["자동 계산값", "박스 단위 비용 합계", "입고 총액의 핵심"],
      formula: "박스 작업 총 비용 = 박스 수량 × (작업비 + 라벨비 + 포장재 비용)",
      image: "box",
    },
    total: {
      eyebrow: "단계 합계",
      title: "한국→쿠팡 입고 총 비용",
      body: "일반트럭 운송비 예상치, 기타 국내 운송비, 박스 작업 총 비용, 기타 입고비를 합산한 쿠팡센터 입고 전 비용입니다.",
      points: ["최종 비용 화면으로 전달", "센터 입고 전 비용 합계", "상품별 실제 원가 보정"],
      formula: "입고 총 비용 = 일반트럭 운송비 + 기타 국내 운송비 + 박스 작업 총 비용 + 기타 입고비",
      image: "incheonTruck",
    },
  },
  coupang: {
    salePriceKrw: {
      eyebrow: "판매 기준",
      title: "판매가",
      body: "쿠팡에서 판매할 상품 가격입니다. 판매 수수료 계산의 기준값이 됩니다.",
      points: ["원화 판매가", "수수료 계산 기준", "마진 계산의 출발점"],
      formula: "쿠팡 수수료 = 판매가 × 수수료율",
      image: "sale",
    },
    shoppingCategory: {
      eyebrow: "수수료 기준",
      title: "세부 카테고리",
      body: `제공받은 쿠팡 판매수수료표(${coupangCommissionSourceLabel})를 선택지로 넣었습니다. 카테고리를 선택하면 기준 수수료율이 자동으로 입력됩니다.`,
      points: ["대/중/소분류 기준 선택", "수수료율 자동 입력", "필요 시 수수료율 직접 수정"],
      formula: "선택한 카테고리의 기준 수수료율 적용",
      image: "coupangFee",
    },
    coupangFeeRate: {
      eyebrow: "쿠팡수수료",
      title: "쿠팡 수수료율",
      body: `카테고리별로 적용되는 쿠팡 수수료율입니다. 현재 선택지는 제공받은 ${coupangCommissionSourceLabel} 표를 기준으로 구성했습니다.`,
      points: ["할인 판매가 기준", "포털 연동 비용 별도 부과 없음", "결제수수료 이중 부과 없음"],
      formula: "쿠팡 수수료 = 판매가 × 수수료율",
      image: "coupangFee",
    },
    commissionKrw: {
      eyebrow: "자동 계산",
      title: "쿠팡 수수료",
      body: "판매가와 쿠팡 수수료율을 기준으로 계산되는 판매 수수료입니다.",
      points: ["자동 계산값", "판매가 기준", "소모 비용 총액에 포함"],
      formula: "쿠팡 수수료 = 판매가 × 수수료율",
      image: "coupangFee",
    },
    outboundShippingFeeKrw: {
      eyebrow: "출고 비용",
      title: "출고/배송비",
      body: "판매 후 출고, 배송, 처리 과정에서 발생하는 비용입니다.",
      points: ["출고 처리 비용", "배송 관련 비용", "판매 후 차감 비용"],
      formula: "쿠팡 소모 비용 총액에 직접 합산",
      image: "rocket",
    },
    salesVatType: {
      eyebrow: "세금 기준",
      title: "과세 유형",
      body: "일반 과세자, 간이 과세자, 면세 여부에 따라 판매 부가세 예상 계산 방식이 달라집니다. 간이 과세자는 소매업 기준 예상부담률 1.5%를 기본값으로 둡니다.",
      points: ["일반 과세자 VAT 포함가 분리", "간이 과세자 소매업 예상부담률", "면세 0원 처리"],
      formula: "간이 과세자 예상치 = 판매가 × 예상부담률",
      image: "vat",
    },
    salesVatRate: {
      eyebrow: "세금 기준",
      title: "예상부담률",
      body: "판매 전 마진을 보기 위해 적용하는 예상 부담 비율입니다. 간이 과세자는 업종별 부가가치율과 매입 공제에 따라 실제 신고세액이 달라질 수 있습니다.",
      points: ["일반 과세자는 VAT 포함가 분리", "간이 과세자는 소매업 기준 예상부담률", "면세 선택 시 0%"],
      formula: "일반 = 판매가 × 10 / 110, 간이 = 판매가 × 예상부담률",
      image: "vat",
    },
    salesVatKrw: {
      eyebrow: "자동 계산",
      title: "판매 부가세",
      body: "선택한 과세 유형과 예상부담률로 계산한 판매 부가세 참고값입니다. 실제 세무 신고 확정액이 아니라 판매 전 마진 검토용 예상치입니다.",
      points: ["일반 과세자 VAT 포함가 분리", "간이 과세자 예상부담률 적용", "면세 0원"],
      formula: "판매 부가세 = 과세 유형별 예상 공식",
      image: "vat",
    },
    adCostKrw: {
      eyebrow: "판매 비용",
      title: "광고비",
      body: "상품 판매를 위해 집행하는 광고비입니다. 상품별 실제 마진을 볼 때 반드시 별도 반영해야 합니다.",
      points: ["상품별 광고 집행액", "마진 감소 요인", "판매 소모 비용에 포함"],
      formula: "쿠팡 소모 비용 총액에 직접 합산",
      image: "ad",
    },
    returnCostKrw: {
      eyebrow: "리스크 비용",
      title: "반품비",
      body: "반품, 교환, 회수, 재처리 등에 대비해 입력하는 비용입니다.",
      points: ["반품률 고려", "회수·재처리 비용", "마진 리스크 반영"],
      formula: "쿠팡 소모 비용 총액에 직접 합산",
      image: "return",
    },
    otherSellingFeeKrw: {
      eyebrow: "기타 판매",
      title: "기타 판매비",
      body: "플랫폼 외 작업비, CS 대응비, 판매 관련 잡비처럼 별도 분류가 어려운 비용을 입력합니다.",
      points: ["예외 비용 입력", "판매 비용 보정", "직접 합산"],
      formula: "쿠팡 소모 비용 총액에 직접 합산",
      image: "sale",
    },
    total: {
      eyebrow: "단계 합계",
      title: "쿠팡 소모 비용 총액",
      body: "쿠팡 수수료, 배송·광고·반품·기타 판매비를 모두 합산한 판매 후 소모 비용입니다.",
      points: ["최종 비용 화면으로 전달", "판매 후 차감 비용", "마진 판단 핵심"],
      formula: "소모 비용 총액 = 쿠팡 수수료 + 배송 + 광고 + 반품 + 기타",
      image: "sale",
    },
  },
  final: {
    china: {
      eyebrow: "최종 요약",
      title: "중국사입 총 비용",
      body: "중국사입 단계에서 입력한 제품 구매비, 중국 내륙 운송비, 카드수수료, 기타 사입비의 합계입니다. 구매대행·배송대행 수수료는 중국→한국 물류 단계에서 따로 합산합니다.",
      points: ["중국사입 단계 자동 연결", "원화/위안화 기준 확인", "제품 원가의 출발점"],
      formula: "중국사입 총 비용 = 제품구매비용 원화 + 내륙 운송비 원화 + 카드수수료 + 기타 사입비",
      image: "finalSummary",
    },
    "china-korea": {
      eyebrow: "최종 요약",
      title: "중국→한국 물류 총 비용",
      body: "국제 운임, 대행 수수료, 통관비, 관세, 부가세 등 수입 물류 단계에서 발생한 비용 합계입니다.",
      points: ["중국→한국 단계 자동 연결", "대행·수입 물류·세금 합계", "최종 예상 총 비용에 포함"],
      formula: "중국→한국 물류 총 비용 = 운임 + 대행 수수료 + 통관비 + 기타 물류비 + 관세 + 부가세",
      image: "shipping",
    },
    "korea-coupang": {
      eyebrow: "최종 요약",
      title: "한국→쿠팡 입고 총 비용",
      body: "입항 후 쿠팡센터까지의 일반트럭 운송비 예상치와 박스 작업 비용, 기타 입고비를 합산한 비용입니다.",
      points: ["한국→쿠팡 단계 자동 연결", "센터 입고 전 비용", "최종 예상 총 비용에 포함"],
      formula: "한국→쿠팡 입고 총 비용 = 일반트럭 운송비 + 박스 작업 총 비용 + 기타 입고비",
      image: "inbound",
    },
    coupang: {
      eyebrow: "최종 요약",
      title: "쿠팡 소모 비용 총액",
      body: "쿠팡 수수료, 배송비, 광고비, 반품비, 기타 판매비의 합계입니다. 최종 요약에서는 1개당 쿠팡 소모 비용에 중국사입 수량을 곱해 총액으로 보여줍니다.",
      points: ["쿠팡 소모 비용 단계 자동 연결", "수량 반영 총액", "최종 예상 총 비용에 포함"],
      formula: "쿠팡 소모 비용 총액 = 1개당 쿠팡 소모 비용 × 제품수량",
      image: "sale",
    },
    grand: {
      eyebrow: "최종 요약",
      title: "최종 예상 총비용",
      body: "중국사입부터 쿠팡 소모 비용까지 모든 구간의 합계를 더한 전체 예상 비용입니다. 쿠팡 소모 비용은 판매 수량을 반영한 총액으로 합산합니다.",
      points: ["4개 단계 합산", "수량 반영 총 비용", "총 예상마진 계산 기준"],
      formula: "최종 예상 총비용 = 중국사입 + 중국→한국 + 한국→쿠팡 + 쿠팡 소모 비용 총액",
      image: "finalSummary",
    },
  },
};

Object.assign(fieldHelp, {
  marginCalculator: {
    salePriceKrw: {
      eyebrow: "판매 기준",
      title: "판매가",
      body: "고객에게 실제로 판매할 상품 가격입니다. 수수료, 부가세, 마진율 계산의 출발점입니다.",
      points: ["상품 판매가 입력", "정산금액 기준", "목표 마진 판매가와 비교"],
      formula: "매출총합 = 판매가 + 배송비 수입",
      image: "sale",
    },
    shippingRevenueKrw: {
      eyebrow: "매출 보정",
      title: "배송비 수입",
      body: "고객에게 별도로 받는 배송비입니다. 무료배송이면 0원으로 둡니다.",
      points: ["배송비 별도 판매 시 입력", "매출총합에 포함", "배송비 수수료율 적용 가능"],
      formula: "매출총합 = 판매가 + 배송비 수입",
      image: "shipping",
    },
    purchaseCostKrw: {
      eyebrow: "매입 기준",
      title: "매입가격",
      body: "상품 1개를 확보하기 위해 들어간 기본 원가입니다. 사입 단가나 도매 매입가를 입력합니다.",
      points: ["개당 매입 원가", "순이익 차감", "부가세 계산 기준"],
      formula: "매입비 총합 = 매입가격 + 운영비",
      image: "invoice",
    },
    adCostKrw: {
      eyebrow: "판매 비용",
      title: "광고비",
      body: "상품 1개 판매를 위해 예상하는 광고비입니다. 광고비를 빼지 않으면 실제 마진이 과대평가됩니다.",
      points: ["주문당 광고비 입력", "순이익에서 차감", "손익분기 판단"],
      formula: "순이익 = 정산금액 - 매입비 총합 - 부가세",
      image: "ad",
    },
    categoryFeeRate: {
      eyebrow: "플랫폼 수수료",
      title: "카테고리 수수료율",
      body: "쿠팡, 스마트스토어 등 쇼핑몰이 판매가에 적용하는 기본 판매 수수료율입니다.",
      points: ["판매가 기준", "카테고리마다 다름", "필요하면 직접 수정"],
      formula: "카테고리 수수료 = 판매가 × 수수료율",
      image: "fee",
    },
    vatType: {
      eyebrow: "세금 기준",
      title: "부가세 유형",
      body: "일반 과세자는 예상 부가세를 계산하고, 간이/면세는 0원 기준으로 단순 계산합니다.",
      points: ["일반 과세자 기준 계산", "간이/면세는 0원", "실제 신고는 세무 기준 확인"],
      formula: "예상 부가세 = max(매출총합 - 매입가격, 0) × 부가세율 / (100 + 부가세율)",
      image: "vat",
    },
    targetMarginRate: {
      eyebrow: "판매가 역산",
      title: "목표 마진율",
      body: "원하는 마진율을 넣으면 필요한 최소 판매가를 역산합니다.",
      points: ["목표 수익률", "판매가 역산", "가격 전략 기준"],
      formula: "목표 마진 판매가를 반복 계산으로 역산",
      image: "total",
    },
  },
  purchaseCalculator: {
    customsExchangeRate: chinaHelp.customsExchangeRate,
    vendorExchangeRate: chinaHelp.vendorExchangeRate,
    productUnitCny: chinaHelp.productUnitCny,
    quantity: chinaHelp.quantity,
    totalWeightKg: chinaHelp.totalWeightKg,
    totalVolumeCbm: chinaHelp.totalVolumeCbm,
    chinaInlandFreightCny: chinaHelp.chinaInlandFreightCny,
    agencyRate: chinaHelp.agencyRate,
    cardFeeRate: {
      eyebrow: "결제 비용",
      title: "카드 수수료율",
      body: "해외 결제나 구매대행 결제 과정에서 붙는 카드 수수료율입니다.",
      points: ["제품구매비용 기준", "개당 원가에 반영", "업체별 수수료 확인"],
      formula: "카드 수수료 = 제품구매비용 원화 × 카드 수수료율",
      image: "fee",
    },
    expectedFreightKrw: {
      eyebrow: "운임",
      title: "예상 운임비",
      body: "중국에서 한국까지 이동하는 예상 운임비입니다. 물류사 견적이 있으면 직접 입력합니다.",
      points: ["해상/항공 견적 입력", "총 매입예상비용에 포함", "실제 청구액과 다를 수 있음"],
      formula: "총 매입예상비용에 예상 운임비 합산",
      image: "shipping",
    },
    shippingMethod: {
      eyebrow: "운송 방식",
      title: "운송방법",
      body: "해상, 항공, 직접입력 중 선택합니다. 현재 운임은 직접 입력값을 기준으로 합산합니다.",
      points: ["해상은 저렴한 편", "항공은 빠른 편", "운임비는 직접 입력"],
      formula: "예상 운임비 = 입력 금액",
      image: "shipping",
    },
    taxableBaseKrw: {
      eyebrow: "세금 기준",
      title: "세금계산 기준금액",
      body: "관세와 수입 부가세를 계산할 때 쓰는 기준 금액입니다. 모르면 제품구매비와 운임을 기준으로 임시 산정할 수 있습니다.",
      points: ["수입 신고 기준", "관세 계산 기준", "부가세 계산 기준"],
      formula: "관세 = 세금계산 기준금액 × 관세율",
      image: "taxBase",
    },
    originCertificate: fieldHelp["china-korea"].originCertificate,
    dutyRate: fieldHelp["china-korea"].dutyRate,
    vatRate: fieldHelp["china-korea"].vatRate,
    totalExpectedCostKrw: {
      eyebrow: "총 원가",
      title: "총 매입예상비용",
      body: "구매대행 총비용, 운임, 통관비, 관세, 수입 부가세, 기타 사입비를 합친 총액입니다.",
      points: ["제품별 매입단가 기준", "마진 계산 연결", "판매가 결정 전 확인"],
      formula: "총 매입예상비용 = 대행 총비용 + 운임 + 통관/세금 + 기타비",
      image: "total",
    },
  },
  adBreakEvenCalculator: {
    salePriceKrw: {
      eyebrow: "판매 기준",
      title: "판매가",
      body: "광고 효율을 계산할 상품 판매가입니다. ROAS와 허용 광고비의 기준이 됩니다.",
      points: ["상품 판매가", "ROAS 기준", "광고비 허용 한도 계산"],
      formula: "최소 ROAS = 판매가 / 허용 광고비 × 100",
      image: "sale",
    },
    unitCostKrw: {
      eyebrow: "원가 기준",
      title: "개당 총원가",
      body: "사입비, 물류비, 포장비 등 상품 1개 판매에 들어간 총 원가입니다.",
      points: ["개당 원가", "광고 전 이익 계산", "낮게 잡으면 위험"],
      formula: "광고 전 이익 = 판매가 - 총원가 - 수수료 - 부가세",
      image: "invoice",
    },
    targetMarginRate: {
      eyebrow: "목표 수익",
      title: "목표 마진율",
      body: "광고비를 쓰고도 남기고 싶은 최소 마진율입니다.",
      points: ["목표 순이익 계산", "허용 광고비 차감", "보수적으로 입력"],
      formula: "목표 순이익 = 판매가 × 목표 마진율",
      image: "total",
    },
    currentRoas: {
      eyebrow: "광고 지표",
      title: "현재 ROAS",
      body: "현재 광고 성과가 있다면 입력합니다. 최소 ROAS와 비교해 안전/주의/손실을 판단합니다.",
      points: ["현재 광고 성과", "최소 ROAS와 비교", "0이면 비교 생략"],
      formula: "ROAS = 매출 / 광고비 × 100",
      image: "ad",
    },
    cpcKrw: {
      eyebrow: "광고 지표",
      title: "CPC",
      body: "광고 클릭 1회당 비용입니다. 전환율과 함께 주문당 광고비를 계산합니다.",
      points: ["클릭당 비용", "전환율과 함께 판단", "손익분기 CPC와 비교"],
      formula: "주문당 광고비 = CPC / 전환율",
      image: "ad",
    },
    conversionRate: {
      eyebrow: "전환율",
      title: "전환율",
      body: "광고 클릭 중 실제 주문으로 이어지는 비율입니다.",
      points: ["1%면 100클릭 중 1건", "CPC 허용치 계산", "초보자는 보수적으로 입력"],
      formula: "손익분기 CPC = 허용 광고비 × 전환율",
      image: "ad",
    },
  },
  cashFlowCalculator: {
    beginningCashKrw: {
      eyebrow: "현금 기준",
      title: "월초 시작 현금",
      body: "해당 월을 시작할 때 보유한 현금입니다. 지난달 말일 잔액으로 보면 됩니다.",
      points: ["월초 잔액", "현금흐름 시작점", "월말 잔액 계산"],
      formula: "월말 예상 잔액 = 월초 현금 + 수입 - 지출",
      image: "total",
    },
    settlementIncomeKrw: {
      eyebrow: "수입",
      title: "쇼핑몰 정산금",
      body: "이번 달 들어올 것으로 예상되는 쿠팡, 스마트스토어 등 쇼핑몰 정산금입니다.",
      points: ["정산 예정금", "수입 합계 포함", "정산 지연 주의"],
      formula: "수입 = 쇼핑몰 정산금 + 기타 수입",
      image: "sale",
    },
    productPurchaseKrw: {
      eyebrow: "변동비",
      title: "상품매입비",
      body: "이번 달 사입 또는 추가 발주에 쓸 상품 매입비입니다.",
      points: ["재고 확보 비용", "현금 유출 핵심", "발주 가능금액 판단"],
      formula: "변동비 = 매입비 + 물류비 + 광고비 + 작업비",
      image: "invoice",
    },
    logisticsCostKrw: {
      eyebrow: "변동비",
      title: "국제/국내 물류비",
      body: "국제 운임, 국내 운송, 쿠팡 입고 관련 물류비를 합산해 입력합니다.",
      points: ["물류비 합산", "현금 유출", "정산 전 선결제 가능"],
      formula: "변동비에 물류비 합산",
      image: "shipping",
    },
    payrollKrw: {
      eyebrow: "고정비",
      title: "인건비",
      body: "매출과 상관없이 매월 고정적으로 나가는 인건비입니다.",
      points: ["고정비", "월말 잔액 차감", "현금 부족 위험 판단"],
      formula: "고정비 = 인건비 + 임차료 + 보험/세금 + 기타 고정비",
      image: "fee",
    },
    safetyCashKrw: {
      eyebrow: "안전 기준",
      title: "안전 현금 기준",
      body: "월말에 반드시 남겨두고 싶은 최소 현금입니다. 다음 발주 가능금액 계산에 사용합니다.",
      points: ["비상금 기준", "발주 가능금액 차감", "현금 부족 경고"],
      formula: "다음 발주 가능금액 = 월말 예상 잔액 - 안전 현금 기준",
      image: "total",
    },
  },
});

const bannerGrid = document.querySelector(".banner-grid");
const overviewSection = document.querySelector(".overview-section");
const seoSection = document.querySelector(".seo-content-section");
const homeGuideStrip = document.querySelector(".home-guide-strip");
const homeQuickCalculator = document.querySelector("#quick-home-calculator");
const homeSeoExplainSection = document.querySelector(".home-seo-explain-section");
const workspace = document.querySelector(".workspace");
const sessionBar = document.querySelector(".session-bar");
const comingSoonSection = document.querySelector("#coming-soon-section");
const comingSoonTitle = document.querySelector("#coming-soon-title");
const comingSoonDescription = document.querySelector("#coming-soon-description");
const introSection = document.querySelector(".intro");
const resultCard = document.querySelector(".result-card");
const resultRows = document.querySelectorAll(".result-row");
const mockForm = document.querySelector("#stage-form");
const finalSummaryPanel = document.querySelector(".final-summary-panel");
const activeTitle = document.querySelector("#active-title");
const formTitle = document.querySelector("#form-title");
const stageSummary = document.querySelector("#stage-summary");
const formulaTitle = document.querySelector("#formula-title");
const formulaList = document.querySelector("#formula-list");
const previewVisual = document.querySelector(".preview-visual");
const formulaCard = document.querySelector(".formula-card");
const quickSwitch = document.querySelector(".quick-switch");
const quickSwitchButtons = document.querySelectorAll(".quick-switch button");
const homeButton = document.querySelector("#home-button");
const headerAccountBox = document.querySelector(".header-account-box");
const productNameInput = document.querySelector("#product-name");
const savedProductsSelect = document.querySelector("#saved-products");
const saveProductButton = document.querySelector("#save-product-button");
const loadProductButton = document.querySelector("#load-product-button");
const newProductButton = document.querySelector("#new-product-button");
const saveStatus = document.querySelector("#save-status");
const savedProductsCount = document.querySelector("#saved-products-count");
const savedListToggle = document.querySelector("#saved-list-toggle");
const savedListToggleCount = document.querySelector("#saved-list-toggle-count");
const savedProductsList = document.querySelector("#saved-products-list");
const productModeStatus = document.querySelector("#product-mode-status");
const saveToast = document.querySelector("#save-toast");
const saveToastTitle = document.querySelector("#save-toast-title");
const saveToastMessage = document.querySelector("#save-toast-message");
const saveConfirm = document.querySelector("#save-confirm");
const saveConfirmEyebrow = document.querySelector("#save-confirm-eyebrow");
const saveConfirmTitle = document.querySelector("#save-confirm-title");
const saveConfirmMessage = document.querySelector("#save-confirm-message");
const saveConfirmSubmit = document.querySelector("#save-confirm-submit");
const saveConfirmCancel = document.querySelector("#save-confirm-cancel");
const loginButton = document.querySelector("#kakao-login-button");
const loginStatus = document.querySelector("#login-status");
const accountStatusDescription = document.querySelector("#account-status-description");
const accountSavedCount = document.querySelector("#account-saved-count");
const quickHomeInputs = document.querySelectorAll("[data-quick-field]");
const quickHomeResults = document.querySelectorAll("[data-quick-result]");
const quickHomeStatus = document.querySelector("[data-quick-status]");
const quickHomeDetailButton = document.querySelector("[data-quick-detail-start]");
const finalDirectToggle = document.querySelector("#final-direct-toggle");
const finalModeTitle = document.querySelector("#final-mode-title");
const finalDirectInputs = document.querySelectorAll("[data-final-direct]");
const finalTotalElements = {
  china: document.querySelector('[data-final-total="china"]'),
  "china-korea": document.querySelector('[data-final-total="china-korea"]'),
  "korea-coupang": document.querySelector('[data-final-total="korea-coupang"]'),
  coupang: document.querySelector('[data-final-total="coupang"]'),
  grand: document.querySelector('[data-final-total="grand"]'),
};
const finalBusinessElements = {
  totalSales: document.querySelector('[data-final-business="totalSales"]'),
  totalMargin: document.querySelector('[data-final-business="totalMargin"]'),
};
const finalMarginCard = document.querySelector("[data-final-margin-card]");
const finalProfitElements = {
  unitSalePrice: document.querySelector('[data-profit-metric="unitSalePrice"]'),
  unitProductCost: document.querySelector('[data-profit-metric="unitProductCost"]'),
  unitMargin: document.querySelector('[data-profit-metric="unitMargin"]'),
  marginRate: document.querySelector('[data-profit-metric="marginRate"]'),
  totalExpectedMargin: document.querySelector('[data-profit-metric="totalExpectedMargin"]'),
  minimumRoas: document.querySelector('[data-profit-metric="minimumRoas"]'),
};
const finalChartItems = [
  { key: "china", label: "중국사입", totalKey: "china", color: "#3182F6", emptyColor: "#D9EAFF" },
  { key: "china-korea", label: "중국→한국", totalKey: "china-korea", color: "#03B26C", emptyColor: "#D9F4E8" },
  { key: "korea-coupang", label: "한국→쿠팡", totalKey: "korea-coupang", color: "#F04452", emptyColor: "#FFE1E5" },
  { key: "coupang", label: "쿠팡 소모 비용", totalKey: "coupang", color: "#8B95A1", emptyColor: "#E5E8EB" },
];
const stageSummaries = {
  china: "제품 원가와 중국 내 구매 비용을 확인합니다.",
  "china-korea": "LCL 운임, 통관, 세금, 대행비를 확인합니다.",
  "korea-coupang": "국내 운송과 쿠팡 입고 작업비를 확인합니다.",
  coupang: "판매 수수료와 판매 후 소모 비용을 확인합니다.",
  final: "총 원가, 판매가, 예상 마진을 확인합니다.",
  marginCalculator: "판매가와 비용을 기준으로 마진과 목표 판매가를 확인합니다.",
  purchaseCalculator: "중국 사입 원가와 개당 매입단가를 확인합니다.",
  adBreakEvenCalculator: "광고비를 어디까지 써도 되는지 확인합니다.",
  cashFlowCalculator: "월말 현금 잔액과 다음 발주 가능금액을 확인합니다.",
};
const categoryButtons = document.querySelectorAll("[data-category]");
const comingSoonCopy = {
  margin: {
    title: "마진율 계산기가 곧 제공됩니다.",
    description: "판매가, 원가, 수수료를 한 화면에서 비교할 수 있도록 순차적으로 제공될 예정입니다.",
  },
  "china-purchase": {
    title: "중국 사입 계산기가 곧 제공됩니다.",
    description: "중국 사입 원가와 대행 비용을 단독으로 계산할 수 있도록 서비스 확장 목록에 반영되어 있습니다.",
  },
  "agency-margin": {
    title: "광고 손익분기 계산기가 곧 제공됩니다.",
    description: "광고비, ROAS, 전환율을 기준으로 손익분기점을 확인할 수 있도록 순차적으로 제공될 예정입니다.",
  },
  "cash-flow": {
    title: "현금 흐름 계산기가 곧 제공됩니다.",
    description: "사입금, 입고비, 판매 회수 시점을 나누어 자금 흐름을 볼 수 있도록 서비스 확장 목록에 반영되어 있습니다.",
  },
};

let currentCalculator = "china";
let currentProductId = null;
let currentUser = null;
let isKakaoConfigured = false;
let accountFeatureEnabled = true;
let isAuthReady = false;
let savedProductsCache = [];
let currentProduct = createProduct("상품 1");
let saveStatusTimer = null;
let saveToastTimer = null;
let saveToastHideTimer = null;
let saveConfirmResolver = null;
let currentFinalChartKey = "grand";
let isSavedListExpanded = false;
const saveButtonLabel = "저장하기";
const saveActionButtons = [
  { button: saveProductButton, label: saveButtonLabel },
].filter(({ button }) => button);
let currentHelpKey = "customsExchangeRate";

function createProduct(name) {
  return {
    name,
    stages: clone(defaultStages),
    finalSummary: clone(defaultFinalSummary),
  };
}

function normalizeFinalSummary(finalSummary) {
  return {
    ...clone(defaultFinalSummary),
    ...clone(finalSummary || {}),
    directTotals: {
      ...clone(defaultFinalSummary.directTotals),
      ...clone(finalSummary?.directTotals || {}),
    },
  };
}

function normalizeProduct(product) {
  const savedStages = product?.stages || {};
  return {
    name: product?.name || getNextProductName(),
    stages: Object.fromEntries(
      Object.entries(defaultStages).map(([stage, defaults]) => [
        stage,
        normalizeStage(stage, { ...clone(defaults), ...clone(savedStages[stage] || {}) }),
      ]),
    ),
    finalSummary: normalizeFinalSummary(product?.finalSummary),
  };
}

function normalizeStage(stage, values) {
  if (stage === "china-korea") {
    const shippingMethodMap = {
      해상: "LCL 화물선",
      항공: "LCL 화물선",
    };
    const palletWrappingMap = {
      없음: "파레트 없이",
      "파렛&랩핑": "일반 파레트&랩핑",
      "쿠팡파레트&랩핑": "쿠팡 파레트&랩핑",
    };
    const shippingMethod = shippingMethodMap[values.shippingMethod] || values.shippingMethod;
    const palletWrapping = palletWrappingMap[values.palletWrapping] || values.palletWrapping;
    const palletWrappingPalletCount =
      palletWrapping === "파레트 없이"
        ? 0
        : Math.max(1, Math.round(parseNumber(values.palletWrappingPalletCount)));
    return {
      ...values,
      shippingMethod: ["LCL 화물선", "LCL 훼리선"].includes(shippingMethod) ? shippingMethod : "LCL 화물선",
      palletWrapping: ["파레트 없이", "일반 파레트&랩핑", "쿠팡 파레트&랩핑"].includes(palletWrapping)
        ? palletWrapping
        : "파레트 없이",
      palletWrappingPalletCount,
    };
  }

  if (stage !== "coupang") {
    return values;
  }

  const feeType = legacyCoupangFeeTypeMap[values.shoppingMallFeeType] || values.shoppingMallFeeType;
  const category = legacyCoupangCategoryMap[values.shoppingCategory] || values.shoppingCategory;
  const salesVatType = ["일반 과세자", "간이 과세자", "면세"].includes(values.salesVatType)
    ? values.salesVatType
    : "일반 과세자";

  return {
    ...values,
    shoppingMallFeeType: feeType === "쿠팡수수료" ? feeType : "쿠팡수수료",
    shoppingCategory: coupangCommissionCategoryOptions.includes(category) ? category : COUPANG_CATEGORY_PLACEHOLDER,
    salesVatType,
    salesVatRate: getNormalizedCoupangSalesVatRate(salesVatType, values.salesVatRate),
  };
}

function isNearlySameNumber(a, b) {
  return Math.abs(parseNumber(a) - parseNumber(b)) < 0.000001;
}

function syncIfUnsetOrAuto(targetValues, targetKey, previousSourceValue, nextSourceValue) {
  const currentTargetValue = parseNumber(targetValues[targetKey]);
  const nextValue = parseNumber(nextSourceValue);

  if (currentTargetValue <= 0 || isNearlySameNumber(currentTargetValue, previousSourceValue)) {
    targetValues[targetKey] = nextValue;
  }
}

function getChinaKoreaFreightSuggestions(values) {
  const lclBillingCbm = getLclBillingCbm(values?.lclVolumeCbm);
  return {
    lclBillingCbm,
    internationalFreightKrw: getLclBusinessFreightKrw(values?.lclVolumeCbm, values?.shippingMethod),
    terminalTransportFeeKrw: getTerminalTransportFeeKrw(lclBillingCbm),
  };
}

function getChinaKoreaVariableCostSuggestions(values, chinaTotal = 0) {
  const lclBillingCbm = getLclBillingCbm(values?.lclVolumeCbm);
  const hasImportSettlement = parseNumber(chinaTotal) > 0 || lclBillingCbm > 0;

  return {
    exportClearanceFeeKrw: lclBillingCbm > 0 ? getExportClearanceFeeKrw(values?.exportClearanceType) : 0,
    itemAdditionalFeeKrw: getItemAdditionalFeeKrw(values?.itemCount),
    palletWrappingFeeKrw: getPalletWrappingFeeKrw(values || {}),
    customsClearanceFeeKrw: hasImportSettlement ? importSettlementRate.customsBrokerFeeKrw : 0,
  };
}

function getKoreaCoupangTruckFreightSuggestion(values) {
  return Math.round(Math.max(0, Math.round(parseNumber(values?.palletCount))) * coupangInboundTruckRate.perPalletKrw);
}

function syncChinaKoreaFreightEstimates(previousStageValues = {}) {
  const stage = currentProduct.stages["china-korea"];
  const previousSuggestions = getChinaKoreaFreightSuggestions(previousStageValues);
  const nextSuggestions = getChinaKoreaFreightSuggestions(stage);

  syncIfUnsetOrAuto(
    stage,
    "internationalFreightKrw",
    previousSuggestions.internationalFreightKrw,
    nextSuggestions.internationalFreightKrw,
  );
  syncIfUnsetOrAuto(
    stage,
    "terminalTransportFeeKrw",
    previousSuggestions.terminalTransportFeeKrw,
    nextSuggestions.terminalTransportFeeKrw,
  );
}

function syncChinaKoreaVariableCostEstimates(previousStageValues = {}) {
  const stage = currentProduct.stages["china-korea"];
  const chinaTotal = calculateChina(currentProduct.stages.china).total;
  const previousSuggestions = getChinaKoreaVariableCostSuggestions(previousStageValues, chinaTotal);
  const nextSuggestions = getChinaKoreaVariableCostSuggestions(stage, chinaTotal);

  ["exportClearanceFeeKrw", "itemAdditionalFeeKrw", "palletWrappingFeeKrw", "customsClearanceFeeKrw"].forEach((key) => {
    syncIfUnsetOrAuto(stage, key, previousSuggestions[key], nextSuggestions[key]);
  });
}

function syncKoreaCoupangTruckFreightEstimate(previousStageValues = {}) {
  const stage = currentProduct.stages["korea-coupang"];
  syncIfUnsetOrAuto(
    stage,
    "generalTruckFreightKrw",
    getKoreaCoupangTruckFreightSuggestion(previousStageValues),
    getKoreaCoupangTruckFreightSuggestion(stage),
  );
}

function applyInitialStagePrefills() {
  const china = currentProduct.stages.china;
  const chinaKorea = currentProduct.stages["china-korea"];
  const koreaCoupang = currentProduct.stages["korea-coupang"];

  if (parseNumber(chinaKorea.lclVolumeCbm) <= 0 && parseNumber(china.totalVolumeCbm) > 0) {
    chinaKorea.lclVolumeCbm = parseNumber(china.totalVolumeCbm);
  }

  if (parseNumber(chinaKorea.totalWeightKg) <= 0 && parseNumber(china.totalWeightKg) > 0) {
    chinaKorea.totalWeightKg = parseNumber(china.totalWeightKg);
  }

  if (parseNumber(koreaCoupang.palletCount) <= 0 && parseNumber(chinaKorea.palletWrappingPalletCount) > 0) {
    koreaCoupang.palletCount = parseNumber(chinaKorea.palletWrappingPalletCount);
  }

  syncChinaKoreaFreightEstimates();
  syncChinaKoreaVariableCostEstimates();
  syncKoreaCoupangTruckFreightEstimate();
}

function syncDownstreamPrefills(fieldKey, previousStageValues) {
  if (currentCalculator === "china") {
    const china = currentProduct.stages.china;
    const chinaKorea = currentProduct.stages["china-korea"];
    const previousChinaKorea = clone(chinaKorea);

    if (fieldKey === "totalVolumeCbm") {
      syncIfUnsetOrAuto(chinaKorea, "lclVolumeCbm", previousStageValues.totalVolumeCbm, china.totalVolumeCbm);
      syncChinaKoreaFreightEstimates(previousChinaKorea);
    }

    if (fieldKey === "totalWeightKg") {
      syncIfUnsetOrAuto(chinaKorea, "totalWeightKg", previousStageValues.totalWeightKg, china.totalWeightKg);
    }

    syncChinaKoreaVariableCostEstimates(previousChinaKorea);
  }

  if (currentCalculator === "china-korea" && ["shippingMethod", "lclVolumeCbm"].includes(fieldKey)) {
    syncChinaKoreaFreightEstimates(previousStageValues);
  }

  if (
    currentCalculator === "china-korea" &&
    ["exportClearanceType", "itemCount", "lclVolumeCbm", "palletWrapping", "palletWrappingPalletCount"].includes(fieldKey)
  ) {
    syncChinaKoreaVariableCostEstimates(previousStageValues);
  }

  if (currentCalculator === "china-korea" && ["palletWrapping", "palletWrappingPalletCount"].includes(fieldKey)) {
    const previousKoreaCoupang = clone(currentProduct.stages["korea-coupang"]);
    syncIfUnsetOrAuto(
      currentProduct.stages["korea-coupang"],
      "palletCount",
      previousStageValues.palletWrappingPalletCount,
      currentProduct.stages["china-korea"].palletWrappingPalletCount,
    );
    syncKoreaCoupangTruckFreightEstimate(previousKoreaCoupang);
  }

  if (currentCalculator === "korea-coupang" && fieldKey === "palletCount") {
    syncKoreaCoupangTruckFreightEstimate(previousStageValues);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseNumber(value) {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return Math.round(value || 0).toLocaleString("ko-KR");
}

function formatCurrency(value) {
  return `${formatNumber(value)}원`;
}

function formatPercent(value) {
  return `${Math.round(value || 0).toLocaleString("ko-KR")}%`;
}

function formatCny(value) {
  return `${Number(value || 0).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })} ¥`;
}

function formatDecimal(value, digits = 1) {
  return Number(value || 0).toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatEditableValue(value) {
  return String(value ?? "");
}

function formatMetricValue(value, format = "currency", decimals = 1) {
  if (format === "percent") {
    return formatPercent(value);
  }

  if (format === "decimal") {
    return formatDecimal(value, decimals);
  }

  if (format === "number") {
    return formatNumber(value);
  }

  if (format === "cny") {
    return formatCny(value);
  }

  if (format === "text") {
    return String(value || "-");
  }

  return formatCurrency(value);
}

function readQuickHomeValues() {
  return Object.fromEntries(
    Array.from(quickHomeInputs).map((input) => [input.dataset.quickField, parseNumber(input.value)]),
  );
}

function setQuickHomeResult(key, value, formatter = formatCurrency) {
  const target = Array.from(quickHomeResults).find((element) => element.dataset.quickResult === key);
  if (target) {
    target.textContent = formatter(value);
  }
}

function updateQuickHomeCalculator() {
  if (!quickHomeInputs.length) {
    return;
  }

  const values = readQuickHomeValues();
  const quantity = Math.max(0, Math.round(values.quantity || 0));
  const salePriceKrw = Math.max(0, values.salePriceKrw || 0);
  const baseUnitCostKrw = Math.max(0, values.unitProductCostKrw || 0);
  const logisticsInboundTotalKrw = Math.max(0, values.logisticsInboundTotalKrw || 0);
  const adCostTotalKrw = Math.max(0, values.adCostTotalKrw || 0);
  const coupangFeeRate = Math.max(0, values.coupangFeeRate || 0);
  const logisticsPerUnitKrw = quantity > 0 ? logisticsInboundTotalKrw / quantity : 0;
  const adCostPerUnitKrw = quantity > 0 ? adCostTotalKrw / quantity : 0;
  const coupangFeePerUnitKrw = salePriceKrw * (coupangFeeRate / 100);
  const unitCostKrw = baseUnitCostKrw + logisticsPerUnitKrw;
  const unitMarginKrw = salePriceKrw - unitCostKrw - coupangFeePerUnitKrw - adCostPerUnitKrw;
  const totalSalesKrw = salePriceKrw * quantity;
  const totalMarginKrw = unitMarginKrw * quantity;
  const totalCostKrw = Math.max(0, totalSalesKrw - totalMarginKrw);
  const marginRate = totalSalesKrw > 0 ? (totalMarginKrw / totalSalesKrw) * 100 : 0;
  const allowableAdPerUnitKrw = salePriceKrw - unitCostKrw - coupangFeePerUnitKrw;
  const minimumRoas = allowableAdPerUnitKrw > 0 && salePriceKrw > 0 ? (salePriceKrw / allowableAdPerUnitKrw) * 100 : 0;

  setQuickHomeResult("unitCost", unitCostKrw);
  setQuickHomeResult("unitMargin", unitMarginKrw);
  setQuickHomeResult("totalMargin", totalMarginKrw);
  setQuickHomeResult("marginRate", marginRate, formatPercent);
  setQuickHomeResult("totalCost", totalCostKrw);
  setQuickHomeResult("minimumRoas", minimumRoas, formatPercent);

  if (quickHomeStatus) {
    quickHomeStatus.textContent = unitMarginKrw > 0 ? "마진 확보" : "손실 가능";
    quickHomeStatus.classList.toggle("is-loss", unitMarginKrw <= 0);
  }
}

function applyQuickHomeValuesToDetailCalculator() {
  const values = readQuickHomeValues();
  const quantity = Math.max(0, Math.round(values.quantity || 0));
  const salePriceKrw = Math.max(0, values.salePriceKrw || 0);
  const coupangFeeRate = Math.max(0, values.coupangFeeRate || 0);
  const adCostPerUnitKrw = quantity > 0 ? Math.max(0, values.adCostTotalKrw || 0) / quantity : 0;

  currentProduct.stages.china.quantity = quantity;
  currentProduct.stages.coupang.salePriceKrw = salePriceKrw;
  currentProduct.stages.coupang.coupangFeeRate = coupangFeeRate;
  currentProduct.stages.coupang.adCostKrw = adCostPerUnitKrw;
}

function isOriginCertificateDutyFree(values) {
  return values?.originCertificate === "원산지증명서";
}

function isNoPalletWrapping(values) {
  return !values?.palletWrapping || values.palletWrapping === "파레트 없이";
}

function isSalesVatExempt(values) {
  return values?.salesVatType === "면세";
}

function getNormalizedCoupangSalesVatRate(type, currentRate) {
  const defaultRate = coupangSalesVatRateByType[type] ?? coupangSalesVatRateByType["일반 과세자"];
  const parsedRate = parseNumber(currentRate);

  if (type === "면세") {
    return 0;
  }

  if (type === "간이 과세자") {
    return parsedRate > 0 && parsedRate !== coupangSalesVatRateByType["일반 과세자"] ? parsedRate : defaultRate;
  }

  return parsedRate > 0 ? parsedRate : defaultRate;
}

function isFieldComputed(field, stageValues) {
  if (field.computed) {
    return true;
  }

  if (field.lockWhenNoPallet && isNoPalletWrapping(stageValues)) {
    return true;
  }

  if (field.lockWhenSalesVatExempt && isSalesVatExempt(stageValues)) {
    return true;
  }

  return Boolean(field.lockWhenOriginCertificate && isOriginCertificateDutyFree(stageValues));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHelpImage(type) {
  const images = {
    customs: `
      <svg viewBox="0 0 520 300" role="img" aria-label="관세청 고시환율 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="66" y="46" width="188" height="214" rx="18" fill="#FFFFFF"/>
        <path d="M96 88H210M96 122H198M96 156H218" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <rect x="96" y="190" width="118" height="32" rx="10" fill="#E8F3FF"/>
        <path d="M286 92H438" stroke="#4E5968" stroke-width="8" stroke-linecap="round"/>
        <path d="M306 132H418M326 172H398" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <circle cx="370" cy="218" r="44" fill="#E8F3FF"/>
        <path d="M350 218L365 233L394 202" stroke="#3182F6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    vendor: `
      <svg viewBox="0 0 520 300" role="img" aria-label="업체 고시환율 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="60" y="70" width="172" height="150" rx="22" fill="#FFFFFF"/>
        <path d="M96 120H196M96 154H178" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M260 150H332" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M320 132L340 150L320 168" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="358" y="74" width="102" height="142" rx="22" fill="#E8F3FF"/>
        <path d="M384 124H434M384 156H420" stroke="#4E5968" stroke-width="8" stroke-linecap="round"/>
        <text x="146" y="204" text-anchor="middle" fill="#3182F6" font-size="28" font-family="Arial, sans-serif" font-weight="700">¥</text>
        <text x="410" y="204" text-anchor="middle" fill="#3182F6" font-size="28" font-family="Arial, sans-serif" font-weight="700">₩</text>
      </svg>
    `,
    price: `
      <svg viewBox="0 0 520 300" role="img" aria-label="제품단가 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="88" y="74" width="150" height="154" rx="20" fill="#FFFFFF"/>
        <path d="M116 120H198M116 154H180" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <text x="164" y="204" text-anchor="middle" fill="#3182F6" font-size="34" font-family="Arial, sans-serif" font-weight="700">¥</text>
        <path d="M270 150H330" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M316 132L336 150L316 168" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="362" y="88" width="92" height="126" rx="18" fill="#E8F3FF"/>
        <text x="408" y="166" text-anchor="middle" fill="#4E5968" font-size="30" font-family="Arial, sans-serif" font-weight="700">₩</text>
      </svg>
    `,
    quantity: `
      <svg viewBox="0 0 520 300" role="img" aria-label="제품수량 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="96" y="92" width="88" height="74" rx="16" fill="#FFFFFF"/>
        <rect x="202" y="92" width="88" height="74" rx="16" fill="#FFFFFF"/>
        <rect x="308" y="92" width="88" height="74" rx="16" fill="#FFFFFF"/>
        <path d="M116 132H164M222 132H270M328 132H376" stroke="#D1D6DB" stroke-width="8" stroke-linecap="round"/>
        <rect x="162" y="202" width="196" height="42" rx="14" fill="#E8F3FF"/>
        <text x="260" y="231" text-anchor="middle" fill="#3182F6" font-size="24" font-family="Arial, sans-serif" font-weight="700">EA × 단가</text>
      </svg>
    `,
    weight: `
      <svg viewBox="0 0 520 300" role="img" aria-label="총 중량 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="118" y="82" width="284" height="150" rx="26" fill="#FFFFFF"/>
        <path d="M176 188H344" stroke="#4E5968" stroke-width="9" stroke-linecap="round"/>
        <path d="M210 180L240 112H282L316 180" stroke="#B0B8C1" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="260" cy="112" r="28" fill="#E8F3FF"/>
        <text x="260" y="122" text-anchor="middle" fill="#3182F6" font-size="22" font-family="Arial, sans-serif" font-weight="700">KG</text>
      </svg>
    `,
    volume: `
      <svg viewBox="0 0 520 300" role="img" aria-label="총 부피 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <path d="M170 92L268 54L366 92V202L268 244L170 202Z" fill="#FFFFFF"/>
        <path d="M170 92L268 132L366 92M268 132V244M170 92V202M366 92V202" stroke="#B0B8C1" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="M202 206H336" stroke="#3182F6" stroke-width="8" stroke-linecap="round"/>
        <path d="M148 114V202M148 114L136 128M148 114L160 128M148 202L136 188M148 202L160 188" stroke="#4E5968" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M390 118H448M390 146H432M390 174H456" stroke="#B0B8C1" stroke-width="7" stroke-linecap="round"/>
        <rect x="390" y="202" width="82" height="34" rx="12" fill="#E8F3FF"/>
        <text x="431" y="225" text-anchor="middle" fill="#3182F6" font-size="20" font-family="Arial, sans-serif" font-weight="700">CBM</text>
      </svg>
    `,
    lclRate: `
      <svg viewBox="0 0 720 640" role="img" aria-label="LCL 화물 기본 운임표 요약 이미지">
        <rect width="720" height="640" rx="32" fill="#F8FAFC"/>
        <rect x="42" y="34" width="636" height="74" rx="22" fill="#D9EAFF"/>
        <text x="360" y="81" text-anchor="middle" fill="#191F28" font-size="31" font-family="Arial, sans-serif" font-weight="800">LCL 비용 흐름</text>
        <text x="360" y="136" text-anchor="middle" fill="#4E5968" font-size="17" font-family="Arial, sans-serif" font-weight="700">부피 입력 → 운임/터미널 자동 계산 → 통관·세금 합산</text>

        <rect x="50" y="168" width="184" height="116" rx="20" fill="#FFFFFF"/>
        <rect x="268" y="168" width="184" height="116" rx="20" fill="#FFFFFF"/>
        <rect x="486" y="168" width="184" height="116" rx="20" fill="#FFFFFF"/>
        <text x="142" y="202" text-anchor="middle" fill="#3182F6" font-size="17" font-family="Arial, sans-serif" font-weight="800">1. 해상운임</text>
        <text x="142" y="239" text-anchor="middle" fill="#191F28" font-size="24" font-family="Arial, sans-serif" font-weight="800">65,000원~</text>
        <text x="142" y="266" text-anchor="middle" fill="#8B95A1" font-size="14" font-family="Arial, sans-serif">화물선 1CBM 기준</text>
        <text x="360" y="202" text-anchor="middle" fill="#3182F6" font-size="17" font-family="Arial, sans-serif" font-weight="800">2. 수출통관</text>
        <text x="360" y="239" text-anchor="middle" fill="#191F28" font-size="24" font-family="Arial, sans-serif" font-weight="800">22,000원</text>
        <text x="360" y="266" text-anchor="middle" fill="#8B95A1" font-size="14" font-family="Arial, sans-serif">약식수출통관 기준</text>
        <text x="578" y="202" text-anchor="middle" fill="#3182F6" font-size="17" font-family="Arial, sans-serif" font-weight="800">3. 터미널</text>
        <text x="578" y="239" text-anchor="middle" fill="#191F28" font-size="24" font-family="Arial, sans-serif" font-weight="800">16,000원~</text>
        <text x="578" y="266" text-anchor="middle" fill="#8B95A1" font-size="14" font-family="Arial, sans-serif">총 비용에 포함</text>

        <path d="M240 226H260M458 226H478" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M253 214L265 226L253 238M471 214L483 226L471 238" stroke="#B0B8C1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>

        <rect x="50" y="320" width="292" height="170" rx="22" fill="#EEF8E8"/>
        <text x="82" y="356" fill="#191F28" font-size="20" font-family="Arial, sans-serif" font-weight="800">터미널 운송료 구간</text>
        <text x="82" y="394" fill="#4E5968" font-size="16" font-family="Arial, sans-serif" font-weight="700">1~2CBM</text>
        <text x="310" y="394" text-anchor="end" fill="#191F28" font-size="17" font-family="Arial, sans-serif" font-weight="800">16,000원</text>
        <text x="82" y="428" fill="#4E5968" font-size="16" font-family="Arial, sans-serif" font-weight="700">8~12CBM</text>
        <text x="310" y="428" text-anchor="end" fill="#191F28" font-size="17" font-family="Arial, sans-serif" font-weight="800">45,000원</text>
        <text x="82" y="462" fill="#4E5968" font-size="16" font-family="Arial, sans-serif" font-weight="700">20~25CBM</text>
        <text x="310" y="462" text-anchor="end" fill="#191F28" font-size="17" font-family="Arial, sans-serif" font-weight="800">80,000원</text>

        <rect x="378" y="320" width="292" height="170" rx="22" fill="#FFF4E8"/>
        <text x="410" y="356" fill="#191F28" font-size="20" font-family="Arial, sans-serif" font-weight="800">선택/작업 비용</text>
        <text x="410" y="394" fill="#4E5968" font-size="16" font-family="Arial, sans-serif" font-weight="700">원산지증명서</text>
        <text x="638" y="394" text-anchor="end" fill="#191F28" font-size="17" font-family="Arial, sans-serif" font-weight="800">35,000원</text>
        <text x="410" y="428" fill="#4E5968" font-size="16" font-family="Arial, sans-serif" font-weight="700">품목 추가비</text>
        <text x="638" y="428" text-anchor="end" fill="#191F28" font-size="17" font-family="Arial, sans-serif" font-weight="800">5,500원~</text>
        <text x="410" y="462" fill="#4E5968" font-size="16" font-family="Arial, sans-serif" font-weight="700">쿠팡 파레트</text>
        <text x="638" y="462" text-anchor="end" fill="#191F28" font-size="17" font-family="Arial, sans-serif" font-weight="800">1PLT 30,000원</text>

        <rect x="50" y="526" width="620" height="70" rx="20" fill="#FFFFFF"/>
        <circle cx="86" cy="561" r="12" fill="#3182F6"/>
        <text x="112" y="554" fill="#191F28" font-size="17" font-family="Arial, sans-serif" font-weight="800">터미널 운송료는 총 물류비에 포함</text>
        <text x="112" y="581" fill="#4E5968" font-size="15" font-family="Arial, sans-serif">세금계산 기준금액에는 넣지 않고, 총 비용에 별도 합산합니다.</text>
      </svg>
    `,
    taxBase: `
      <svg viewBox="0 0 720 460" role="img" aria-label="세금계산 기준금액 설명 이미지">
        <rect width="720" height="460" rx="32" fill="#F8FAFC"/>
        <rect x="42" y="34" width="636" height="70" rx="22" fill="#E8F3FF"/>
        <text x="360" y="78" text-anchor="middle" fill="#191F28" font-size="25" font-family="Arial, sans-serif" font-weight="800">세금계산 기준금액</text>
        <text x="360" y="130" text-anchor="middle" fill="#4E5968" font-size="15" font-family="Arial, sans-serif" font-weight="700">수입 정산서의 과세금액을 계산하기 위한 내부 기준값</text>

        <rect x="56" y="168" width="190" height="112" rx="20" fill="#FFFFFF"/>
        <text x="151" y="206" text-anchor="middle" fill="#3182F6" font-size="15" font-family="Arial, sans-serif" font-weight="800">중국사입 총 비용</text>
        <text x="151" y="240" text-anchor="middle" fill="#191F28" font-size="19" font-family="Arial, sans-serif" font-weight="800">제품·대행비</text>

        <rect x="280" y="168" width="190" height="112" rx="20" fill="#FFFFFF"/>
        <text x="375" y="206" text-anchor="middle" fill="#3182F6" font-size="15" font-family="Arial, sans-serif" font-weight="800">LCL 해상운임</text>
        <text x="375" y="240" text-anchor="middle" fill="#191F28" font-size="19" font-family="Arial, sans-serif" font-weight="800">국제 운임</text>

        <rect x="504" y="168" width="160" height="112" rx="20" fill="#D9EAFF"/>
        <text x="584" y="206" text-anchor="middle" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="800">기준금액</text>
        <text x="584" y="240" text-anchor="middle" fill="#3182F6" font-size="20" font-family="Arial, sans-serif" font-weight="800">자동 계산</text>

        <path d="M252 224H272M476 224H496" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M265 212L277 224L265 236M489 212L501 224L489 236" stroke="#B0B8C1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>

        <rect x="56" y="324" width="608" height="82" rx="20" fill="#FFFFFF"/>
        <text x="90" y="356" fill="#F04452" font-size="15" font-family="Arial, sans-serif" font-weight="800">제외되는 항목</text>
        <text x="90" y="383" fill="#4E5968" font-size="14" font-family="Arial, sans-serif">터미널 운송료 · 통관수수료 · 서류비는 세금 기준이 아니라 물류 총 비용에 합산</text>
      </svg>
    `,
    truck: `
      <svg viewBox="0 0 520 300" role="img" aria-label="중국 내륙 운송비 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <path d="M92 206H428" stroke="#4E5968" stroke-width="8" stroke-linecap="round"/>
        <rect x="110" y="116" width="154" height="80" rx="18" fill="#FFFFFF"/>
        <path d="M264 146H334L366 196H264V146Z" fill="#E8F3FF"/>
        <circle cx="176" cy="206" r="22" fill="#B0B8C1"/>
        <circle cx="340" cy="206" r="22" fill="#B0B8C1"/>
        <path d="M132 92H236M132 66H202" stroke="#B0B8C1" stroke-width="7" stroke-linecap="round"/>
      </svg>
    `,
    invoice: `
      <svg viewBox="0 0 520 300" role="img" aria-label="제품구매비용 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="112" y="54" width="244" height="206" rx="22" fill="#FFFFFF"/>
        <path d="M150 104H306M150 140H288M150 176H318" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <rect x="150" y="210" width="156" height="34" rx="12" fill="#E8F3FF"/>
        <circle cx="384" cy="204" r="46" fill="#E8F3FF"/>
        <text x="384" y="216" text-anchor="middle" fill="#3182F6" font-size="34" font-family="Arial, sans-serif" font-weight="700">×</text>
      </svg>
    `,
    fee: `
      <svg viewBox="0 0 520 300" role="img" aria-label="구매대행 수수료 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="88" y="78" width="168" height="156" rx="22" fill="#FFFFFF"/>
        <path d="M124 126H220M124 160H200" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <circle cx="350" cy="156" r="72" fill="#E8F3FF"/>
        <text x="350" y="174" text-anchor="middle" fill="#3182F6" font-size="58" font-family="Arial, sans-serif" font-weight="700">%</text>
        <path d="M260 156H306" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
      </svg>
    `,
    total: `
      <svg viewBox="0 0 520 300" role="img" aria-label="중국사입 총 비용 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="74" y="64" width="126" height="72" rx="18" fill="#FFFFFF"/>
        <rect x="74" y="164" width="126" height="72" rx="18" fill="#FFFFFF"/>
        <rect x="236" y="112" width="126" height="72" rx="18" fill="#FFFFFF"/>
        <path d="M208 100H232M208 200H232M366 148H416" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M404 130L424 148L404 166" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="426" y="108" width="54" height="88" rx="18" fill="#E8F3FF"/>
        <text x="453" y="162" text-anchor="middle" fill="#3182F6" font-size="34" font-family="Arial, sans-serif" font-weight="700">₩</text>
      </svg>
    `,
    shipping: `
      <svg viewBox="0 0 520 300" role="img" aria-label="국제 운송 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <path d="M74 190H446" stroke="#4E5968" stroke-width="8" stroke-linecap="round"/>
        <path d="M118 164L170 126H270L314 164H118Z" fill="#FFFFFF"/>
        <path d="M324 126H410L442 164H324Z" fill="#E8F3FF"/>
        <circle cx="156" cy="196" r="22" fill="#B0B8C1"/>
        <circle cx="356" cy="196" r="22" fill="#B0B8C1"/>
        <path d="M104 84H208M104 110H178" stroke="#B0B8C1" stroke-width="7" stroke-linecap="round"/>
        <path d="M278 84H416" stroke="#3182F6" stroke-width="8" stroke-linecap="round"/>
        <path d="M398 66L420 84L398 102" stroke="#3182F6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    tax: `
      <svg viewBox="0 0 520 300" role="img" aria-label="관세 통관 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="96" y="58" width="196" height="206" rx="22" fill="#FFFFFF"/>
        <path d="M132 106H254M132 142H236M132 178H260" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <rect x="132" y="212" width="116" height="34" rx="12" fill="#E8F3FF"/>
        <circle cx="374" cy="154" r="66" fill="#E8F3FF"/>
        <text x="374" y="174" text-anchor="middle" fill="#3182F6" font-size="56" font-family="Arial, sans-serif" font-weight="700">%</text>
      </svg>
    `,
    importSettlement: `
      <svg viewBox="0 0 620 440" role="img" aria-label="수입 통관 자금정산서 요약 이미지">
        <rect width="620" height="440" rx="28" fill="#F8FAFC"/>
        <rect x="32" y="28" width="556" height="66" rx="18" fill="#E8F3FF"/>
        <text x="310" y="66" text-anchor="middle" fill="#191F28" font-size="24" font-family="Arial, sans-serif" font-weight="800">수입 통관 정산 비용</text>
        <text x="310" y="116" text-anchor="middle" fill="#4E5968" font-size="14" font-family="Arial, sans-serif" font-weight="700">자금정산서 기준 · 관세사/통관 대행 청구 항목</text>

        <rect x="42" y="144" width="262" height="154" rx="16" fill="#FFFFFF"/>
        <text x="68" y="178" fill="#3182F6" font-size="16" font-family="Arial, sans-serif" font-weight="800">정산서 핵심값</text>
        <text x="68" y="212" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="700">과세금액</text>
        <text x="276" y="212" text-anchor="end" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="800">506,703원</text>
        <text x="68" y="242" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="700">수입 부가세</text>
        <text x="276" y="242" text-anchor="end" fill="#F04452" font-size="15" font-family="Arial, sans-serif" font-weight="800">50,670원</text>
        <text x="68" y="272" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="700">정산 총액</text>
        <text x="276" y="272" text-anchor="end" fill="#F04452" font-size="15" font-family="Arial, sans-serif" font-weight="800">83,670원</text>

        <rect x="326" y="144" width="252" height="154" rx="16" fill="#FFFFFF"/>
        <text x="352" y="178" fill="#3182F6" font-size="16" font-family="Arial, sans-serif" font-weight="800">계산기 반영</text>
        <text x="352" y="212" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="700">통관수수료</text>
        <text x="550" y="212" text-anchor="end" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="800">30,000원</text>
        <text x="352" y="242" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="700">수수료 부가세</text>
        <text x="550" y="242" text-anchor="end" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="800">3,000원</text>
        <text x="352" y="272" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="700">수입 부가세율</text>
        <text x="550" y="272" text-anchor="end" fill="#F04452" font-size="15" font-family="Arial, sans-serif" font-weight="800">10%</text>

        <rect x="42" y="326" width="536" height="64" rx="16" fill="#FFFFFF"/>
        <path d="M76 358H174" stroke="#3182F6" stroke-width="8" stroke-linecap="round"/>
        <path d="M164 342L182 358L164 374" stroke="#3182F6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="214" y="352" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="800">수입 부가세와 통관수수료는 서로 다른 비용</text>
        <text x="214" y="376" fill="#8B95A1" font-size="13" font-family="Arial, sans-serif">관세가 발생하면 수입 부가세 계산 기준도 함께 커질 수 있음</text>
      </svg>
    `,
    vat: `
      <svg viewBox="0 0 520 300" role="img" aria-label="부가세 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="90" y="84" width="148" height="132" rx="22" fill="#FFFFFF"/>
        <rect x="282" y="84" width="148" height="132" rx="22" fill="#FFFFFF"/>
        <path d="M132 132H198M132 164H182M324 132H390M324 164H372" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M248 150H272" stroke="#4E5968" stroke-width="8" stroke-linecap="round"/>
        <path d="M260 138V162" stroke="#4E5968" stroke-width="8" stroke-linecap="round"/>
        <text x="356" y="236" text-anchor="middle" fill="#3182F6" font-size="26" font-family="Arial, sans-serif" font-weight="700">VAT</text>
      </svg>
    `,
    inbound: `
      <svg viewBox="0 0 520 300" role="img" aria-label="쿠팡 입고 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="92" y="118" width="128" height="92" rx="18" fill="#FFFFFF"/>
        <path d="M118 160H192M118 184H174" stroke="#B0B8C1" stroke-width="7" stroke-linecap="round"/>
        <path d="M244 164H334" stroke="#3182F6" stroke-width="8" stroke-linecap="round"/>
        <path d="M316 146L338 164L316 182" stroke="#3182F6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="360" y="86" width="92" height="144" rx="20" fill="#E8F3FF"/>
        <path d="M386 130H426M386 158H418M386 186H430" stroke="#4E5968" stroke-width="7" stroke-linecap="round"/>
      </svg>
    `,
    incheonTruck: `
      <svg viewBox="0 0 620 400" role="img" aria-label="쿠팡센터 일반트럭 운송비 참고 이미지">
        <rect width="620" height="400" rx="28" fill="#F8FAFC"/>
        <rect x="48" y="34" width="524" height="66" rx="18" fill="#E8F3FF"/>
        <text x="310" y="75" text-anchor="middle" fill="#191F28" font-size="24" font-family="Arial, sans-serif" font-weight="800">일반트럭 운송비 기준</text>
        <text x="310" y="126" text-anchor="middle" fill="#4E5968" font-size="15" font-family="Arial, sans-serif" font-weight="700">쿠팡센터 입고 · 밀크런 제외 · 업체 견적 우선</text>

        <rect x="56" y="158" width="238" height="128" rx="18" fill="#FFFFFF"/>
        <text x="84" y="196" fill="#3182F6" font-size="17" font-family="Arial, sans-serif" font-weight="800">1파레트 평균 참고가</text>
        <text x="84" y="238" fill="#F04452" font-size="30" font-family="Arial, sans-serif" font-weight="900">약 30,000원</text>
        <text x="84" y="266" fill="#6B7684" font-size="14" font-family="Arial, sans-serif" font-weight="700">VAT 포함 참고 단가</text>

        <rect x="326" y="158" width="238" height="128" rx="18" fill="#FFFFFF"/>
        <text x="354" y="196" fill="#3182F6" font-size="17" font-family="Arial, sans-serif" font-weight="800">계산기 적용 방식</text>
        <text x="354" y="233" fill="#191F28" font-size="19" font-family="Arial, sans-serif" font-weight="900">파레트 수량 × 30,000원</text>
        <text x="354" y="264" fill="#6B7684" font-size="14" font-family="Arial, sans-serif" font-weight="700">금액은 직접 수정 가능</text>

        <rect x="56" y="318" width="508" height="48" rx="16" fill="#FFFFFF"/>
        <circle cx="84" cy="342" r="9" fill="#3182F6"/>
        <text x="108" y="337" fill="#191F28" font-size="15" font-family="Arial, sans-serif" font-weight="800">실제 청구액은 센터·거리·대기 조건에 따라 달라질 수 있습니다.</text>
        <text x="108" y="358" fill="#8B95A1" font-size="13" font-family="Arial, sans-serif" font-weight="700">운송사 견적이 있으면 예상치 대신 실제 견적을 입력하세요.</text>
      </svg>
    `,
    box: `
      <svg viewBox="0 0 520 300" role="img" aria-label="박스 작업 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <path d="M126 110L204 76L282 110V202L204 236L126 202Z" fill="#FFFFFF"/>
        <path d="M126 110L204 144L282 110M204 144V236" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M316 106H430M316 144H404M316 182H440" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <rect x="316" y="210" width="96" height="34" rx="12" fill="#E8F3FF"/>
        <text x="364" y="233" text-anchor="middle" fill="#3182F6" font-size="20" font-family="Arial, sans-serif" font-weight="700">BOX</text>
      </svg>
    `,
    label: `
      <svg viewBox="0 0 520 300" role="img" aria-label="라벨 작업 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="118" y="76" width="220" height="168" rx="24" fill="#FFFFFF"/>
        <rect x="158" y="118" width="128" height="70" rx="14" fill="#E8F3FF"/>
        <path d="M178 144H266M178 166H244" stroke="#3182F6" stroke-width="7" stroke-linecap="round"/>
        <path d="M362 122H438M362 154H418M362 186H450" stroke="#B0B8C1" stroke-width="7" stroke-linecap="round"/>
      </svg>
    `,
    sale: `
      <svg viewBox="0 0 520 300" role="img" aria-label="판매 비용 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="96" y="70" width="170" height="160" rx="24" fill="#FFFFFF"/>
        <path d="M132 118H226M132 154H210" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <text x="182" y="202" text-anchor="middle" fill="#3182F6" font-size="34" font-family="Arial, sans-serif" font-weight="700">₩</text>
        <circle cx="366" cy="154" r="62" fill="#E8F3FF"/>
        <path d="M344 154L360 170L392 136" stroke="#3182F6" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    coupangFee: `
      <svg viewBox="0 0 520 300" role="img" aria-label="쿠팡 수수료 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="84" y="88" width="160" height="124" rx="22" fill="#FFFFFF"/>
        <path d="M122 132H206M122 164H188" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M272 150H322" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <circle cx="382" cy="150" r="62" fill="#E8F3FF"/>
        <text x="382" y="170" text-anchor="middle" fill="#3182F6" font-size="54" font-family="Arial, sans-serif" font-weight="700">%</text>
      </svg>
    `,
    ad: `
      <svg viewBox="0 0 520 300" role="img" aria-label="광고비 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <path d="M112 164L268 104V214L112 174Z" fill="#FFFFFF"/>
        <path d="M268 104L392 74V244L268 214Z" fill="#E8F3FF"/>
        <path d="M142 176L162 230" stroke="#4E5968" stroke-width="10" stroke-linecap="round"/>
        <path d="M408 126H452M408 166H464M408 206H440" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
      </svg>
    `,
    return: `
      <svg viewBox="0 0 520 300" role="img" aria-label="반품비 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="132" y="90" width="138" height="126" rx="22" fill="#FFFFFF"/>
        <path d="M164 138H236M164 168H220" stroke="#B0B8C1" stroke-width="8" stroke-linecap="round"/>
        <path d="M336 104C306 118 288 144 294 178C302 222 356 236 392 206" stroke="#3182F6" stroke-width="10" stroke-linecap="round"/>
        <path d="M340 82L336 104L358 108" stroke="#3182F6" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    finalSummary: `
      <svg viewBox="0 0 520 300" role="img" aria-label="최종 비용 요약 설명 이미지">
        <rect width="520" height="300" rx="24" fill="#F2F4F6"/>
        <rect x="70" y="62" width="150" height="64" rx="18" fill="#FFFFFF"/>
        <rect x="70" y="152" width="150" height="64" rx="18" fill="#FFFFFF"/>
        <rect x="250" y="62" width="150" height="64" rx="18" fill="#FFFFFF"/>
        <rect x="250" y="152" width="150" height="64" rx="18" fill="#FFFFFF"/>
        <path d="M142 238H378" stroke="#3182F6" stroke-width="10" stroke-linecap="round"/>
        <path d="M108 96H182M108 186H182M288 96H362M288 186H362" stroke="#B0B8C1" stroke-width="7" stroke-linecap="round"/>
        <circle cx="424" cy="238" r="34" fill="#E8F3FF"/>
        <text x="424" y="250" text-anchor="middle" fill="#3182F6" font-size="32" font-family="Arial, sans-serif" font-weight="700">₩</text>
      </svg>
    `,
  };

  return images[type] || images.total;
}

function getFinalChartData(calculations) {
  const finalCostTotals = getFinalCostTotals(calculations);
  const items = finalChartItems.map((item) => ({
    ...item,
    value: finalCostTotals[item.key] || 0,
  }));
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return { items, total };
}

function buildDonutBackground(items, total) {
  if (total <= 0) {
    return `conic-gradient(${items
      .map((item, index) => `${item.emptyColor} ${index * 25}% ${(index + 1) * 25}%`)
      .join(", ")})`;
  }

  let cursor = 0;
  const segments = items
    .filter((item) => item.value > 0)
    .map((item, index, activeItems) => {
      const start = cursor;
      const end = index === activeItems.length - 1 ? 100 : cursor + (item.value / total) * 100;
      cursor = end;
      return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    });

  return `conic-gradient(${segments.join(", ")})`;
}

function resetFormulaCardMode() {
  formulaCard.classList.remove("help-card", "final-chart-card");
  formulaList.classList.remove("chart-legend-list");
  formulaCard.querySelector(".ai-analysis-button")?.remove();
  formulaCard.querySelector(".ai-analysis-status")?.remove();
}

function calculateChina(values) {
  const exchangeRate = values.vendorExchangeRate || values.customsExchangeRate || 0;
  const productPurchaseCny = values.productUnitCny * values.quantity;
  const productUnitKrw = values.productUnitCny * exchangeRate;
  const productPurchaseKrw = productPurchaseCny * exchangeRate;
  const chinaInlandFreightKrw = values.chinaInlandFreightCny * exchangeRate;
  const cardFeeKrw = productPurchaseKrw * (values.cardFeeRate / 100);
  const total = productPurchaseKrw + chinaInlandFreightKrw + cardFeeKrw + values.otherPurchaseCostKrw;
  const totalCny = exchangeRate > 0 ? total / exchangeRate : productPurchaseCny + values.chinaInlandFreightCny;

  return {
    productUnitKrw,
    productPurchaseCny,
    productPurchaseKrw,
    chinaInlandFreightKrw,
    cardFeeKrw,
    totalCny,
    total,
  };
}

function getLclBillingCbm(volumeCbm) {
  const cbm = parseNumber(volumeCbm);
  if (cbm <= 0) {
    return 0;
  }

  return Math.max(
    lclBusinessRate.minCbm,
    Math.ceil((cbm - Number.EPSILON) / lclBusinessRate.stepCbm) * lclBusinessRate.stepCbm,
  );
}

function getLclBusinessFreightKrw(volumeCbm, shippingMethod) {
  const billingCbm = getLclBillingCbm(volumeCbm);
  if (billingCbm <= 0) {
    return 0;
  }

  const baseFreightKrw =
    shippingMethod === "LCL 훼리선" ? lclBusinessRate.ferryBaseFreightKrw : lclBusinessRate.cargoBaseFreightKrw;
  const stepCount = Math.max(0, Math.round((billingCbm - lclBusinessRate.minCbm) / lclBusinessRate.stepCbm));
  return baseFreightKrw + stepCount * lclBusinessRate.stepPriceKrw;
}

function getTerminalTransportFeeKrw(billingCbm) {
  if (billingCbm <= 0) {
    return 0;
  }

  return lclBusinessRate.terminalFees.find((range) => billingCbm <= range.maxCbm)?.feeKrw || 0;
}

function getExportClearanceFeeKrw(type) {
  return type === "정식수출통관" ? lclBusinessRate.formalExportClearanceKrw : lclBusinessRate.simpleExportClearanceKrw;
}

function getItemAdditionalFeeKrw(itemCount) {
  const count = Math.max(0, Math.round(parseNumber(itemCount)));
  if (count <= 0) {
    return 0;
  }

  return lclBusinessRate.itemFees.find((range) => count <= range.maxItems)?.feeKrw || 0;
}

function getOriginCertificateFeeKrw(originCertificate) {
  return originCertificate === "원산지증명서" ? lclBusinessRate.originCertificateKrw : 0;
}

function getPalletWrappingPalletCount(values) {
  if (isNoPalletWrapping(values)) {
    return 0;
  }

  return Math.max(0, Math.round(parseNumber(values.palletWrappingPalletCount)));
}

function getPalletWrappingFeeKrw(values) {
  const palletCount = getPalletWrappingPalletCount(values);
  if (palletCount <= 0) {
    return 0;
  }

  if (values.palletWrapping === "일반 파레트&랩핑") {
    return palletCount * lclBusinessRate.palletWrappingPerPalletKrw;
  }

  if (values.palletWrapping === "쿠팡 파레트&랩핑") {
    return palletCount * lclBusinessRate.coupangPalletWrappingPerPalletKrw;
  }

  return 0;
}

function calculateChinaKorea(values, chinaTotal) {
  const freightSuggestions = getChinaKoreaFreightSuggestions(values);
  const lclBillingCbm = freightSuggestions.lclBillingCbm;
  const hasLclVolume = lclBillingCbm > 0;
  const internationalFreightKrw = parseNumber(values.internationalFreightKrw);
  const terminalTransportFeeKrw = parseNumber(values.terminalTransportFeeKrw);
  const agencyFeeKrw = values.agencyServiceType === "없음" ? 0 : chinaTotal * (values.agencyRate / 100);
  const exportClearanceFeeKrw = parseNumber(values.exportClearanceFeeKrw);
  const itemAdditionalFeeKrw = parseNumber(values.itemAdditionalFeeKrw);
  const originCertificateFeeKrw = isOriginCertificateDutyFree(values) ? parseNumber(values.originCertificateFeeKrw) : 0;
  const palletWrappingPalletCount = getPalletWrappingPalletCount(values);
  const palletWrappingFeeKrw = isNoPalletWrapping(values) ? 0 : parseNumber(values.palletWrappingFeeKrw);
  const taxableBaseKrw = chinaTotal + internationalFreightKrw;
  const hasImportSettlement = taxableBaseKrw > 0 || hasLclVolume;
  const customsClearanceFeeKrw = parseNumber(values.customsClearanceFeeKrw);
  const customsClearanceFeeVatKrw = customsClearanceFeeKrw * (importSettlementRate.customsBrokerVatRate / 100);
  const dutyRate = isOriginCertificateDutyFree(values) ? 0 : values.dutyRate;
  const dutyKrw = taxableBaseKrw * (dutyRate / 100);
  const vatKrw = (taxableBaseKrw + dutyKrw) * (values.vatRate / 100);
  const total =
    internationalFreightKrw +
    terminalTransportFeeKrw +
    agencyFeeKrw +
    exportClearanceFeeKrw +
    itemAdditionalFeeKrw +
    originCertificateFeeKrw +
    palletWrappingFeeKrw +
    customsClearanceFeeKrw +
    customsClearanceFeeVatKrw +
    values.extraCustomsFeeKrw +
    values.extraLogisticsKrw +
    dutyKrw +
    vatKrw;

  return {
    lclBillingCbm,
    internationalFreightKrw,
    internationalFreightSuggestedKrw: freightSuggestions.internationalFreightKrw,
    terminalTransportFeeKrw,
    terminalTransportFeeSuggestedKrw: freightSuggestions.terminalTransportFeeKrw,
    agencyFeeKrw,
    exportClearanceFeeKrw,
    exportClearanceFeeSuggestedKrw: getExportClearanceFeeKrw(values.exportClearanceType),
    itemAdditionalFeeKrw,
    itemAdditionalFeeSuggestedKrw: getItemAdditionalFeeKrw(values.itemCount),
    originCertificateFeeKrw,
    palletWrappingPalletCount,
    palletWrappingFeeKrw,
    palletWrappingFeeSuggestedKrw: getPalletWrappingFeeKrw(values),
    customsClearanceFeeKrw,
    customsClearanceFeeSuggestedKrw: hasImportSettlement ? importSettlementRate.customsBrokerFeeKrw : 0,
    customsClearanceFeeVatKrw,
    taxableBaseKrw,
    dutyRate,
    dutyKrw,
    vatKrw,
    total,
  };
}

function calculateKoreaCoupang(values) {
  const generalTruckFreightKrw = parseNumber(values.generalTruckFreightKrw);
  const boxUnitCost = values.boxWorkFeeKrw + values.labelFeePerBoxKrw + values.packingFeePerBoxKrw;
  const boxTotalKrw = values.boxCount * boxUnitCost;
  const total = generalTruckFreightKrw + values.domesticFreightKrw + boxTotalKrw + values.otherInboundFeeKrw;

  return {
    generalTruckFreightKrw,
    generalTruckFreightSuggestedKrw: getKoreaCoupangTruckFreightSuggestion(values),
    boxTotalKrw,
    total,
  };
}

function calculateCoupang(values) {
  const commissionKrw = values.salePriceKrw * (values.coupangFeeRate / 100);
  const salesVatRate = getNormalizedCoupangSalesVatRate(values.salesVatType, values.salesVatRate);
  const salesVatKrw =
    values.salesVatType === "면세"
      ? 0
      : values.salesVatType === "간이 과세자"
        ? values.salePriceKrw * (salesVatRate / 100)
        : values.salePriceKrw * (salesVatRate / (100 + salesVatRate));
  const settlementAmount = values.salePriceKrw - commissionKrw - values.outboundShippingFeeKrw - salesVatKrw;
  const total =
    commissionKrw +
    values.outboundShippingFeeKrw +
    salesVatKrw +
    values.adCostKrw +
    values.returnCostKrw +
    values.otherSellingFeeKrw;

  return {
    commissionKrw,
    salesVatRate,
    salesVatKrw,
    settlementAmount,
    total,
  };
}

function calculateMarginAtSalePrice(values, salePriceKrw) {
  const totalRevenueKrw = salePriceKrw + values.shippingRevenueKrw;
  const totalFeeKrw =
    salePriceKrw * (values.categoryFeeRate / 100) +
    salePriceKrw * (values.linkageFeeRate / 100) +
    values.shippingRevenueKrw * (values.shippingFeeRate / 100);
  const purchaseTotalKrw =
    values.purchaseCostKrw +
    values.purchaseShippingKrw +
    values.courierCostKrw +
    values.packingCostKrw +
    values.giftEtcCostKrw +
    values.adCostKrw;
  const vatKrw =
    values.vatType === "일반 과세자"
      ? Math.max(0, (totalRevenueKrw - values.purchaseCostKrw) * (values.vatRate / (100 + values.vatRate)))
      : 0;
  const settlementAmount = totalRevenueKrw - totalFeeKrw;
  const netProfit = settlementAmount - purchaseTotalKrw - vatKrw;
  const marginRate = totalRevenueKrw > 0 ? (netProfit / totalRevenueKrw) * 100 : 0;

  return {
    totalRevenueKrw,
    totalFeeKrw,
    purchaseTotalKrw,
    vatKrw,
    settlementAmount,
    netProfit,
    marginRate,
  };
}

function findSalePriceForMargin(values, targetMarginRate) {
  const targetRate = Math.max(0, parseNumber(targetMarginRate));
  const baseCost =
    values.purchaseCostKrw +
    values.purchaseShippingKrw +
    values.courierCostKrw +
    values.packingCostKrw +
    values.giftEtcCostKrw +
    values.adCostKrw;

  if (baseCost <= 0 && values.shippingRevenueKrw <= 0) {
    return 0;
  }

  let low = 0;
  let high = Math.max(100000, baseCost * 6 + values.shippingRevenueKrw * 2);

  for (let i = 0; i < 24; i += 1) {
    const trial = calculateMarginAtSalePrice(values, high);
    if (trial.marginRate >= targetRate && trial.netProfit >= 0) {
      break;
    }
    high *= 2;
  }

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const trial = calculateMarginAtSalePrice(values, mid);
    if (trial.marginRate >= targetRate && trial.netProfit >= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return Math.ceil(high);
}

function calculateMarginCalculator(values) {
  const base = calculateMarginAtSalePrice(values, values.salePriceKrw);
  const breakEvenSalePriceKrw = findSalePriceForMargin(values, 0);
  const targetSalePriceKrw = findSalePriceForMargin(values, values.targetMarginRate);

  return {
    ...base,
    breakEvenSalePriceKrw,
    targetSalePriceKrw,
  };
}

function calculatePurchaseCalculator(values) {
  const exchangeRate = values.vendorExchangeRate || values.customsExchangeRate || 0;
  const quantity = Math.max(0, parseNumber(values.quantity));
  const productPurchaseKrw = values.productUnitCny * quantity * exchangeRate;
  const productUnitKrw = values.productUnitCny * exchangeRate;
  const chinaInlandFreightKrw = values.chinaInlandFreightCny * exchangeRate;
  const agencyFeeKrw = (productPurchaseKrw + chinaInlandFreightKrw) * (values.agencyRate / 100);
  const cardFeeKrw = productPurchaseKrw * (values.cardFeeRate / 100);
  const agencyTotalKrw = productPurchaseKrw + chinaInlandFreightKrw + agencyFeeKrw + cardFeeKrw;
  const originCertificateFeeKrw = isOriginCertificateDutyFree(values) ? values.originCertificateFeeKrw : 0;
  const taxableBaseKrw = values.taxableBaseKrw > 0 ? values.taxableBaseKrw : productPurchaseKrw + values.expectedFreightKrw;
  const dutyRate = isOriginCertificateDutyFree(values) ? 0 : values.dutyRate;
  const dutyKrw = taxableBaseKrw * (dutyRate / 100);
  const importVatKrw = (taxableBaseKrw + dutyKrw) * (values.vatRate / 100);
  const taxAndCustomsTotalKrw =
    values.customsClearanceFeeKrw + originCertificateFeeKrw + dutyKrw + importVatKrw;
  const totalExpectedCostKrw =
    agencyTotalKrw + values.expectedFreightKrw + taxAndCustomsTotalKrw + values.otherPurchaseCostKrw;
  const unitPurchaseCostKrw = quantity > 0 ? totalExpectedCostKrw / quantity : 0;

  return {
    productUnitKrw,
    productPurchaseKrw,
    chinaInlandFreightKrw,
    agencyFeeKrw,
    cardFeeKrw,
    agencyTotalKrw,
    taxableBaseKrw,
    dutyRate,
    dutyKrw,
    importVatKrw,
    originCertificateFeeKrw,
    taxAndCustomsTotalKrw,
    totalExpectedCostKrw,
    unitPurchaseCostKrw,
  };
}

function calculateAdBreakEvenCalculator(values) {
  const platformFeeKrw = values.salePriceKrw * (values.platformFeeRate / 100);
  const vatKrw =
    values.vatType === "일반 과세자"
      ? Math.max(0, (values.salePriceKrw - values.unitCostKrw) * (values.vatRate / (100 + values.vatRate)))
      : 0;
  const profitBeforeAdKrw = values.salePriceKrw - values.unitCostKrw - platformFeeKrw - vatKrw;
  const targetProfitKrw = values.salePriceKrw * (values.targetMarginRate / 100);
  const allowableAdCostKrw = profitBeforeAdKrw - targetProfitKrw;
  const breakEvenRoas = allowableAdCostKrw > 0 && values.salePriceKrw > 0 ? (values.salePriceKrw / allowableAdCostKrw) * 100 : 0;
  const breakEvenCpcKrw = allowableAdCostKrw > 0 ? allowableAdCostKrw * (values.conversionRate / 100) : 0;
  const budgetExpectedOrders =
    values.cpcKrw > 0 ? (values.monthlyAdBudgetKrw / values.cpcKrw) * (values.conversionRate / 100) : 0;
  const effectiveOrderCount = values.expectedOrderCount > 0 ? values.expectedOrderCount : budgetExpectedOrders;
  const orderAdCostKrw = effectiveOrderCount > 0 ? values.monthlyAdBudgetKrw / effectiveOrderCount : 0;
  const monthlyProfitAfterAdKrw = effectiveOrderCount * (profitBeforeAdKrw - orderAdCostKrw);
  const isLoss = allowableAdCostKrw < 0 || monthlyProfitAfterAdKrw < 0;
  const isWarning = !isLoss && values.currentRoas > 0 && breakEvenRoas > 0 && values.currentRoas < breakEvenRoas;
  const riskLevel = isLoss ? "danger" : isWarning ? "warning" : "safe";
  const riskStatus = isLoss ? "손실" : isWarning ? "주의" : "안전";

  return {
    platformFeeKrw,
    vatKrw,
    profitBeforeAdKrw,
    targetProfitKrw,
    allowableAdCostKrw,
    breakEvenRoas,
    breakEvenCpcKrw,
    budgetExpectedOrders,
    orderAdCostKrw,
    monthlyProfitAfterAdKrw,
    riskLevel,
    riskStatus,
  };
}

function calculateCashFlowCalculator(values) {
  const incomeTotalKrw = values.settlementIncomeKrw + values.otherIncomeKrw;
  const variableCostTotalKrw =
    values.productPurchaseKrw +
    values.logisticsCostKrw +
    values.adCostKrw +
    values.packingWorkCostKrw +
    values.returnCsCostKrw +
    values.otherVariableCostKrw;
  const fixedCostTotalKrw =
    values.payrollKrw +
    values.rentKrw +
    values.insuranceTaxKrw +
    values.utilitiesKrw +
    values.softwareKrw +
    values.otherFixedCostKrw;
  const totalExpenseKrw = variableCostTotalKrw + fixedCostTotalKrw;
  const endingCashKrw = values.beginningCashKrw + incomeTotalKrw - totalExpenseKrw;
  const targetGapKrw = endingCashKrw - values.targetEndingCashKrw;
  const availablePurchaseBudgetKrw = endingCashKrw - values.safetyCashKrw;
  const fixedRatio = totalExpenseKrw > 0 ? (fixedCostTotalKrw / totalExpenseKrw) * 100 : 0;
  const variableRatio = totalExpenseKrw > 0 ? (variableCostTotalKrw / totalExpenseKrw) * 100 : 0;
  const costRatioLabel =
    totalExpenseKrw > 0 ? `고정 ${Math.round(fixedRatio)}% · 변동 ${Math.round(variableRatio)}%` : "지출 없음";
  const cashRiskLevel = endingCashKrw < 0 || availablePurchaseBudgetKrw < 0 ? "danger" : targetGapKrw < 0 ? "warning" : "safe";
  const cashStatus = cashRiskLevel === "danger" ? "부족" : cashRiskLevel === "warning" ? "주의" : "안정";

  return {
    incomeTotalKrw,
    variableCostTotalKrw,
    fixedCostTotalKrw,
    totalExpenseKrw,
    endingCashKrw,
    targetGapKrw,
    availablePurchaseBudgetKrw,
    fixedRatio,
    variableRatio,
    costRatioLabel,
    cashRiskLevel,
    cashStatus,
  };
}

function calculateAll() {
  const china = calculateChina(currentProduct.stages.china);
  const chinaKorea = calculateChinaKorea(currentProduct.stages["china-korea"], china.total);
  const koreaCoupang = calculateKoreaCoupang(currentProduct.stages["korea-coupang"]);
  const coupang = calculateCoupang(currentProduct.stages.coupang);
  const quantity = Math.max(0, parseNumber(currentProduct.stages.china.quantity));
  const totalSalesAmount = currentProduct.stages.coupang.salePriceKrw * quantity;
  const coupangTotal = coupang.total * quantity;
  const grandTotal = china.total + chinaKorea.total + koreaCoupang.total + coupangTotal;
  const totalExpectedMargin = totalSalesAmount - grandTotal;
  const marginCalculator = calculateMarginCalculator(currentProduct.stages.marginCalculator);
  const purchaseCalculator = calculatePurchaseCalculator(currentProduct.stages.purchaseCalculator);
  const adBreakEvenCalculator = calculateAdBreakEvenCalculator(currentProduct.stages.adBreakEvenCalculator);
  const cashFlowCalculator = calculateCashFlowCalculator(currentProduct.stages.cashFlowCalculator);

  return {
    china,
    "china-korea": chinaKorea,
    "korea-coupang": koreaCoupang,
    coupang,
    final: { grandTotal, totalSalesAmount, totalExpectedMargin, quantity, coupangTotal, unitCoupangCost: coupang.total },
    marginCalculator,
    purchaseCalculator,
    adBreakEvenCalculator,
    cashFlowCalculator,
  };
}

function isFinalDirectMode() {
  return currentProduct.finalSummary?.mode === "direct";
}

function getDirectFinalTotals() {
  const directTotals = currentProduct.finalSummary?.directTotals || {};
  return {
    china: Math.round(parseNumber(directTotals.china)),
    "china-korea": Math.round(parseNumber(directTotals["china-korea"])),
    "korea-coupang": Math.round(parseNumber(directTotals["korea-coupang"])),
    coupang: Math.round(parseNumber(directTotals.coupang)),
  };
}

function getFinalCostTotals(calculations) {
  return {
    china: calculations.china?.total || 0,
    "china-korea": calculations["china-korea"]?.total || 0,
    "korea-coupang": calculations["korea-coupang"]?.total || 0,
    coupang: calculations.final?.coupangTotal ?? calculations.coupang?.total ?? 0,
  };
}

function getFinalDisplayCalculations(calculations) {
  if (!isFinalDirectMode()) {
    return calculations;
  }

  const directTotals = getDirectFinalTotals();
  const grandTotal = Object.values(directTotals).reduce((sum, value) => sum + value, 0);
  const quantity = Math.max(0, parseNumber(currentProduct.stages.china.quantity));
  const totalSalesAmount = currentProduct.stages.coupang.salePriceKrw * quantity;
  const totalExpectedMargin = totalSalesAmount - grandTotal;

  return {
    ...calculations,
    china: { ...calculations.china, total: directTotals.china },
    "china-korea": { ...calculations["china-korea"], total: directTotals["china-korea"] },
    "korea-coupang": { ...calculations["korea-coupang"], total: directTotals["korea-coupang"] },
    coupang: { ...calculations.coupang, total: directTotals.coupang },
    final: {
      ...calculations.final,
      grandTotal,
      totalSalesAmount,
      totalExpectedMargin,
      quantity,
      coupangTotal: directTotals.coupang,
    },
  };
}

function copyCalculatedTotalsToDirect(calculations) {
  currentProduct.finalSummary.directTotals = {
    china: Math.round(calculations.china.total),
    "china-korea": Math.round(calculations["china-korea"].total),
    "korea-coupang": Math.round(calculations["korea-coupang"].total),
    coupang: Math.round(calculations.final.coupangTotal),
  };
}

function calculateProfitMetrics(calculations) {
  const unitSalePrice = currentProduct.stages.coupang.salePriceKrw;
  const quantity = Math.max(0, parseNumber(currentProduct.stages.china.quantity));
  const unitProductCost = quantity > 0 ? calculations.final.grandTotal / quantity : 0;
  const unitMargin = unitSalePrice - unitProductCost;
  const marginRate = unitSalePrice > 0 ? (unitMargin / unitSalePrice) * 100 : 0;
  const currentAdCost = parseNumber(currentProduct.stages.coupang.adCostKrw);
  const allowableAdCost = unitMargin + currentAdCost;
  const minimumRoas = allowableAdCost > 0 && unitSalePrice > 0 ? (unitSalePrice / allowableAdCost) * 100 : 0;

  return {
    unitSalePrice,
    unitProductCost,
    unitMargin,
    marginRate,
    minimumRoas,
    totalSalesAmount: calculations.final.totalSalesAmount || 0,
    totalExpectedCost: calculations.final.grandTotal || 0,
    totalExpectedMargin: calculations.final.totalExpectedMargin || 0,
  };
}

function getStageHelp(stage, helpKey) {
  return fieldHelp[stage]?.[helpKey];
}

function getDefaultHelpKey(stage) {
  if (stage === "final") {
    return "grand";
  }

  return Object.keys(fieldHelp[stage] || {})[0] || "";
}

function renderField(field, stageValues, calculatedValues) {
  const labelClasses = [];
  const isComputed = field.type === "select" ? Boolean(field.computed) : isFieldComputed(field, stageValues);
  const hasHelp = Boolean(getStageHelp(currentCalculator, field.key));
  if (field.full) {
    labelClasses.push("full-field");
  }
  if (isComputed) {
    labelClasses.push("computed-field");
  }
  if (hasHelp) {
    labelClasses.push("helpable-field");
  }
  const labelClass = labelClasses.length > 0 ? ` class="${labelClasses.join(" ")}"` : "";
  const helpAttributes = hasHelp ? ` data-help-key="${escapeHtml(field.key)}"` : "";
  const labelContent = `
    <span class="field-label-text">
      ${escapeHtml(field.label)}
    </span>
  `;

  if (field.type === "select") {
    const savedValue = stageValues[field.key] ?? field.options[0];
    const selectedValue = field.options.includes(savedValue) ? savedValue : field.options[0];
    const options = field.options
      .map((option) => `<option value="${escapeHtml(option)}"${option === selectedValue ? " selected" : ""}>${escapeHtml(option)}</option>`)
      .join("");

    return `
      <label${labelClass}${helpAttributes}>
        ${labelContent}
        <select data-field="${escapeHtml(field.key)}">${options}</select>
      </label>
    `;
  }

  const computedFormat = ["decimal", "number", "percent", "text"].includes(field.format) ? field.format : "number";
  const value = isComputed
    ? formatMetricValue(calculatedValues[field.key], computedFormat, field.decimals ?? 1)
    : formatEditableValue(stageValues[field.key]);
  const wrapperClass = isComputed ? "input-with-unit disabled" : "input-with-unit";
  const inputAttributes = isComputed
    ? `disabled data-computed="${escapeHtml(field.key)}"`
    : `data-field="${escapeHtml(field.key)}" inputmode="${field.inputmode || "decimal"}"`;

  return `
    <label${labelClass}${helpAttributes}>
      ${labelContent}
      <div class="${wrapperClass}">
        <input type="text" value="${escapeHtml(value)}" ${inputAttributes} />
        <em>${escapeHtml(field.unit)}</em>
      </div>
    </label>
  `;
}

function renderStageForm(id) {
  applyInitialStagePrefills();

  if (id === "final") {
    mockForm.innerHTML = "";
    renderFinalChart(getFinalDisplayCalculations(calculateAll()), currentFinalChartKey);
    return;
  }

  const schema = stageSchemas[id];
  const stageValues = currentProduct.stages[id];
  const calculatedValues = calculateAll()[id];

  mockForm.innerHTML = schema.fieldsets
    .map(
      (fieldset) => `
        <fieldset>
          <legend>${escapeHtml(fieldset.legend)}</legend>
          <div class="field-grid two">
            ${fieldset.fields.map((field) => renderField(field, stageValues, calculatedValues)).join("")}
          </div>
        </fieldset>
      `,
    )
    .join("");

  const defaultHelpKey = getDefaultHelpKey(id);
  if (defaultHelpKey) {
    if (!getStageHelp(id, currentHelpKey)) {
      currentHelpKey = defaultHelpKey;
    }
    renderStageHelp(id, currentHelpKey);
    return;
  }

  renderGenericPreview(id);
}

function renderGenericPreview(id) {
  const calculator = calculators[id] || calculators.china;
  resetFormulaCardMode();
  previewVisual.innerHTML = `
    <div class="visual-window">
      <div class="visual-toolbar">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="visual-lines">
        <i></i>
        <i></i>
        <i></i>
        <i></i>
      </div>
    </div>
  `;
  formulaCard.querySelector(".eyebrow").textContent = "입력 구조";
  formulaTitle.textContent = calculator.formulaTitle;
  formulaList.innerHTML = calculator.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
}

function renderFinalChart(calculations, selectedKey = "grand") {
  const { items, total } = getFinalChartData(calculations);
  const selectedItem = items.find((item) => item.key === selectedKey);
  const largestItem = items.reduce((largest, item) => (item.value > largest.value ? item : largest), items[0]);
  const selectedLabel = selectedItem ? selectedItem.label : "최종 비용";
  const selectedValue = selectedItem?.value ?? total;
  const profitMetrics = calculateProfitMetrics(calculations);
  const marginTone = profitMetrics.totalExpectedMargin < 0 ? "danger" : "neutral";
  const marginMessage =
    profitMetrics.totalExpectedMargin < 0
      ? "현재 입력값 기준으로는 판매 후 손실이 예상됩니다."
      : profitMetrics.totalExpectedMargin === 0
        ? "현재 입력값 기준으로는 손익분기 수준입니다."
        : "현재 입력값 기준으로 판매 후 마진이 남습니다.";

  currentFinalChartKey = selectedKey;
  resetFormulaCardMode();
  formulaCard.classList.add("final-chart-card");
  formulaList.classList.add("chart-legend-list");

  previewVisual.innerHTML = `
    <div class="final-breakdown-panel">
      <div class="final-reading-card" data-tone="${escapeHtml(marginTone)}">
        <span>마진 해석</span>
        <strong>${escapeHtml(marginMessage)}</strong>
        <em>총 예상마진 ${formatCurrency(profitMetrics.totalExpectedMargin)} · 마진율 ${formatPercent(profitMetrics.marginRate)}</em>
      </div>
      <div class="final-selected-cost">
        <span>${selectedItem ? "선택한 구간" : "전체 비용"}</span>
        <strong>${escapeHtml(selectedLabel)}</strong>
        <em>${formatCurrency(selectedValue)}</em>
      </div>
      <div class="final-share-bars" aria-label="구간별 비용 비중">
        ${items
          .map((item) => {
            const percent = total > 0 ? (item.value / total) * 100 : 0;
            return `
              <div class="final-share-row${selectedKey === item.key ? " is-selected" : ""}">
                <div>
                  <span>
                    <i class="chart-color-dot" style="--dot-color: ${item.color}"></i>
                    ${escapeHtml(item.label)}
                  </span>
                  <strong>${formatCurrency(item.value)}</strong>
                </div>
                <b><i style="--bar-color: ${item.color}; --bar-width: ${percent.toFixed(2)}%"></i></b>
                <em>${Math.round(percent)}%</em>
              </div>
            `;
          })
          .join("")}
      </div>
      <div class="final-key-metric">
        <span>가장 큰 비용 구간</span>
        <strong>${escapeHtml(total > 0 ? largestItem.label : "입력 대기")}</strong>
        <em>${formatCurrency(total > 0 ? largestItem.value : 0)}</em>
      </div>
    </div>
  `;

  formulaCard.querySelector(".eyebrow").textContent = "최종 해석";
  formulaTitle.textContent = "비용 비중과 마진";
  formulaList.innerHTML = items
    .map((item) => {
      const percent = total > 0 ? (item.value / total) * 100 : 0;
      const percentLabel = Math.round(percent);
      return `
        <li class="chart-legend-item${selectedKey === item.key ? " is-selected" : ""}">
          <div class="chart-legend-main">
            <span class="chart-name">
              <i class="chart-color-dot" style="--dot-color: ${item.color}"></i>
              ${escapeHtml(item.label)}
            </span>
            <strong>${percentLabel}%</strong>
          </div>
          <div class="chart-legend-amount">${formatCurrency(item.value)}</div>
          <div class="chart-progress-track" aria-hidden="true">
            <i style="--bar-color: ${item.color}; --bar-width: ${percent.toFixed(2)}%"></i>
          </div>
        </li>
      `;
    })
    .join("");

  const aiButton = document.createElement("button");
  aiButton.className = "ai-analysis-button";
  aiButton.type = "button";
  aiButton.textContent = "AI 분석 하기";
  formulaCard.append(aiButton);

  finalSummaryPanel.querySelectorAll("[data-final-help]").forEach((row) => {
    row.classList.toggle("is-help-selected", row.dataset.finalHelp === selectedKey);
  });
}

function showAiAnalysisComingSoon() {
  const status =
    formulaCard.querySelector(".ai-analysis-status") ||
    Object.assign(document.createElement("p"), { className: "ai-analysis-status" });

  status.textContent = "분석 기능은 서비스 확장 예정입니다.";
  formulaCard.append(status);
  setSaveStatus("분석 기능은 서비스 확장 예정입니다.", "warning", { toast: true });
}

function renderStageHelp(stage, helpKey) {
  const fallbackKey = getDefaultHelpKey(stage);
  const resolvedKey = getStageHelp(stage, helpKey) ? helpKey : fallbackKey;
  const help = getStageHelp(stage, resolvedKey);
  if (!help) {
    renderGenericPreview(stage);
    return;
  }
  currentHelpKey = resolvedKey;
  resetFormulaCardMode();

  previewVisual.innerHTML = `
    <div class="help-visual-card" data-help-image="${escapeHtml(help.image)}">
      ${renderHelpImage(help.image)}
    </div>
  `;

  formulaCard.classList.add("help-card");
  formulaCard.querySelector(".eyebrow").textContent = help.eyebrow;
  formulaTitle.textContent = help.title;
  formulaList.innerHTML = `
    <li class="help-meaning"><strong>항목 설명</strong><span>${escapeHtml(help.body)}</span></li>
    <li class="help-meaning"><strong>확인 방법</strong><span>${help.points.map((point) => escapeHtml(point)).join(" · ")}</span></li>
    <li class="help-meaning"><strong>계산 반영</strong><span>${escapeHtml(help.formula)}</span></li>
    ${help.highlight ? `<li class="help-highlight">${escapeHtml(help.highlight)}</li>` : ""}
  `;

  mockForm.querySelectorAll("[data-help-key]").forEach((label) => {
    label.classList.toggle("is-help-selected", label.dataset.helpKey === resolvedKey);
  });
  finalSummaryPanel.querySelectorAll("[data-final-help]").forEach((row) => {
    row.classList.toggle("is-help-selected", stage === "final" && row.dataset.finalHelp === resolvedKey);
  });
}

function renderChinaHelp(helpKey) {
  renderStageHelp("china", helpKey);
}

function updateComputedFields(calculatedValues) {
  mockForm.querySelectorAll("[data-computed]").forEach((input) => {
    const key = input.dataset.computed;
    const field = fieldLookup[currentCalculator]?.[key] || {};
    const computedFormat = ["decimal", "number", "percent", "text"].includes(field.format) ? field.format : "number";
    input.value = formatMetricValue(calculatedValues[key], computedFormat, field.decimals ?? 1);
  });
}

function updateEditableFieldValuesFromState(exceptKey = "") {
  const stageValues = currentProduct.stages[currentCalculator];
  if (!stageValues) {
    return;
  }

  mockForm.querySelectorAll("[data-field]").forEach((input) => {
    const key = input.dataset.field;
    const field = fieldLookup[currentCalculator]?.[key];

    if (!field || field.type === "select" || key === exceptKey) {
      return;
    }

    input.value = formatEditableValue(stageValues[key]);
  });
}

function getResultTone(values, toneKey) {
  if (!toneKey) {
    return "neutral";
  }

  const toneValue = values[toneKey];
  if (["danger", "warning", "safe"].includes(toneValue)) {
    return toneValue;
  }

  const numericValue = parseNumber(toneValue);
  if (numericValue < 0) {
    return "danger";
  }

  return "neutral";
}

function updateResultCard(calculations) {
  if (currentCalculator === "final") {
    return;
  }

  const schema = stageSchemas[currentCalculator];
  const values = calculations[currentCalculator];
  const cards =
    schema.resultCards ||
    [
      { label: schema.result.primaryLabel, key: schema.result.primaryKey, format: "currency" },
      { label: schema.result.secondaryLabel, key: schema.result.secondaryKey, format: "currency" },
    ];

  resultCard.classList.toggle("result-card-multi", cards.length > 2);
  resultCard.innerHTML = cards
    .map((card) => {
      const tone = getResultTone(values, card.toneKey);
      const value = formatMetricValue(values[card.key], card.format || "currency", card.decimals ?? 1);
      const rowClass = card.full ? "result-row is-wide" : "result-row";
      return `
        <div class="${rowClass}" data-tone="${escapeHtml(tone)}">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `;
    })
    .join("");
}

function updateFinalSummary(calculations) {
  const finalCostTotals = getFinalCostTotals(calculations);
  finalTotalElements.china.textContent = formatCurrency(calculations.china.total);
  finalTotalElements["china-korea"].textContent = formatCurrency(calculations["china-korea"].total);
  finalTotalElements["korea-coupang"].textContent = formatCurrency(calculations["korea-coupang"].total);
  finalTotalElements.coupang.textContent = formatCurrency(finalCostTotals.coupang);
  finalTotalElements.grand.textContent = formatCurrency(calculations.final.grandTotal);

  const profitMetrics = calculateProfitMetrics(calculations);
  finalBusinessElements.totalSales.textContent = formatCurrency(profitMetrics.totalSalesAmount);
  finalBusinessElements.totalMargin.textContent = formatCurrency(profitMetrics.totalExpectedMargin);
  finalMarginCard?.setAttribute("data-tone", profitMetrics.totalExpectedMargin < 0 ? "danger" : "neutral");
  finalProfitElements.unitSalePrice.textContent = formatCurrency(profitMetrics.unitSalePrice);
  finalProfitElements.unitProductCost.textContent = formatCurrency(profitMetrics.unitProductCost);
  finalProfitElements.unitMargin.textContent = formatCurrency(profitMetrics.unitMargin);
  finalProfitElements.marginRate.textContent = formatPercent(profitMetrics.marginRate);
  finalProfitElements.totalExpectedMargin.textContent = formatCurrency(profitMetrics.totalExpectedMargin);
  finalProfitElements.minimumRoas.textContent = formatPercent(profitMetrics.minimumRoas);
  finalProfitElements.unitMargin.closest("div")?.setAttribute("data-tone", profitMetrics.unitMargin < 0 ? "danger" : "neutral");
  finalProfitElements.marginRate.closest("div")?.setAttribute("data-tone", profitMetrics.unitMargin < 0 ? "danger" : "neutral");
  finalProfitElements.totalExpectedMargin
    .closest("div")
    ?.setAttribute("data-tone", profitMetrics.totalExpectedMargin < 0 ? "danger" : "neutral");
  finalProfitElements.minimumRoas
    .closest("div")
    ?.setAttribute("data-tone", profitMetrics.minimumRoas <= 0 && profitMetrics.unitSalePrice > 0 ? "danger" : "neutral");
}

function renderFinalSummaryMode() {
  const isDirect = isFinalDirectMode();
  finalSummaryPanel.classList.toggle("is-direct-mode", isDirect);
  finalDirectToggle.setAttribute("aria-pressed", String(isDirect));
  finalDirectToggle.textContent = isDirect ? "계산값으로 보기" : "직접 입력하기";
  finalModeTitle.textContent = isDirect ? "직접 입력값으로 보기" : "계산값으로 보기";

  const directTotals = getDirectFinalTotals();
  finalDirectInputs.forEach((input) => {
    const key = input.dataset.finalDirect;
    const field = input.closest(".final-direct-field");
    const row = input.closest(".cost-summary-row");
    const valueText = row.querySelector("[data-final-total]");

    field.hidden = !isDirect;
    valueText.hidden = isDirect;

    if (isDirect) {
      input.value = formatEditableValue(directTotals[key]);
    }
  });
}

function updateCalculationUI() {
  const calculations = calculateAll();
  const finalCalculations = getFinalDisplayCalculations(calculations);

  if (currentCalculator !== "final") {
    updateComputedFields(calculations[currentCalculator]);
    updateResultCard(calculations);
  } else {
    renderFinalChart(finalCalculations, currentFinalChartKey);
  }

  updateFinalSummary(finalCalculations);
}

function setActiveCategory(category) {
  categoryButtons.forEach((button) => {
    const isActive = button.dataset.category === category;
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
      return;
    }
    button.removeAttribute("aria-current");
  });
}

function isStandaloneCalculator(id) {
  return Boolean(categoryByStandaloneCalculator[id]);
}

function showComingSoon(category, options = {}) {
  const copy = comingSoonCopy[category] || comingSoonCopy.margin;
  const shouldScroll = options.scroll !== false;

  setActiveCategory(category);
  comingSoonTitle.textContent = copy.title;
  comingSoonDescription.textContent = copy.description;

  sessionBar.hidden = true;
  bannerGrid.hidden = true;
  homeGuideStrip.hidden = true;
  homeQuickCalculator.hidden = true;
  homeSeoExplainSection.hidden = true;
  overviewSection.hidden = true;
  seoSection.hidden = true;
  workspace.hidden = true;
  comingSoonSection.hidden = false;

  window.history.replaceState(null, "", `?category=${category}`);

  if (shouldScroll) {
    comingSoonSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderCalculator(id, options = {}) {
  const calculator = calculators[id] || calculators.china;
  const shouldScroll = options.scroll !== false;
  const isFinal = id === "final";
  const standaloneCategory = categoryByStandaloneCalculator[id] || "";
  const isStandalone = Boolean(standaloneCategory);

  currentCalculator = calculators[id] ? id : "china";
  setActiveCategory(isStandalone ? standaloneCategory : "rocket-growth");
  activeTitle.textContent = calculator.title;
  formTitle.textContent = calculator.formTitle;
  if (stageSummary) {
    stageSummary.textContent = stageSummaries[currentCalculator] || "";
    stageSummary.hidden = !stageSummary.textContent;
  }
  formulaTitle.textContent = calculator.formulaTitle;
  formulaList.innerHTML = calculator.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("");

  quickSwitchButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.calculator === currentCalculator);
  });
  if (quickSwitch) {
    quickSwitch.hidden = isStandalone;
  }

  renderStageForm(currentCalculator);
  workspace.classList.toggle("is-final", isFinal);
  workspace.classList.toggle("is-standalone", isStandalone);
  resultCard.hidden = isFinal;
  mockForm.hidden = isFinal;
  finalSummaryPanel.hidden = !isFinal;
  renderFinalSummaryMode();
  sessionBar.hidden = !accountFeatureEnabled;
  comingSoonSection.hidden = true;
  bannerGrid.hidden = true;
  homeGuideStrip.hidden = true;
  homeQuickCalculator.hidden = true;
  homeSeoExplainSection.hidden = true;
  overviewSection.hidden = true;
  seoSection.hidden = true;
  workspace.hidden = false;
  updateCalculationUI();

  if (shouldScroll) {
    workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function readSavedProducts() {
  return savedProductsCache;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || "request_failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function refreshAuthState() {
  try {
    const data = await requestJson("/api/me");
    accountFeatureEnabled = data.accountFeatureEnabled !== false;
    currentUser = accountFeatureEnabled ? data.user : null;
    isKakaoConfigured = Boolean(data.kakaoConfigured);
    isAuthReady = true;

    if (accountFeatureEnabled && currentUser) {
      await refreshSavedProducts();
    } else {
      savedProductsCache = [];
    }
  } catch {
    currentUser = null;
    accountFeatureEnabled = true;
    isKakaoConfigured = false;
    isAuthReady = false;
    savedProductsCache = [];
  }

  renderLoginStatus();
  renderSavedProducts();
}

async function refreshSavedProducts() {
  if (!currentUser) {
    savedProductsCache = [];
    return;
  }

  const data = await requestJson("/api/products");
  savedProductsCache = Array.isArray(data.products) ? data.products.map((product) => normalizeProductRecord(product)) : [];
}

function normalizeProductRecord(product) {
  return {
    id: product.id,
    name: product.name,
    stages: clone(product.stages || {}),
    finalSummary: normalizeFinalSummary(product.finalSummary),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function getNextProductName() {
  const savedProducts = readSavedProducts();
  const highestNumber = savedProducts.reduce((maxNumber, product) => {
    const match = String(product.name || "").trim().match(/^상품\s*(\d+)$/);
    return match ? Math.max(maxNumber, Number(match[1])) : maxNumber;
  }, 0);
  return `상품 ${highestNumber + 1}`;
}

function normalizeProductNameKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function findSavedProductByName(name) {
  const nameKey = normalizeProductNameKey(name);
  if (!nameKey) {
    return null;
  }

  return readSavedProducts().find((product) => normalizeProductNameKey(product.name) === nameKey) || null;
}

function findSavedProductById(id) {
  return readSavedProducts().find((product) => product.id === id) || null;
}

function formatSavedDate(value) {
  if (!value) {
    return "저장일 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "저장일 없음";
  }

  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderProductModeStatus() {
  if (!productModeStatus) {
    return;
  }

  const currentSavedProduct = findSavedProductById(currentProductId);
  if (!currentSavedProduct) {
    productModeStatus.textContent = "새 계산안 작성 중";
    return;
  }

  const typedName = productNameInput.value.trim() || currentSavedProduct.name;
  const isRenaming = normalizeProductNameKey(typedName) !== normalizeProductNameKey(currentSavedProduct.name);
  productModeStatus.textContent = isRenaming
    ? `${currentSavedProduct.name} 수정 중 · 이름 변경`
    : `${currentSavedProduct.name} 수정 중`;
}

function closeSaveConfirm(confirmed) {
  if (!saveConfirm || !saveConfirmResolver) {
    return;
  }

  const resolver = saveConfirmResolver;
  saveConfirmResolver = null;
  saveConfirm.hidden = true;
  resolver(Boolean(confirmed));
}

function askSaveConfirm({ title, message, confirmLabel = "저장하기", eyebrow = "저장 확인" }) {
  if (!saveConfirm || !saveConfirmTitle || !saveConfirmMessage || !saveConfirmSubmit || !saveConfirmCancel) {
    return Promise.resolve(window.confirm(message));
  }

  if (saveConfirmEyebrow) {
    saveConfirmEyebrow.textContent = eyebrow;
  }
  saveConfirmTitle.textContent = title;
  saveConfirmMessage.textContent = message;
  saveConfirmSubmit.textContent = confirmLabel;
  saveConfirm.hidden = false;
  saveConfirmSubmit.focus();

  return new Promise((resolve) => {
    saveConfirmResolver = resolve;
  });
}

function renderSavedProductCards(savedProducts) {
  if (!savedProductsList) {
    return;
  }

  if (!currentUser) {
    savedProductsList.innerHTML = '<p class="saved-empty-message">카카오로 시작하면 저장한 계산안 목록을 볼 수 있습니다.</p>';
    return;
  }

  if (savedProducts.length === 0) {
    savedProductsList.innerHTML = '<p class="saved-empty-message">아직 저장한 계산안이 없습니다. 상품명을 입력하고 저장하기를 눌러 보관하세요.</p>';
    return;
  }

  savedProductsList.innerHTML = savedProducts
    .map((product) => {
      const isCurrent = product.id === currentProductId;
      const currentPill = isCurrent ? '<span class="saved-current-pill">열려 있음</span>' : "";
      const loadLabel = isCurrent ? "열려 있음" : "불러오기";
      const loadDisabled = isCurrent ? " disabled" : "";
      return `
        <article class="saved-product-card${isCurrent ? " is-current" : ""}" data-saved-card="${escapeHtml(product.id)}">
          <div class="saved-product-card-head">
            <div>
              <h3>${escapeHtml(product.name)}</h3>
              <time datetime="${escapeHtml(product.updatedAt || "")}">최근 저장 ${escapeHtml(formatSavedDate(product.updatedAt))}</time>
            </div>
            ${currentPill}
          </div>
          <div class="saved-product-actions">
            <button class="saved-load-button" type="button" data-load-product="${escapeHtml(product.id)}"${loadDisabled}>${loadLabel}</button>
            <button class="saved-delete-button" type="button" data-delete-product="${escapeHtml(product.id)}">삭제</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSavedListToggle(savedProducts) {
  if (savedListToggleCount) {
    savedListToggleCount.textContent = `${savedProducts.length}개`;
  }

  if (savedListToggle) {
    savedListToggle.setAttribute("aria-expanded", String(isSavedListExpanded));
    savedListToggle.classList.toggle("is-expanded", isSavedListExpanded);
  }

  if (savedProductsList) {
    savedProductsList.hidden = !isSavedListExpanded;
  }
}

function renderSavedProducts() {
  const savedProducts = readSavedProducts();
  const countLabel = `저장 상품 ${savedProducts.length}개`;

  if (savedProductsCount) {
    savedProductsCount.textContent = countLabel;
  }
  if (accountSavedCount) {
    accountSavedCount.textContent = countLabel;
    accountSavedCount.hidden = !currentUser;
  }
  renderProductModeStatus();
  renderSavedProductCards(savedProducts);
  renderSavedListToggle(savedProducts);

  if (!currentUser) {
    savedProductsSelect.innerHTML = '<option value="">로그인 후 저장 목록을 볼 수 있습니다</option>';
    savedProductsSelect.disabled = true;
    loadProductButton.disabled = true;
    return;
  }

  savedProductsSelect.disabled = false;
  loadProductButton.disabled = false;

  if (savedProducts.length === 0) {
    savedProductsSelect.innerHTML = '<option value="">아직 저장한 상품이 없습니다</option>';
    return;
  }

  savedProductsSelect.innerHTML = savedProducts
    .map((product) => {
      const selected = product.id === currentProductId ? " selected" : "";
      return `<option value="${escapeHtml(product.id)}"${selected}>${escapeHtml(product.name)}</option>`;
    })
    .join("");
}

function setSaveActionButtonText(text) {
  saveActionButtons.forEach(({ button }) => {
    button.textContent = text;
  });
}

function resetSaveActionButtonLabels() {
  saveActionButtons.forEach(({ button, label }) => {
    button.textContent = label;
  });
}

function getSaveToastTitle(tone) {
  if (tone === "success") {
    return "저장 완료";
  }

  if (tone === "warning") {
    return "저장 안내";
  }

  return "계산기 안내";
}

function showSaveToast(message, tone = "neutral") {
  if (!saveToast || !saveToastTitle || !saveToastMessage) {
    return;
  }

  saveToastTitle.textContent = getSaveToastTitle(tone);
  saveToastMessage.textContent = message;
  saveToast.dataset.tone = tone;
  saveToast.hidden = false;
  saveToast.classList.remove("is-visible");
  window.requestAnimationFrame(() => {
    saveToast.classList.add("is-visible");
  });

  if (saveToastTimer) {
    window.clearTimeout(saveToastTimer);
  }

  if (saveToastHideTimer) {
    window.clearTimeout(saveToastHideTimer);
  }

  saveToastTimer = window.setTimeout(() => {
    saveToast.classList.remove("is-visible");
    saveToastHideTimer = window.setTimeout(() => {
      saveToast.hidden = true;
    }, 220);
  }, tone === "success" ? 2200 : 2800);
}

function setSaveStatus(message, tone = "neutral", options = {}) {
  saveStatus.textContent = message;
  saveStatus.dataset.tone = tone;

  if (options.toast) {
    showSaveToast(message, tone);
  }

  if (saveStatusTimer) {
    window.clearTimeout(saveStatusTimer);
  }

  if (tone === "success") {
    setSaveActionButtonText("저장됨");
    saveStatusTimer = window.setTimeout(() => {
      resetSaveActionButtonLabels();
      saveStatus.dataset.tone = "neutral";
    }, 1600);
    return;
  }

  resetSaveActionButtonLabels();
}

function resolveProductName() {
  const typedName = productNameInput.value.trim();
  return typedName || getNextProductName();
}

async function saveCurrentProduct() {
  if (!accountFeatureEnabled) {
    setSaveStatus("저장 기능은 현재 제공하지 않습니다.", "warning", {
      toast: true,
    });
    return;
  }

  if (!currentUser) {
    setSaveStatus("카카오로 시작하면 저장할 수 있습니다.", "warning", {
      toast: true,
    });
    return;
  }

  const name = resolveProductName();
  const currentSavedProduct = findSavedProductById(currentProductId);
  const existingProduct = findSavedProductByName(name);
  const isSameAsCurrentProduct =
    currentSavedProduct && normalizeProductNameKey(currentSavedProduct.name) === normalizeProductNameKey(name);
  let requestId = null;

  if (currentSavedProduct && isSameAsCurrentProduct) {
    const confirmed = await askSaveConfirm({
      title: `${currentSavedProduct.name}을 업데이트할까요?`,
      message: "변경된 내용으로 기존 계산안을 저장합니다.",
    });
    if (!confirmed) {
      setSaveStatus(`${currentSavedProduct.name} 저장을 취소했습니다.`, "neutral");
      return;
    }
    requestId = currentSavedProduct.id;
  } else if (existingProduct) {
    const confirmed = await askSaveConfirm({
      title: `${existingProduct.name}을 업데이트할까요?`,
      message: `이미 저장된 상품명입니다. 현재 입력값 전체가 ${existingProduct.name} 계산안으로 저장됩니다.`,
    });
    if (!confirmed) {
      setSaveStatus(`${existingProduct.name} 저장을 취소했습니다.`, "neutral");
      return;
    }
    requestId = existingProduct.id;
  } else if (currentSavedProduct) {
    const confirmed = await askSaveConfirm({
      title: `${name} 새 계산안으로 저장할까요?`,
      message: `현재 입력값 전체가 ${name} 계산안으로 새로 저장됩니다. 기존 ${currentSavedProduct.name}은 그대로 유지됩니다.`,
    });
    if (!confirmed) {
      setSaveStatus(`${name} 새 저장을 취소했습니다.`, "neutral");
      return;
    }
  }

  currentProduct.name = name;

  try {
    const data = await requestJson("/api/products", {
      method: "POST",
      body: JSON.stringify({
        id: requestId,
        name,
        stages: clone(currentProduct.stages),
        finalSummary: clone(currentProduct.finalSummary),
      }),
    });
    const savedProduct = normalizeProductRecord(data.product);
    const saveMode = data.mode || (requestId ? "updated" : "created");
    savedProductsCache = [savedProduct, ...savedProductsCache.filter((product) => product.id !== savedProduct.id)];

    currentProductId = savedProduct.id;
    productNameInput.value = savedProduct.name;
    renderSavedProducts();
    renderLoginStatus();
    const actionText = saveMode === "updated" ? "업데이트 완료" : "저장 완료";
    setSaveStatus(`${savedProduct.name} ${actionText}. 저장 목록에서 다시 불러올 수 있습니다.`, "success", { toast: true });
  } catch (error) {
    if (error.status === 401) {
      currentUser = null;
      savedProductsCache = [];
      renderLoginStatus();
      renderSavedProducts();
      setSaveStatus(LOGIN_REQUIRED_MESSAGE, "warning", { toast: true });
      return;
    }

    if (error.status === 409) {
      await refreshSavedProducts();
      renderSavedProducts();
      setSaveStatus("같은 상품명이 이미 저장되어 있습니다. 목록에서 해당 상품을 불러온 뒤 저장해 주세요.", "warning", {
        toast: true,
      });
      return;
    }

    setSaveStatus("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", "warning", { toast: true });
  }
}

function loadProductById(productId) {
  if (!currentUser) {
    setSaveStatus(LOGIN_REQUIRED_MESSAGE, "warning", { toast: true });
    return;
  }

  const selectedId = String(productId || "").trim();
  if (!selectedId) {
    setSaveStatus("불러올 계산안을 선택해 주세요.", "warning", { toast: true });
    return;
  }

  const savedProduct = readSavedProducts().find((product) => product.id === selectedId);
  if (!savedProduct) {
    setSaveStatus("저장 목록에서 계산안을 찾지 못했습니다.", "warning", { toast: true });
    return;
  }

  currentProductId = savedProduct.id;
  currentProduct = normalizeProduct(savedProduct);
  productNameInput.value = currentProduct.name;
  renderSavedProducts();
  renderCalculator(currentCalculator, { scroll: false });
  setSaveStatus(`${currentProduct.name} 계산안을 불러왔습니다.`, "success");
}

function loadSelectedProduct() {
  loadProductById(savedProductsSelect.value);
}

async function deleteSavedProduct(productId) {
  if (!currentUser) {
    setSaveStatus(LOGIN_REQUIRED_MESSAGE, "warning", { toast: true });
    return;
  }

  const savedProduct = findSavedProductById(productId);
  if (!savedProduct) {
    setSaveStatus("삭제할 계산안을 찾지 못했습니다.", "warning", { toast: true });
    return;
  }

  const confirmed = await askSaveConfirm({
    eyebrow: "삭제 확인",
    title: `${savedProduct.name} 계산안을 삭제할까요?`,
    message: "삭제한 계산안은 목록에서 사라지며 다시 불러올 수 없습니다.",
    confirmLabel: "삭제하기",
  });
  if (!confirmed) {
    setSaveStatus(`${savedProduct.name} 삭제를 취소했습니다.`, "neutral");
    return;
  }

  try {
    await requestJson(`/api/products/${encodeURIComponent(savedProduct.id)}`, {
      method: "DELETE",
    });

    savedProductsCache = savedProductsCache.filter((product) => product.id !== savedProduct.id);
    if (currentProductId === savedProduct.id) {
      currentProductId = null;
      currentProduct = createProduct(getNextProductName());
      productNameInput.value = currentProduct.name;
      renderCalculator(currentCalculator, { scroll: false });
    }

    renderSavedProducts();
    renderLoginStatus();
    setSaveStatus(`${savedProduct.name} 계산안을 삭제했습니다.`, "success", { toast: true });
  } catch (error) {
    if (error.status === 401) {
      currentUser = null;
      savedProductsCache = [];
      renderLoginStatus();
      renderSavedProducts();
      setSaveStatus(LOGIN_REQUIRED_MESSAGE, "warning", { toast: true });
      return;
    }

    if (error.status === 404) {
      await refreshSavedProducts();
      renderSavedProducts();
      setSaveStatus("이미 삭제된 계산안입니다. 저장 목록을 새로 정리했습니다.", "warning", { toast: true });
      return;
    }

    setSaveStatus("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.", "warning", { toast: true });
  }
}

function createNewProduct() {
  currentProductId = null;
  currentProduct = createProduct(getNextProductName());
  productNameInput.value = currentProduct.name;
  renderSavedProducts();
  renderCalculator(currentCalculator, { scroll: false });
  setSaveStatus("새 계산안을 시작했습니다. 저장하기를 누르면 목록에 보관됩니다.", "neutral");
}

function renderLoginStatus() {
  if (headerAccountBox) {
    headerAccountBox.hidden = !accountFeatureEnabled;
  }

  if (!accountFeatureEnabled) {
    if (sessionBar) {
      sessionBar.hidden = true;
    }
    return;
  }

  const savedCount = savedProductsCache.length;
  const savedCountLabel = `저장 상품 ${savedCount}개`;
  if (accountSavedCount) {
    accountSavedCount.textContent = savedCountLabel;
    accountSavedCount.hidden = !currentUser;
  }

  if (!isAuthReady) {
    loginStatus.textContent = "계정 상태 확인 중";
    accountStatusDescription.textContent = "계산기는 바로 사용할 수 있고, 저장은 로그인 후 가능합니다.";
    loginButton.textContent = "카카오로 시작하기";
    loginButton.disabled = true;
    return;
  }

  if (currentUser) {
    loginStatus.textContent = currentUser.nickname ? `${currentUser.nickname} 계정 연결됨` : "카카오 계정 연결됨";
    accountStatusDescription.textContent = `저장한 계산안은 내 계정에서 다시 불러올 수 있습니다. ${savedCountLabel}`;
    loginButton.textContent = "로그아웃";
    loginButton.disabled = false;
    return;
  }

  loginStatus.textContent = isKakaoConfigured ? "상품 저장을 위해 로그인이 필요합니다" : "계정 기능 점검 중";
  accountStatusDescription.textContent = isKakaoConfigured
    ? "카카오로 시작하면 상품별 계산안을 저장하고 다시 불러올 수 있습니다."
    : "계산기는 바로 사용할 수 있고, 저장 기능은 잠시 후 다시 확인해 주세요.";
  loginButton.textContent = "카카오로 시작하기";
  loginButton.disabled = !isKakaoConfigured;
}

async function handleLoginButtonClick() {
  if (currentUser) {
    try {
      await requestJson("/auth/logout", { method: "POST" });
    } catch {
      // 세션이 이미 만료된 경우에도 화면은 로그아웃 상태로 정리합니다.
    }

    currentUser = null;
    currentProductId = null;
    savedProductsCache = [];
    renderLoginStatus();
    renderSavedProducts();
    setSaveStatus("계정 연결이 해제되었습니다.", "neutral");
    return;
  }

  if (!isAuthReady) {
    setSaveStatus("계정 상태를 확인하고 있습니다. 잠시 후 다시 시도해 주세요.", "warning");
    return;
  }

  if (!isKakaoConfigured) {
    setSaveStatus("계정 기능을 점검하고 있습니다. 잠시 후 다시 시도해 주세요.", "warning");
    return;
  }

  window.location.href = "/auth/kakao/start";
}

function handleAuthQueryMessage() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");
  if (!auth) {
    return;
  }

  const messages = {
    success: ["카카오 계정이 연결되었습니다. 상품 계산안을 저장할 수 있습니다.", "success"],
    cancelled: ["카카오 로그인이 취소되었습니다.", "warning"],
    "invalid-state": ["로그인이 만료되었습니다. 다시 로그인해 주세요.", "warning"],
    error: ["로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.", "warning"],
  };
  const [message, tone] = messages[auth] || messages.error;
  setSaveStatus(message, tone);
  window.history.replaceState(null, "", window.location.pathname);
}

function scrollActiveCategoryIntoView() {
  const activeCategory = document.querySelector(".calculator-category-nav .is-active");
  activeCategory?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
}

document.querySelectorAll("[data-calculator]").forEach((button) => {
  button.addEventListener("click", () => {
    const id = button.dataset.calculator;
    renderCalculator(id);
    window.history.replaceState(null, "", `?calc=${id}`);
  });
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;

    if (category === "rocket-growth") {
      renderCalculator("china");
      window.history.replaceState(null, "", "?calc=china");
      return;
    }

    const calculatorId = standaloneCalculatorByCategory[category];
    if (calculatorId) {
      const canonicalCategory = category === "agency-margin" ? "ad-break-even" : category;
      renderCalculator(calculatorId);
      window.history.replaceState(null, "", `?category=${canonicalCategory}`);
      return;
    }

    showComingSoon(category);
  });
});

function applyCoupangCategoryPreset(fieldKey) {
  if (currentCalculator !== "coupang" || fieldKey !== "shoppingCategory") {
    return false;
  }

  const category = currentProduct.stages.coupang.shoppingCategory;
  const rate = coupangCommissionRateByLabel[category];
  if (!Number.isFinite(rate)) {
    return false;
  }

  currentProduct.stages.coupang.coupangFeeRate = rate;
  return true;
}

function applyCoupangVatPreset(fieldKey) {
  if (currentCalculator !== "coupang" || fieldKey !== "salesVatType") {
    return "";
  }

  const stage = currentProduct.stages.coupang;
  stage.salesVatRate = coupangSalesVatRateByType[stage.salesVatType] ?? coupangSalesVatRateByType["일반 과세자"];

  if (stage.salesVatType === "면세") {
    return "vat-exempt";
  }

  if (stage.salesVatType === "간이 과세자") {
    return "vat-simple";
  }

  return "vat-general";
}

function applyChinaKoreaPreset(fieldKey) {
  if (currentCalculator !== "china-korea") {
    return "";
  }

  const stage = currentProduct.stages["china-korea"];

  if (fieldKey === "originCertificate") {
    if (isOriginCertificateDutyFree(stage)) {
      stage.dutyRate = 0;
      if (parseNumber(stage.originCertificateFeeKrw) <= 0) {
        stage.originCertificateFeeKrw = lclBusinessRate.originCertificateKrw;
      }
      return "duty-free";
    }

    stage.originCertificateFeeKrw = 0;
    return "standard";
  }

  if (fieldKey === "palletWrapping") {
    if (isNoPalletWrapping(stage)) {
      stage.palletWrappingPalletCount = 0;
      stage.palletWrappingFeeKrw = 0;
      return "no-pallet";
    }

    if (parseNumber(stage.palletWrappingPalletCount) <= 0) {
      stage.palletWrappingPalletCount = 1;
    }

    return "pallet";
  }

  if (fieldKey === "agencyServiceType") {
    if (stage.agencyServiceType === "없음") {
      stage.agencyRate = 0;
      return "agency-none";
    }

    if (stage.agencyServiceType === "구매대행 수수료" && parseNumber(stage.agencyRate) <= 0) {
      stage.agencyRate = 8;
      return "agency-purchase";
    }

    return "agency";
  }

  return "";
}

function applyPurchaseCalculatorPreset(fieldKey) {
  if (currentCalculator !== "purchaseCalculator" || fieldKey !== "originCertificate") {
    return "";
  }

  const stage = currentProduct.stages.purchaseCalculator;
  if (isOriginCertificateDutyFree(stage)) {
    stage.dutyRate = 0;
    if (parseNumber(stage.originCertificateFeeKrw) <= 0) {
      stage.originCertificateFeeKrw = lclBusinessRate.originCertificateKrw;
    }
    return "purchase-duty-free";
  }

  if (parseNumber(stage.originCertificateFeeKrw) === lclBusinessRate.originCertificateKrw) {
    stage.originCertificateFeeKrw = 0;
  }
  return "purchase-standard";
}

function getFieldUpdateStatusMessage(appliedPreset, coupangVatPreset, chinaKoreaPreset, purchasePreset) {
  if (appliedPreset) {
    return "선택한 카테고리의 쿠팡 수수료율을 자동 입력했습니다. 필요하면 직접 수정하세요.";
  }

  const messages = {
    "vat-general": "일반 과세자 기준 VAT 포함가 분리 방식을 반영했습니다.",
    "vat-simple": "간이 과세자 소매업 기준 예상부담률 1.5%를 반영했습니다.",
    "vat-exempt": "면세 기준으로 예상부담률을 0% 처리했습니다.",
    "duty-free": "원산지증명서 기준을 반영했습니다. 관세율은 0%로 계산됩니다.",
    standard: "원산지증명서 기준을 해제했습니다. 관세율은 직접 입력값으로 계산됩니다.",
    "no-pallet": "파레트 없이 발송 기준으로 파레트 비용을 0원 처리했습니다.",
    pallet: "파레트/랩핑 비용은 파레트 수량당 단가로 계산됩니다.",
    "agency-none": "대행 수수료 없음 기준으로 0원 처리했습니다.",
    "agency-purchase": "구매대행 수수료 예시값 8%를 입력했습니다. 업체 요율에 맞게 수정하세요.",
    agency: "선택한 대행 방식 기준으로 중국→한국 물류비에 합산됩니다.",
    "purchase-duty-free": "원산지증명서 기준을 반영했습니다. 관세율은 0%로 계산됩니다.",
    "purchase-standard": "원산지증명서 기준을 해제했습니다. 관세율은 직접 입력값으로 계산됩니다.",
  };

  return messages[coupangVatPreset] ||
    messages[chinaKoreaPreset] ||
    messages[purchasePreset] ||
    "계산값이 변경되었습니다. 저장하기를 누르면 목록에 보관됩니다.";
}

function handleStageFieldUpdate(event) {
  const fieldKey = event.target.dataset.field;
  if (!fieldKey || currentCalculator === "final") {
    return;
  }

  const field = fieldLookup[currentCalculator]?.[fieldKey];
  if (!field) {
    return;
  }

  const previousStageValues = clone(currentProduct.stages[currentCalculator]);
  currentProduct.stages[currentCalculator][fieldKey] = field.type === "select" ? event.target.value : parseNumber(event.target.value);
  const appliedPreset = applyCoupangCategoryPreset(fieldKey);
  const coupangVatPreset = applyCoupangVatPreset(fieldKey);
  const chinaKoreaPreset = applyChinaKoreaPreset(fieldKey);
  const purchasePreset = applyPurchaseCalculatorPreset(fieldKey);
  syncDownstreamPrefills(fieldKey, previousStageValues);
  updateEditableFieldValuesFromState(fieldKey);
  if (appliedPreset) {
    const rateInput = mockForm.querySelector('[data-field="coupangFeeRate"]');
    if (rateInput) {
      rateInput.value = formatEditableValue(currentProduct.stages.coupang.coupangFeeRate);
    }
  }
  if (coupangVatPreset || chinaKoreaPreset || purchasePreset) {
    renderStageForm(currentCalculator);
  }
  updateCalculationUI();
  setSaveStatus(getFieldUpdateStatusMessage(appliedPreset, coupangVatPreset, chinaKoreaPreset, purchasePreset), "warning");
}

mockForm.addEventListener("input", handleStageFieldUpdate);
mockForm.addEventListener("change", handleStageFieldUpdate);

mockForm.addEventListener("submit", (event) => {
  event.preventDefault();
});

mockForm.addEventListener("click", (event) => {
  const helpTarget = event.target.closest("[data-help-key]");
  if (!helpTarget || !getStageHelp(currentCalculator, helpTarget.dataset.helpKey)) {
    return;
  }

  renderStageHelp(currentCalculator, helpTarget.dataset.helpKey);
});

mockForm.addEventListener("focusin", (event) => {
  const helpTarget = event.target.closest("[data-help-key]");
  if (!helpTarget || !getStageHelp(currentCalculator, helpTarget.dataset.helpKey)) {
    return;
  }

  renderStageHelp(currentCalculator, helpTarget.dataset.helpKey);
});

formulaCard.addEventListener("click", (event) => {
  const aiButton = event.target.closest(".ai-analysis-button");
  if (!aiButton) {
    return;
  }

  showAiAnalysisComingSoon();
});

finalDirectToggle.addEventListener("click", () => {
  const wasDirect = isFinalDirectMode();

  if (wasDirect) {
    currentProduct.finalSummary.mode = "calculated";
    renderFinalSummaryMode();
    updateCalculationUI();
    setSaveStatus("최종 비용 요약을 앞 단계 계산값으로 표시합니다.", "neutral");
    return;
  }

  const hasDirectValue = Object.values(getDirectFinalTotals()).some((value) => value > 0);
  if (!hasDirectValue) {
    copyCalculatedTotalsToDirect(calculateAll());
  }

  currentProduct.finalSummary.mode = "direct";
  renderFinalSummaryMode();
  updateCalculationUI();
  finalDirectInputs[0]?.focus();
  setSaveStatus("최종 비용 요약을 직접 입력값으로 표시합니다. 저장 버튼을 눌러 보관하세요.", "warning");
});

finalSummaryPanel.addEventListener("input", (event) => {
  const input = event.target.closest("[data-final-direct]");
  if (!input) {
    return;
  }

  currentProduct.finalSummary.mode = "direct";
  currentProduct.finalSummary.directTotals[input.dataset.finalDirect] = parseNumber(input.value);
  updateCalculationUI();
  setSaveStatus("직접 입력값이 변경되었습니다. 저장하기를 누르면 목록에 보관됩니다.", "warning");
});

finalSummaryPanel.addEventListener("click", (event) => {
  const directInput = event.target.closest("[data-final-direct]");
  if (directInput) {
    directInput.select();
  }

  const helpTarget = event.target.closest("[data-final-help]");
  if (!helpTarget || !getStageHelp("final", helpTarget.dataset.finalHelp)) {
    return;
  }

  renderFinalChart(getFinalDisplayCalculations(calculateAll()), helpTarget.dataset.finalHelp);
});

finalSummaryPanel.addEventListener("focusin", (event) => {
  const directInput = event.target.closest("[data-final-direct]");
  if (directInput) {
    directInput.select();
  }

  const helpTarget = event.target.closest("[data-final-help]");
  if (!helpTarget || !getStageHelp("final", helpTarget.dataset.finalHelp)) {
    return;
  }

  renderFinalChart(getFinalDisplayCalculations(calculateAll()), helpTarget.dataset.finalHelp);
});

finalSummaryPanel.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const helpTarget = event.target.closest("[data-final-help]");
  if (!helpTarget || !getStageHelp("final", helpTarget.dataset.finalHelp)) {
    return;
  }

  event.preventDefault();
  renderFinalChart(getFinalDisplayCalculations(calculateAll()), helpTarget.dataset.finalHelp);
});

productNameInput.addEventListener("input", () => {
  currentProduct.name = productNameInput.value.trim() || "상품 1";
  renderProductModeStatus();
  setSaveStatus("상품명이 변경되었습니다. 저장하기를 누르면 목록에 보관됩니다.", "warning");
});

saveProductButton?.addEventListener("click", async () => {
  await saveCurrentProduct();
});

saveConfirmSubmit?.addEventListener("click", () => {
  closeSaveConfirm(true);
});

saveConfirmCancel?.addEventListener("click", () => {
  closeSaveConfirm(false);
});

saveConfirm?.querySelector("[data-save-confirm-cancel]")?.addEventListener("click", () => {
  closeSaveConfirm(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && saveConfirm && !saveConfirm.hidden) {
    closeSaveConfirm(false);
  }
});

loadProductButton.addEventListener("click", () => {
  loadSelectedProduct();
});

savedProductsList?.addEventListener("click", async (event) => {
  const loadButton = event.target.closest("[data-load-product]");
  if (loadButton && !loadButton.disabled) {
    loadProductById(loadButton.dataset.loadProduct);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-product]");
  if (deleteButton) {
    await deleteSavedProduct(deleteButton.dataset.deleteProduct);
  }
});

savedListToggle?.addEventListener("click", () => {
  isSavedListExpanded = !isSavedListExpanded;
  renderSavedProducts();
});

newProductButton.addEventListener("click", () => {
  createNewProduct();
});

loginButton.addEventListener("click", async () => {
  await handleLoginButtonClick();
});

quickHomeInputs.forEach((input) => {
  input.addEventListener("input", updateQuickHomeCalculator);
});

quickHomeDetailButton?.addEventListener("click", () => {
  applyQuickHomeValuesToDetailCalculator();
  renderCalculator("china");
  window.history.replaceState(null, "", "?calc=china");
});

function showHome(scrollTarget = bannerGrid) {
  setActiveCategory("rocket-growth");
  workspace.classList.remove("is-final", "is-standalone");
  if (quickSwitch) {
    quickSwitch.hidden = false;
  }
  sessionBar.hidden = true;
  comingSoonSection.hidden = true;
  workspace.hidden = true;
  bannerGrid.hidden = false;
  homeGuideStrip.hidden = false;
  homeQuickCalculator.hidden = false;
  homeSeoExplainSection.hidden = false;
  overviewSection.hidden = true;
  seoSection.hidden = true;
  window.history.replaceState(null, "", window.location.pathname);
  scrollTarget.scrollIntoView({ behavior: "smooth", block: "start" });
}

homeButton.addEventListener("click", () => {
  showHome(introSection);
});

initializeApp();

async function initializeApp() {
  await refreshAuthState();
  updateQuickHomeCalculator();
  window.setTimeout(scrollActiveCategoryIntoView, 120);

  const initialParams = new URLSearchParams(window.location.search);
  const initialCategory = initialParams.get("category");
  const initialCalculator = initialParams.get("calc");

  if (initialCategory && standaloneCalculatorByCategory[initialCategory]) {
    const calculatorId = standaloneCalculatorByCategory[initialCategory];
    const canonicalCategory = initialCategory === "agency-margin" ? "ad-break-even" : initialCategory;
    renderCalculator(calculatorId, { scroll: false });
    if (initialCategory !== canonicalCategory) {
      window.history.replaceState(null, "", `?category=${canonicalCategory}`);
    }
  } else if (initialCategory && initialCategory !== "rocket-growth" && comingSoonCopy[initialCategory]) {
    showComingSoon(initialCategory, { scroll: false });
  } else if (initialCalculator && calculators[initialCalculator]) {
    renderCalculator(initialCalculator, { scroll: false });
  }

  handleAuthQueryMessage();
}
