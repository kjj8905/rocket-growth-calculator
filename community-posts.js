export const COMMUNITY_CATEGORIES = {
  "china-sourcing": {
    slug: "china-sourcing",
    label: "중국사입",
    title: "중국사입 단계",
    description: "제품단가, 수량, 환율, 중국 내륙 운송비처럼 사입 원가의 출발점을 다룹니다.",
  },
  "china-korea-logistics": {
    slug: "china-korea-logistics",
    label: "중국→한국",
    title: "중국→한국 물류",
    description: "LCL, CBM, 해상운임, 통관, 수입 부가세, 원산지증명서 관련 질문과 사례를 모았습니다.",
  },
  "korea-coupang-inbound": {
    slug: "korea-coupang-inbound",
    label: "한국→쿠팡",
    title: "한국→쿠팡 입고",
    description: "국내 운송, 파레트, 바코드, 라벨, 센터 입고 전 작업비를 다룹니다.",
  },
  "coupang-selling-cost": {
    slug: "coupang-selling-cost",
    label: "쿠팡 소모 비용",
    title: "쿠팡 소모 비용",
    description: "쿠팡 판매 수수료, 광고비, 반품비, 판매 후 빠지는 비용을 계산 관점으로 정리합니다.",
  },
  "final-margin": {
    slug: "final-margin",
    label: "최종 비용",
    title: "최종 비용·마진",
    description: "1개당 원가, 판매가, 예상마진, 최소 ROAS, 정산 후 남는 돈을 함께 봅니다.",
  },
  qna: {
    slug: "qna",
    label: "질문답변",
    title: "초보 셀러 질문답변",
    description: "쿠팡셀러와 개인셀러가 자주 묻는 비용, 마진, 입고, 세금 질문을 답변형으로 정리합니다.",
  },
  blog: {
    slug: "blog",
    label: "내 블로그",
    title: "내 블로그",
    description: "셀러 경험, 계산 사례, 상품 소싱 기록을 검색 유입용 글로 쌓는 개인 블로그 영역입니다.",
  },
};

export const COMMUNITY_STAGE_SLUGS = [
  "china-sourcing",
  "china-korea-logistics",
  "korea-coupang-inbound",
  "coupang-selling-cost",
  "final-margin",
];

export const COMMUNITY_BOARD_SLUGS = ["qna", "blog"];

export const LEGACY_COMMUNITY_CATEGORY_REDIRECTS = {
  tips: "final-margin",
  cases: "final-margin",
  operations: "korea-coupang-inbound",
  logistics: "china-korea-logistics",
};

export const COMMUNITY_TAGS = [
  "로켓그로스",
  "중국사입",
  "LCL",
  "쿠팡수수료",
  "파레트",
  "광고",
  "세금",
  "초보셀러",
];

export const SEED_COMMUNITY_POSTS = [
  {
    slug: "rocket-growth-cost-checklist-7",
    category: "final-margin",
    title: "로켓그로스 입고 전 꼭 확인할 비용 7가지",
    summary: "사입가만 보고 판매가를 정하면 정산 후 손실이 날 수 있습니다. 입고 전 반드시 볼 비용을 정리했습니다.",
    tags: ["로켓그로스", "쿠팡수수료", "초보셀러"],
    isFeatured: true,
    isNotice: true,
    authorName: "브랜드코어",
    sections: [
      {
        heading: "먼저 볼 비용",
        body: [
          "제품 구매비, 중국 내륙 운송비, 대행 수수료, 국제 물류비, 통관비, 국내 입고비, 쿠팡 판매 수수료를 따로 봐야 합니다.",
          "이 중 하나라도 빠지면 계산기에서 마진이 좋아 보여도 실제 판매 후 남는 금액은 크게 줄어듭니다.",
        ],
      },
      {
        heading: "계산 예시",
        body: [
          "판매가 20,000원 상품이라도 1개당 원가 11,000원, 물류·입고비 2,000원, 쿠팡 수수료 2,000원, 광고비 1,500원이면 예상마진은 3,500원입니다.",
        ],
      },
    ],
    faq: [
      {
        question: "처음에는 무엇부터 입력해야 하나요?",
        answer: "제품단가, 수량, 환율, 예상 판매가를 먼저 넣고 이후 물류비와 쿠팡 수수료를 단계별로 추가하면 됩니다.",
      },
    ],
  },
  {
    slug: "cbm-mistake-china-sourcing",
    category: "china-korea-logistics",
    title: "중국사입에서 CBM을 잘못 넣으면 생기는 문제",
    summary: "CBM은 LCL 해상운임과 터미널 비용의 기준이 됩니다. 대충 입력하면 물류비 예상이 흔들립니다.",
    tags: ["중국사입", "LCL", "초보셀러"],
    isFeatured: true,
    authorName: "물류 검수팀",
    sections: [
      {
        heading: "CBM이 중요한 이유",
        body: [
          "CBM은 가로, 세로, 높이를 기준으로 보는 부피 단위입니다. LCL은 중량보다 부피가 큰 상품에서 비용 차이가 커집니다.",
          "판매자에게 박스 외경과 박스 수량을 확인하고, 포워더 견적과 비교해 입력하는 것이 안전합니다.",
        ],
      },
      {
        heading: "체크리스트",
        body: [
          "박스 1개 크기, 총 박스 수, 총 중량, 팔레트 사용 여부, 포장 후 최종 부피를 함께 확인하세요.",
        ],
      },
    ],
    faq: [
      {
        question: "CBM은 상품 하나 부피인가요?",
        answer: "보통 물류 견적에서는 전체 화물의 포장 후 총 부피를 기준으로 봅니다.",
      },
    ],
  },
  {
    slug: "lcl-forwarder-questions",
    category: "china-korea-logistics",
    title: "LCL 해상운임 견적 받을 때 물어볼 질문",
    summary: "운임만 묻지 말고 서류비, 터미널 비용, 국내 운송비 포함 여부를 같이 확인해야 합니다.",
    tags: ["LCL", "중국사입", "세금"],
    authorName: "물류 검수팀",
    sections: [
      {
        heading: "견적 질문",
        body: [
          "해상운임, 서류비, 터미널 운송료, 통관수수료, 국내 운송비, 창고료 발생 조건을 분리해서 물어보세요.",
          "운임이 낮아 보여도 국내 도착 후 비용이 별도면 총액이 더 커질 수 있습니다.",
        ],
      },
    ],
    faq: [
      {
        question: "최저가 운임만 보면 안 되나요?",
        answer: "안전하지 않습니다. 총 청구액과 포함 항목을 기준으로 비교해야 합니다.",
      },
    ],
  },
  {
    slug: "coupang-fee-and-margin",
    category: "coupang-selling-cost",
    title: "쿠팡 수수료와 마진율을 같이 봐야 하는 이유",
    summary: "판매가와 매입가 차이만 보면 마진이 커 보입니다. 쿠팡 수수료는 판매 후 바로 빠지는 핵심 비용입니다.",
    tags: ["쿠팡수수료", "로켓그로스", "초보셀러"],
    isFeatured: true,
    authorName: "마진 분석팀",
    sections: [
      {
        heading: "수수료 반영",
        body: [
          "판매가 15,000원, 수수료율 10%라면 판매 수수료는 1,500원입니다.",
          "이 금액은 상품원가, 물류비, 광고비와 함께 순이익에서 빠지는 비용입니다.",
        ],
      },
    ],
    faq: [
      {
        question: "쿠팡 수수료는 어디에 넣나요?",
        answer: "로켓그로스 계산기에서는 쿠팡 소모 비용 단계에 넣고 최종 비용에서 마진과 함께 확인합니다.",
      },
    ],
  },
  {
    slug: "no-pallet-coupang-inbound",
    category: "korea-coupang-inbound",
    title: "파레트 없이 쿠팡 입고할 때 확인할 것",
    summary: "모든 상품이 파레트 입고를 전제로 움직이지는 않습니다. 박스 단위 입고 가능 여부를 먼저 확인해야 합니다.",
    tags: ["파레트", "로켓그로스", "초보셀러"],
    authorName: "입고 운영팀",
    sections: [
      {
        heading: "확인할 조건",
        body: [
          "상품 크기, 박스 수량, 센터 조건, 운송사 방식에 따라 파레트 없이 입고 가능한 경우가 있습니다.",
          "계산기에서는 파레트 비용을 0원으로 둘 수 있지만, 실제 운송 견적은 별도로 확인해야 합니다.",
        ],
      },
    ],
    faq: [
      {
        question: "파레트 비용은 무조건 넣어야 하나요?",
        answer: "아닙니다. 파레트 없이 보내는 조건이면 0원으로 계산하고 운송비만 따로 넣으면 됩니다.",
      },
    ],
  },
  {
    slug: "ad-cost-margin-mistake",
    category: "coupang-selling-cost",
    title: "초보 셀러가 광고비를 마진 계산에서 빼먹는 이유",
    summary: "광고비는 판매 후 남는 금액을 가장 빠르게 줄이는 비용입니다. 주문당 광고비 기준으로 봐야 합니다.",
    tags: ["광고", "쿠팡수수료", "초보셀러"],
    authorName: "마케팅 분석팀",
    sections: [
      {
        heading: "광고비 계산",
        body: [
          "광고비는 월 총액보다 주문당 얼마를 쓰는지가 중요합니다.",
          "월 광고비 100,000원으로 50건을 만들었다면 주문당 광고비는 2,000원입니다.",
        ],
      },
    ],
    faq: [
      {
        question: "광고를 아직 안 하면 0원으로 둬도 되나요?",
        answer: "가능합니다. 다만 광고 예정 상품이라면 보수적으로 주문당 광고비를 넣는 것이 안전합니다.",
      },
    ],
  },
  {
    slug: "origin-certificate-duty",
    category: "china-korea-logistics",
    title: "원산지증명서가 관세에 미치는 영향",
    summary: "중국 원산지증명서를 준비하면 관세 판단이 달라질 수 있지만 수입 부가세와 통관비는 별도로 남습니다.",
    tags: ["세금", "중국사입", "초보셀러"],
    authorName: "세무 검수팀",
    sections: [
      {
        heading: "주의할 점",
        body: [
          "원산지증명서는 관세 검토에 영향을 줄 수 있지만, 모든 비용이 사라진다는 뜻은 아닙니다.",
          "수입 부가세, 통관수수료, 서류 발급비는 별도 비용으로 계산해야 합니다.",
        ],
      },
    ],
    faq: [
      {
        question: "원산지증명서가 있으면 부가세도 0원인가요?",
        answer: "아닙니다. 관세와 수입 부가세는 다른 항목입니다.",
      },
    ],
  },
  {
    slug: "before-setting-rocket-growth-price",
    category: "final-margin",
    title: "로켓그로스 판매가 정하기 전 체크리스트",
    summary: "판매가를 정하기 전 원가, 물류비, 수수료, 광고비, 반품비를 한 번에 확인하는 체크리스트입니다.",
    tags: ["로켓그로스", "쿠팡수수료", "광고"],
    isNotice: true,
    authorName: "브랜드코어",
    sections: [
      {
        heading: "체크 항목",
        body: [
          "1개당 상품원가, 쿠팡 수수료, 물류·입고비, 광고비, 반품비, 최소 ROAS를 함께 확인하세요.",
          "목표 마진율은 최소 15% 이상을 기준으로 검토하는 것이 안전합니다.",
        ],
      },
    ],
    faq: [
      {
        question: "판매가는 언제 확정해야 하나요?",
        answer: "상품원가와 판매 후 비용을 모두 넣고 최소 ROAS까지 확인한 뒤 확정하는 것이 안전합니다.",
      },
    ],
  },
  {
    slug: "settlement-is-not-sales",
    category: "qna",
    title: "매출이 있는데 왜 통장에는 돈이 적게 남나요?",
    summary: "정산금은 매출과 다릅니다. 수수료, 광고비, 물류비, 세금, 재발주 비용을 빼고 봐야 합니다.",
    tags: ["초보셀러", "쿠팡수수료", "세금"],
    authorName: "질문답변팀",
    sections: [
      {
        heading: "답변",
        body: [
          "매출은 고객이 결제한 금액이고, 실제 남는 돈은 비용을 뺀 뒤의 금액입니다.",
          "상품원가와 광고비가 큰 상품은 매출이 커도 현금흐름이 나빠질 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "lcl-terminal-fee-meaning",
    category: "qna",
    title: "터미널 운송료는 무슨 비용인가요?",
    summary: "수입 화물이 국내 도착 후 처리되는 과정에서 붙는 비용입니다. 업체 청구 방식에 따라 금액이 달라집니다.",
    tags: ["LCL", "중국사입", "초보셀러"],
    authorName: "질문답변팀",
    sections: [
      {
        heading: "답변",
        body: [
          "터미널 운송료는 화물이 항구나 물류 터미널을 거치며 발생하는 처리 비용 성격으로 볼 수 있습니다.",
          "포워더마다 청구 항목명이 다를 수 있으므로 견적서의 포함 여부를 확인해야 합니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "coupang-return-cost-margin",
    category: "final-margin",
    title: "반품비를 넣으면 마진이 얼마나 줄어들까",
    summary: "반품이 적어 보여도 반복 판매 상품에서는 평균 비용으로 반영해야 실제 마진에 가깝습니다.",
    tags: ["로켓그로스", "초보셀러"],
    authorName: "마진 분석팀",
    sections: [
      {
        heading: "계산 방식",
        body: [
          "예상 반품률과 회수·재처리 비용을 기준으로 주문당 반품 비용을 나누어 넣으면 됩니다.",
          "반품비를 빼면 광고 효율이 좋아 보여도 실제 정산 후 손실이 날 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "china-inland-shipping-check",
    category: "china-sourcing",
    title: "중국 내륙 운송비를 꼭 확인해야 하는 이유",
    summary: "공장 가격이 싸도 중국 내륙 운송비가 크면 실제 사입 원가가 올라갑니다.",
    tags: ["중국사입", "초보셀러"],
    authorName: "물류 검수팀",
    sections: [
      {
        heading: "확인 방법",
        body: [
          "중국 공급처에서 배대지나 포워더 창고까지 보내는 비용을 따로 물어보세요.",
          "무료배송처럼 보여도 상품가에 비용이 포함된 경우가 있어 총액 기준으로 비교해야 합니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "rocket-growth-barcode-label",
    category: "korea-coupang-inbound",
    title: "로켓그로스 입고 전 바코드와 라벨에서 자주 막히는 지점",
    summary: "입고 작업비는 단순 포장비가 아니라 바코드, 라벨, 박스 작업까지 포함될 수 있습니다.",
    tags: ["로켓그로스", "초보셀러"],
    authorName: "입고 운영팀",
    sections: [
      {
        heading: "작업 항목",
        body: [
          "바코드 부착, 라벨 출력, 폴리백 포장, 박스 교체, 합포장 여부를 작업 전에 확인해야 합니다.",
          "작업비는 상품 단위 또는 박스 단위로 청구될 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "minimum-roas-meaning",
    category: "coupang-selling-cost",
    title: "최소 ROAS는 무엇을 의미하나요?",
    summary: "최소 ROAS는 광고비를 써도 손익분기를 넘기기 위해 필요한 광고 효율 기준입니다.",
    tags: ["광고", "초보셀러"],
    authorName: "마케팅 분석팀",
    sections: [
      {
        heading: "해석 방법",
        body: [
          "최소 ROAS보다 실제 ROAS가 낮으면 광고를 집행할수록 손실 가능성이 커집니다.",
          "광고 전 이익이 낮은 상품은 ROAS가 높아도 안전하지 않을 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "fee-rate-not-fixed",
    category: "qna",
    title: "쿠팡 수수료율은 고정인가요?",
    summary: "카테고리와 정책에 따라 달라질 수 있습니다. 계산기 입력값은 판매 전 예상 기준입니다.",
    tags: ["쿠팡수수료", "초보셀러"],
    authorName: "질문답변팀",
    sections: [
      {
        heading: "답변",
        body: [
          "쿠팡 수수료율은 상품 카테고리와 정책에 따라 달라질 수 있습니다.",
          "상품 등록 전 최신 기준을 확인하고 계산기에서 직접 수정하는 방식이 안전합니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "seller-cost-template",
    category: "final-margin",
    title: "초보 셀러 비용 계산 기본 양식",
    summary: "판매 전 비용을 빠뜨리지 않도록 상품별로 기록할 기본 항목을 정리했습니다.",
    tags: ["초보셀러", "로켓그로스"],
    authorName: "브랜드코어",
    sections: [
      {
        heading: "기본 항목",
        body: [
          "판매가, 수량, 제품단가, 환율, 중국 내륙 운송비, 대행 수수료, 국제 물류비, 통관비, 국내 입고비, 쿠팡 수수료, 광고비를 기록합니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "first-order-small-quantity",
    category: "china-sourcing",
    title: "첫 발주는 왜 작게 시작하는 게 안전할까",
    summary: "처음부터 큰 수량을 넣으면 단가가 낮아져도 반품, 광고, 재고 리스크가 커질 수 있습니다.",
    tags: ["초보셀러", "중국사입"],
    authorName: "브랜드코어",
    sections: [
      {
        heading: "운영 판단",
        body: [
          "첫 발주는 원가 검증, 광고 반응, 리뷰 확보, 반품률 확인을 위한 테스트 성격이 강합니다.",
          "마진이 좋아 보여도 판매 속도와 현금흐름을 확인하기 전에는 보수적으로 접근하는 것이 좋습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "storage-fee-risk",
    category: "final-margin",
    title: "판매가 느리면 보관과 재고 리스크가 커집니다",
    summary: "마진 계산은 판매가 되는 속도까지 함께 봐야 합니다. 재고가 오래 묶이면 현금흐름이 나빠집니다.",
    tags: ["로켓그로스", "초보셀러"],
    authorName: "입고 운영팀",
    sections: [
      {
        heading: "확인 포인트",
        body: [
          "판매 속도, 재발주 주기, 광고비, 가격 인하 가능성을 같이 봐야 합니다.",
          "마진율이 높아도 회전이 느리면 다음 발주 자금이 부족해질 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "import-vat-vs-sales-vat",
    category: "china-korea-logistics",
    title: "수입 부가세와 판매 부가세를 구분하는 방법",
    summary: "수입 때 내는 부가세와 판매 후 보는 부가세 부담은 목적이 다릅니다.",
    tags: ["세금", "중국사입"],
    authorName: "세무 검수팀",
    sections: [
      {
        heading: "구분",
        body: [
          "수입 부가세는 해외 물품을 국내로 들여올 때 세관 단계에서 검토하는 비용입니다.",
          "판매 부가세는 국내 판매 후 사업자 유형과 신고 방식에 따라 부담이 달라질 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "ask-with-calculation",
    category: "qna",
    title: "질문할 때 계산값을 같이 올리면 답변이 빨라집니다",
    summary: "판매가, 원가, 수량, 물류비, 쿠팡 수수료를 함께 적으면 질문의 품질이 좋아집니다.",
    tags: ["초보셀러", "로켓그로스"],
    authorName: "질문답변팀",
    sections: [
      {
        heading: "질문 양식",
        body: [
          "판매가, 수량, 1개당 상품원가, 물류비 총액, 쿠팡 수수료율, 광고비 예상액을 함께 적어주세요.",
          "단순히 남나요라고 묻는 것보다 숫자를 함께 올리면 더 구체적인 답변을 받을 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "weekly-seller-reading-list",
    category: "final-margin",
    title: "이번 주 셀러가 읽어볼 계산 기준 모음",
    summary: "로켓그로스 비용 계산, 쿠팡 수수료, LCL 물류비, 수입 부가세 기준을 한 번에 볼 수 있게 모았습니다.",
    tags: ["로켓그로스", "LCL", "쿠팡수수료", "세금"],
    isFeatured: true,
    authorName: "브랜드코어",
    sections: [
      {
        heading: "읽을 순서",
        body: [
          "처음이라면 로켓그로스 비용 계산 기준, 중국사입 원가, LCL 물류비, 쿠팡 수수료, 최소 ROAS 순서로 읽어보세요.",
          "각 기준을 읽은 뒤 계산기에 값을 넣으면 본인 상품의 마진 구조가 더 선명해집니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-price-19900-margin",
    category: "final-margin",
    title: "판매가 19,900원인데 로켓그로스 마진이 남을까요?",
    summary: "판매가, 상품원가, 쿠팡 수수료를 같이 봐야 실제 남는 금액을 판단할 수 있습니다.",
    tags: ["로켓그로스", "초보셀러"],
    authorName: "초보셀러 민수",
    createdAt: "2026-06-22T00:15:00.000Z",
    updatedAt: "2026-06-22T00:15:00.000Z",
    views: 218,
    sections: [
      {
        heading: "질문",
        body: ["판매가 19,900원으로 잡고 있는데 사입가만 보면 남는 것 같고, 쿠팡 비용까지 넣으면 헷갈립니다."],
      },
      {
        heading: "답변",
        body: [
          "먼저 1개당 상품원가를 만들고 쿠팡 수수료, 입고비, 광고비를 순서대로 빼서 보세요.",
          "판매가가 같아도 물류비와 수수료율이 달라지면 최종 마진은 크게 달라집니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-terminal-fee-separate",
    category: "china-korea-logistics",
    title: "LCL 견적에 터미널 운송료가 따로 적혀 있는데 정상인가요?",
    summary: "터미널 운송료는 도착 후 처리 비용 성격으로 견적서에서 따로 보일 수 있습니다.",
    tags: ["LCL", "중국사입"],
    authorName: "주방용품 셀러",
    createdAt: "2026-06-22T00:34:00.000Z",
    updatedAt: "2026-06-22T00:34:00.000Z",
    views: 211,
    sections: [
      {
        heading: "질문",
        body: ["포워더 견적에 해상운임 말고 터미널 운송료가 따로 있는데 이 비용도 계산기에 넣어야 하나요?"],
      },
      {
        heading: "답변",
        body: [
          "네. 실제 청구되는 비용이면 중국→한국 단계의 물류비에 포함해서 봐야 합니다.",
          "해상운임만 넣으면 도착 후 비용이 빠져 최종 원가가 낮게 보일 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-no-pallet-inbound",
    category: "korea-coupang-inbound",
    title: "쿠팡 인천센터까지 파레트 없이 보내도 되나요?",
    summary: "상품과 센터 조건에 따라 박스 단위 입고가 가능할 수 있으므로 운송 방식 확인이 필요합니다.",
    tags: ["파레트", "초보셀러"],
    authorName: "생활용품 셀러",
    createdAt: "2026-06-22T00:52:00.000Z",
    updatedAt: "2026-06-22T00:52:00.000Z",
    views: 203,
    sections: [
      {
        heading: "질문",
        body: ["수량이 많지 않은데 꼭 파레트 비용을 잡아야 하는지 모르겠습니다."],
      },
      {
        heading: "답변",
        body: [
          "파레트 없이 보낼 수 있는 조건이면 파레트 비용은 0원으로 두고 국내 운송비만 반영하면 됩니다.",
          "단, 센터 입고 방식과 운송사 조건은 출고 전에 확인해야 합니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-1688-extra-costs",
    category: "china-sourcing",
    title: "1688 상품단가 말고 어떤 비용을 더 봐야 하나요?",
    summary: "제품단가 외에 중국 내륙운송비, 대행 수수료, 환율 차이를 함께 봐야 합니다.",
    tags: ["중국사입", "초보셀러"],
    authorName: "첫사입 준비중",
    createdAt: "2026-06-22T01:08:00.000Z",
    updatedAt: "2026-06-22T01:08:00.000Z",
    views: 197,
    sections: [
      {
        heading: "질문",
        body: ["1688 상품단가만 보고 계산하면 너무 싸게 나오는데 실제 결제할 때 더 붙는 비용이 있나요?"],
      },
      {
        heading: "답변",
        body: [
          "중국 내륙 운송비, 구매대행 또는 배송대행 수수료, 적용 환율 차이를 같이 넣어야 합니다.",
          "단가만 보면 사입 원가가 낮게 보이기 때문에 수량과 환율을 함께 입력하는 것이 좋습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-coupang-fee-base-price",
    category: "coupang-selling-cost",
    title: "쿠팡 판매 수수료는 판매가 기준으로 계산하나요?",
    summary: "대부분 판매가에 수수료율을 곱해 예상 판매 수수료를 계산합니다.",
    tags: ["쿠팡수수료", "초보셀러"],
    authorName: "쿠팡초보",
    createdAt: "2026-06-22T01:29:00.000Z",
    updatedAt: "2026-06-22T01:29:00.000Z",
    views: 189,
    sections: [
      {
        heading: "질문",
        body: ["쿠팡 수수료율 10%면 판매가 2만원 기준으로 2천원을 빼면 되는 건가요?"],
      },
      {
        heading: "답변",
        body: [
          "예상 계산에서는 판매가에 수수료율을 곱해 먼저 잡으면 됩니다.",
          "카테고리와 정책에 따라 실제 수수료율은 달라질 수 있으니 등록 전 최신 기준을 확인하세요.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-final-cost-price-up",
    category: "final-margin",
    title: "최종 비용이 높게 나오면 판매가를 얼마나 올려야 하나요?",
    summary: "목표 마진율을 먼저 정한 뒤 1개당 상품원가와 수수료를 포함해 판매가를 역산해야 합니다.",
    tags: ["로켓그로스", "광고"],
    authorName: "마진확인중",
    createdAt: "2026-06-22T01:46:00.000Z",
    updatedAt: "2026-06-22T01:46:00.000Z",
    views: 181,
    sections: [
      {
        heading: "질문",
        body: ["최종 예상 총비용을 넣으니 마진이 너무 낮게 나오는데 판매가를 감으로 올려도 될까요?"],
      },
      {
        heading: "답변",
        body: [
          "감으로 올리기보다 목표 마진율을 정하고 판매가를 역산하는 편이 안전합니다.",
          "가격을 올리면 전환율이 떨어질 수 있으므로 광고비와 경쟁가도 같이 봐야 합니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-origin-certificate-zero-duty",
    category: "china-korea-logistics",
    title: "원산지증명서가 있으면 관세를 0원으로 봐도 되나요?",
    summary: "관세 판단에는 영향을 줄 수 있지만 수입 부가세와 통관 비용은 별도로 확인해야 합니다.",
    tags: ["세금", "중국사입"],
    authorName: "수입초보",
    createdAt: "2026-06-22T02:03:00.000Z",
    updatedAt: "2026-06-22T02:03:00.000Z",
    views: 174,
    sections: [
      {
        heading: "질문",
        body: ["중국 원산지증명서를 받으면 관세를 0원으로 놓고 계산해도 되는지 궁금합니다."],
      },
      {
        heading: "답변",
        body: [
          "계산기에서는 원산지증명서 선택 시 관세 부담을 0% 기준으로 볼 수 있습니다.",
          "다만 수입 부가세, 통관수수료, 원산지증명서 발급비는 별도 비용으로 남을 수 있습니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-label-work-cost",
    category: "korea-coupang-inbound",
    title: "바코드 라벨 작업비는 한국→쿠팡 비용에 넣는 게 맞나요?",
    summary: "쿠팡센터 입고 전 국내에서 발생하는 작업비라면 한국→쿠팡 단계에 넣는 것이 직관적입니다.",
    tags: ["파레트", "로켓그로스"],
    authorName: "잡화셀러",
    createdAt: "2026-06-22T02:21:00.000Z",
    updatedAt: "2026-06-22T02:21:00.000Z",
    views: 166,
    sections: [
      {
        heading: "질문",
        body: ["라벨 부착 비용을 중국사입 비용에 넣어야 할지 한국 입고 비용에 넣어야 할지 모르겠습니다."],
      },
      {
        heading: "답변",
        body: [
          "국내 도착 후 쿠팡 입고 전 발생하는 작업비라면 한국→쿠팡 단계에 넣는 것이 좋습니다.",
          "그래야 중국사입 원가와 국내 입고 준비 비용이 분리되어 보입니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-ad-cost-per-unit",
    category: "coupang-selling-cost",
    title: "광고비는 월 광고비 말고 1개당으로 나눠야 하나요?",
    summary: "마진 판단은 주문당 광고비로 보는 편이 실전 판단에 가깝습니다.",
    tags: ["광고", "초보셀러"],
    authorName: "광고테스트중",
    createdAt: "2026-06-22T02:44:00.000Z",
    updatedAt: "2026-06-22T02:44:00.000Z",
    views: 154,
    sections: [
      {
        heading: "질문",
        body: ["월 광고비 10만원을 쓰면 계산기에는 어떻게 넣는 게 맞나요?"],
      },
      {
        heading: "답변",
        body: [
          "월 광고비를 예상 주문수로 나눠 주문당 광고비로 보는 것이 좋습니다.",
          "예를 들어 10만원으로 50건 판매가 예상되면 1개당 광고비는 2,000원입니다.",
        ],
      },
    ],
    faq: [],
  },
  {
    slug: "user-q-settlement-vs-profit",
    category: "final-margin",
    title: "정산금액과 순이익이 왜 다르게 나오나요?",
    summary: "정산금액은 판매 후 입금 기준이고 순이익은 원가와 비용을 더 뺀 금액입니다.",
    tags: ["로켓그로스", "초보셀러"],
    authorName: "계산헷갈림",
    createdAt: "2026-06-22T03:05:00.000Z",
    updatedAt: "2026-06-22T03:05:00.000Z",
    views: 146,
    sections: [
      {
        heading: "질문",
        body: ["계산기에서 정산금액은 남는 돈처럼 보이는데 순이익은 더 낮게 나옵니다. 어떤 걸 봐야 하나요?"],
      },
      {
        heading: "답변",
        body: [
          "정산금액은 플랫폼 수수료 등을 뺀 뒤 입금되는 예상 금액에 가깝습니다.",
          "순이익은 거기에서 상품원가, 물류비, 입고비, 광고비 같은 비용을 더 뺀 금액입니다.",
        ],
      },
    ],
    faq: [],
  },
];
