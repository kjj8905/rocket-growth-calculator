import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4176);
const PUBLIC_SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || `http://localhost:${PORT}`);
const SESSION_COOKIE = "rg_session";
const OAUTH_STATE_COOKIE = "rg_kakao_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const DATABASE_PATH = path.resolve(__dirname, process.env.DATABASE_PATH || "./data/app.sqlite");
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "";
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || `http://localhost:${PORT}/auth/kakao/callback`;
const ACCOUNT_FEATURE_ENABLED = process.env.ACCOUNT_FEATURE_ENABLED !== "false";
const SEO_GUIDES = [
  {
    slug: "rocket-growth-calculator",
    title: "로켓그로스 계산기 사용법",
    metaTitle: "로켓그로스 계산기 사용법 | 비용·마진 계산 흐름",
    description:
      "쿠팡 로켓그로스 판매 전 중국사입, LCL 물류, 쿠팡 입고, 쿠팡 수수료, 최종 비용과 마진율을 한 흐름으로 계산하는 기준을 정리합니다.",
    keyword: "로켓그로스 계산기",
    summary:
      "로켓그로스 계산기는 판매가를 정하기 전에 중국사입 원가부터 최종 예상 비용까지 단계별로 확인하는 쿠팡 셀러용 계산기입니다.",
    sections: [
      {
        heading: "계산 흐름",
        body: [
          "이 계산기는 중국사입, 중국→한국 물류, 한국→쿠팡 입고, 쿠팡 비용, 최종 비용 요약의 5단계로 구성되어 있습니다.",
          "각 단계의 입력값은 최종 비용에 합산되고, 최종 비용 단계에서는 마진율과 최소 ROAS를 함께 확인할 수 있습니다.",
        ],
      },
      {
        heading: "왜 단계별로 계산해야 하나요?",
        body: [
          "로켓그로스 판매 비용은 한 항목으로 끝나지 않습니다. 제품 원가, 환율, LCL 운임, 터미널 운송료, 통관비, 수입 부가세, 쿠팡 수수료가 순서대로 붙습니다.",
          "초기 셀러가 가장 많이 놓치는 부분은 물류비와 세금이 판매가 결정 전에 반영되지 않는다는 점입니다.",
        ],
      },
      {
        heading: "계산 결과의 의미",
        body: [
          "최종 예상 총 비용은 상품을 판매하기 전 반드시 회수해야 하는 비용 기준입니다.",
          "마진율은 판매가격에서 비용을 뺀 순이익 비율이고, 최소 ROAS는 광고비를 쓰기 전에 손익분기 기준을 잡기 위한 참고값입니다.",
        ],
      },
    ],
    faq: [
      {
        question: "로켓그로스 계산기는 어떤 사람에게 필요한가요?",
        answer: "쿠팡 로켓그로스 입고를 준비하는 셀러, 중국사입 판매자, 구매대행에서 직접 사입으로 넘어가는 판매자에게 필요합니다.",
      },
      {
        question: "계산 결과는 실제 청구 금액과 완전히 같나요?",
        answer: "아닙니다. 물류사, 관세사, 쿠팡 정책, 상품 HS CODE, 실제 포장 부피에 따라 달라질 수 있으므로 판매 전 예상 기준으로 사용해야 합니다.",
      },
    ],
  },
  {
    slug: "margin-price-calculator",
    title: "마진·판매가 계산기 사용법",
    metaTitle: "마진·판매가 계산기 | 판매가·순이익·목표 마진 역산",
    description:
      "셀러가 판매가, 매입가, 배송비, 광고비, 플랫폼 수수료, 부가세를 넣어 정산금액과 순이익, 목표 마진 판매가를 계산하는 기준을 정리합니다.",
    keyword: "마진율 계산기",
    summary:
      "마진·판매가 계산기는 현재 판매가로 얼마나 남는지 확인하고, 원하는 목표 마진율을 만들기 위해 필요한 판매가를 역산하는 셀러용 계산기입니다.",
    sections: [
      {
        heading: "무엇을 계산하나요?",
        body: [
          "판매가와 배송비 수입을 매출로 보고, 매입가격, 매입 운송비, 택배비, 포장비, 사은품/기타비, 광고비를 비용으로 계산합니다.",
          "카테고리 수수료율, 연동 수수료율, 배송비 수수료율을 따로 입력해 플랫폼 정산 전 차감액을 확인할 수 있습니다.",
        ],
      },
      {
        heading: "목표 마진 판매가",
        body: [
          "목표 마진율을 입력하면 해당 마진율을 만족하는 판매가를 반복 계산으로 역산합니다.",
          "초보 셀러는 상품 등록 전 현재 판매가의 순이익과 목표 판매가를 같이 비교해야 가격을 너무 낮게 잡는 실수를 줄일 수 있습니다.",
        ],
      },
      {
        heading: "주의할 점",
        body: [
          "계산 결과는 판매 전 예상치입니다. 실제 정산은 플랫폼 정책, 쿠폰, 프로모션, 환불, 세무 처리 방식에 따라 달라질 수 있습니다.",
          "일반 과세자는 예상 부가세를 따로 반영하고, 간이/면세는 단순 계산 기준으로 0원 처리합니다.",
        ],
      },
    ],
    faq: [
      {
        question: "손익분기 판매가와 목표 마진 판매가는 무엇이 다른가요?",
        answer: "손익분기 판매가는 순이익이 0원이 되는 판매가이고, 목표 마진 판매가는 입력한 목표 마진율을 만족하는 판매가입니다.",
      },
      {
        question: "광고비도 마진 계산에 넣어야 하나요?",
        answer: "광고비가 이미 발생하거나 반드시 집행할 예정이라면 넣는 것이 현실적입니다. 광고비를 빼면 실제 순이익보다 높게 보일 수 있습니다.",
      },
    ],
  },
  {
    slug: "china-purchase-cost",
    title: "중국사입 원가 계산기 사용법",
    metaTitle: "중국사입 원가 계산기 | 제품별 매입단가·통관·부가세",
    description:
      "중국 상품 사입 시 환율, 제품단가, 수량, 중량, 부피, 중국 내륙 운송비, 구매대행 수수료, 운임, 통관비, 관세, 수입 부가세를 합산하는 기준입니다.",
    keyword: "중국사입 계산기",
    summary:
      "중국사입 원가 계산기는 위안화 제품가와 국내 수입 비용을 합산해 제품별 실제 매입단가와 총 매입예상비용을 계산합니다.",
    sections: [
      {
        heading: "입력해야 할 핵심값",
        body: [
          "업체 고시환율, 제품단가, 제품수량, 중국 내륙 운송비를 입력하면 구매대행 총비용을 계산할 수 있습니다.",
          "총 중량과 총 부피는 운임 견적에 중요한 참고값입니다. 판매자에게 포장 후 중량과 CBM을 확인하는 것이 좋습니다.",
        ],
      },
      {
        heading: "통관·세금 기준",
        body: [
          "세금계산 기준금액은 관세와 수입 부가세를 계산하기 위한 기준값입니다. 모르면 제품구매비용과 예상 운임비를 임시 기준으로 볼 수 있습니다.",
          "원산지증명서를 선택하면 관세율은 0%로 계산하고, 원산지증명서 발급비는 별도 비용으로 합산합니다.",
        ],
      },
      {
        heading: "결과를 어떻게 보나요?",
        body: [
          "총 매입예상비용은 구매대행 총비용, 예상 운임비, 통관비, 관세, 수입 부가세, 기타 사입비를 합친 금액입니다.",
          "제품별 매입단가는 총 매입예상비용을 제품수량으로 나눈 값이며, 마진·판매가 계산기의 매입가격 기준으로 활용할 수 있습니다.",
        ],
      },
    ],
    faq: [
      {
        question: "관세청 고시환율과 업체 고시환율 중 무엇을 써야 하나요?",
        answer: "실제 제품 구매비 환산은 업체 고시환율을 우선 적용하고, 세금 검토에는 관세청 고시환율을 참고하는 방식이 현실적입니다.",
      },
      {
        question: "원산지증명서를 선택하면 모든 세금이 0원이 되나요?",
        answer: "아닙니다. 관세율은 0%로 볼 수 있지만 수입 부가세와 통관 관련 비용은 별도로 발생할 수 있습니다.",
      },
    ],
  },
  {
    slug: "ad-break-even-roas",
    title: "광고 손익분기 계산기 사용법",
    metaTitle: "광고 손익분기 계산기 | 최소 ROAS·허용 광고비·CPC",
    description:
      "판매가, 개당 총원가, 플랫폼 수수료, 부가세, 목표 마진율, ROAS, CPC, 전환율을 기준으로 손해 보지 않는 광고비 한도를 계산합니다.",
    keyword: "ROAS 계산기",
    summary:
      "광고 손익분기 계산기는 주문당 허용 광고비, 최소 ROAS, 손익분기 CPC, 월 광고 후 예상 순이익을 계산해 광고 집행 위험을 판단합니다.",
    sections: [
      {
        heading: "광고 전 이익부터 봅니다",
        body: [
          "판매가에서 개당 총원가, 플랫폼 수수료, 예상 부가세를 뺀 금액이 광고 전 이익입니다.",
          "목표 마진율을 반영한 목표 순이익을 광고 전 이익에서 차감하면 주문당 허용 광고비가 나옵니다.",
        ],
      },
      {
        heading: "ROAS와 CPC 기준",
        body: [
          "최소 ROAS는 판매가를 주문당 허용 광고비로 나눠 계산합니다. 현재 ROAS가 최소 ROAS보다 낮으면 광고 집행이 위험할 수 있습니다.",
          "손익분기 CPC는 허용 광고비와 전환율을 곱해 계산합니다. 전환율이 낮을수록 허용 CPC도 낮아집니다.",
        ],
      },
      {
        heading: "위험 상태 해석",
        body: [
          "허용 광고비가 음수이거나 월 광고 후 예상 순이익이 음수면 손실 상태로 표시합니다.",
          "현재 ROAS가 최소 ROAS보다 낮지만 손실은 아닌 경우 주의 상태로 표시합니다.",
        ],
      },
    ],
    faq: [
      {
        question: "ROAS가 높으면 무조건 수익인가요?",
        answer: "아닙니다. 상품 원가와 수수료가 높으면 높은 ROAS에서도 순이익이 낮거나 손실이 날 수 있습니다.",
      },
      {
        question: "전환율을 모르면 어떻게 입력하나요?",
        answer: "초기에는 1%처럼 보수적인 값으로 시작하고, 실제 광고 데이터가 쌓이면 상품별 전환율로 다시 계산하는 것이 좋습니다.",
      },
    ],
  },
  {
    slug: "cash-flow-calculator",
    title: "사입·정산 현금흐름 계산기 사용법",
    metaTitle: "사입·정산 현금흐름 계산기 | 월말 잔액·발주 가능금액",
    description:
      "월초 현금, 쇼핑몰 정산금, 매입비, 물류비, 광고비, 고정비와 변동비를 기준으로 월말 현금 부족 위험과 다음 발주 가능금액을 계산합니다.",
    keyword: "현금흐름 계산기",
    summary:
      "사입·정산 현금흐름 계산기는 먼저 지출하고 나중에 정산받는 셀러가 월말 잔액, 목표 대비 차액, 다음 발주 가능금액을 확인하는 도구입니다.",
    sections: [
      {
        heading: "왜 셀러에게 현금흐름이 중요한가요?",
        body: [
          "사입 판매자는 상품매입비와 물류비를 먼저 쓰고, 쇼핑몰 정산금은 며칠 또는 몇 주 뒤에 받는 경우가 많습니다.",
          "손익이 괜찮아도 현금이 먼저 부족하면 발주, 광고, 입고가 끊길 수 있으므로 월말 잔액을 따로 봐야 합니다.",
        ],
      },
      {
        heading: "고정비와 변동비를 나눕니다",
        body: [
          "고정비는 인건비, 임차료, 4대보험/세금, 공과금, 솔루션 사용료처럼 매출과 무관하게 나가는 비용입니다.",
          "변동비는 상품매입비, 국제/국내 물류비, 광고비, 포장/작업비, 반품/CS 비용처럼 판매 규모에 따라 달라지는 비용입니다.",
        ],
      },
      {
        heading: "현금 부족 경고",
        body: [
          "월말 예상 잔액이 0원 미만이거나 안전 현금 기준을 뺀 다음 발주 가능금액이 음수면 현금 부족 위험으로 봅니다.",
          "목표 월말 잔액보다 부족하면 주의 상태로 표시해 추가 사입 또는 광고 집행 전 점검할 수 있습니다.",
        ],
      },
    ],
    faq: [
      {
        question: "다음 발주 가능금액은 무엇인가요?",
        answer: "월말 예상 잔액에서 안전 현금 기준을 뺀 금액입니다. 이 값이 음수면 다음 발주를 무리하게 진행하면 현금이 부족해질 수 있습니다.",
      },
      {
        question: "순이익 계산기와 현금흐름 계산기는 무엇이 다른가요?",
        answer: "순이익 계산기는 상품 단위 수익성을 보고, 현금흐름 계산기는 실제 돈이 언제 들어오고 나가는지를 봅니다.",
      },
    ],
  },
  {
    slug: "lcl-logistics-cost",
    title: "중국→한국 LCL 물류비 계산 기준",
    metaTitle: "중국→한국 LCL 물류비 계산 기준 | 해상운임·터미널 운송료",
    description:
      "중국사입 상품을 한국으로 들여올 때 LCL 해상운임, CBM, 청구 부피, 터미널 운송료가 비용에 어떻게 반영되는지 설명합니다.",
    keyword: "LCL 물류비 계산",
    summary:
      "LCL 물류비는 부피 입력값을 기준으로 해상운임과 터미널 운송료를 예상 계산합니다. 현재 운임은 최저가 기준 예상치이며 실제 청구 운임은 변동될 수 있습니다.",
    sections: [
      {
        heading: "CBM과 청구 부피",
        body: [
          "CBM은 가로, 세로, 높이를 곱해 계산하는 부피 단위입니다. LCL 화물은 실제 중량뿐 아니라 부피가 운임에 중요한 영향을 줍니다.",
          "판매자에게 포장 후 실제 부피를 확인하고 입력해야 예상 운송비가 현실에 가까워집니다.",
        ],
      },
      {
        heading: "LCL 해상운임",
        body: [
          "현재 계산기는 화물선 기본 1CBM 65,000원, 훼리선 기본 1CBM 78,000원을 기준으로 예상치를 계산합니다.",
          "추가 운임은 0.1CBM당 9,000원 기준으로 반영합니다. 이 기준은 최저가 기준 예상치이며 물류사와 출항 조건에 따라 달라질 수 있습니다.",
        ],
      },
      {
        heading: "터미널 운송료",
        body: [
          "터미널 운송료는 화물이 입항 후 국내 터미널에서 처리되며 발생하는 운송 관련 비용입니다.",
          "이 비용은 LCL 물류 총비용에 포함되지만, 세금계산 기준금액 자체와는 구분해서 봐야 합니다.",
        ],
      },
    ],
    faq: [
      {
        question: "LCL 해상운임은 왜 최저가 기준 예상치인가요?",
        answer: "선박 종류, 출항일, 물류사 정책, 화물 조건에 따라 실제 청구 운임이 달라질 수 있기 때문에 계산기는 판매 전 가늠용 기준으로 제공합니다.",
      },
      {
        question: "부피를 모르면 어떻게 해야 하나요?",
        answer: "판매자 또는 포워딩 업체에 포장 후 가로, 세로, 높이와 총 CBM을 확인한 뒤 입력하는 것이 가장 정확합니다.",
      },
    ],
  },
  {
    slug: "import-vat-customs",
    title: "수입 부가세 10%와 관세 계산 기준",
    metaTitle: "수입 부가세 10%와 관세 계산 기준 | 로켓그로스 계산기",
    description:
      "중국 수입 상품의 세금계산 기준금액, 관세, 원산지증명서, 수입 부가세 10%, 통관수수료의 차이를 설명합니다.",
    keyword: "수입 부가세 10%",
    summary:
      "수입 부가세 10%는 관세와 별도로 한국 세관에서 계산되는 수입 VAT입니다. 원산지증명서로 관세가 0%여도 수입 부가세는 별도로 발생할 수 있습니다.",
    sections: [
      {
        heading: "세금계산 기준금액",
        body: [
          "세금계산 기준금액은 관세와 수입 부가세를 계산할 때 참고하는 수입 신고 기준 금액입니다.",
          "제품 원가, 국제 운임, 보험료 등 수입 신고 기준에 포함되는 항목이 반영될 수 있으며, 터미널 운송료나 통관 대행 수수료와는 구분됩니다.",
        ],
      },
      {
        heading: "원산지증명서와 관세",
        body: [
          "원산지증명서를 선택하면 현재 계산기는 중국 무관세 기준으로 관세율을 0%로 고정합니다.",
          "다만 원산지증명서 발급 비용은 별도 작업 비용으로 물류 총비용에 포함됩니다.",
        ],
      },
      {
        heading: "수입 부가세 10%",
        body: [
          "수입 부가세는 관세와 다른 항목입니다. 관세가 0원이어도 수입 부가세 10%는 발생할 수 있습니다.",
          "사업자 기준에서는 세무 처리 방식에 따라 환급 또는 공제 가능성이 있으므로 회계 처리 단계에서 별도로 확인해야 합니다.",
        ],
      },
    ],
    faq: [
      {
        question: "원산지증명서가 있으면 모든 세금이 0원이 되나요?",
        answer: "아닙니다. 관세가 0%로 계산될 수 있지만 수입 부가세 10%와 통관 관련 수수료는 별도로 발생할 수 있습니다.",
      },
      {
        question: "통관수수료는 어떤 비용인가요?",
        answer: "관세사가 수입 신고와 통관 업무를 처리하며 청구하는 대행 수수료 성격의 비용입니다. 관세나 수입 부가세와는 다른 비용입니다.",
      },
    ],
  },
  {
    slug: "coupang-pallet-cost",
    title: "쿠팡 파레트 비용 계산 기준",
    metaTitle: "쿠팡 파레트 비용 계산 기준 | 파레트 없이·쿠팡 파레트",
    description:
      "쿠팡 로켓그로스 입고 시 파레트 없이 발송하는 경우와 쿠팡 파레트&랩핑을 적용하는 경우의 비용 계산 기준을 설명합니다.",
    keyword: "쿠팡 파레트 비용",
    summary:
      "파레트 없이 입고할 수 있으면 파레트 비용은 0원으로 계산하고, 쿠팡 파레트&랩핑을 선택하면 파레트 수량당 30,000원 기준으로 계산합니다.",
    sections: [
      {
        heading: "파레트 없이 발송",
        body: [
          "상품 조건과 입고 방식에 따라 파레트 없이 발송할 수 있습니다. 이 경우 계산기에서는 파레트 비용을 0원으로 처리합니다.",
          "다만 실제 입고 가능 여부는 상품 수량, 박스 상태, 쿠팡 센터 요구조건에 따라 확인이 필요합니다.",
        ],
      },
      {
        heading: "쿠팡 파레트&랩핑",
        body: [
          "쿠팡 파레트&랩핑은 파레트 수량당 30,000원 기준으로 계산합니다.",
          "파레트 수량이 늘어나면 한국→쿠팡 입고 비용도 함께 증가하므로 최종 비용 계산 전에 수량을 확인해야 합니다.",
        ],
      },
      {
        heading: "일반 파레트와 차이",
        body: [
          "일반 파레트&랩핑은 파레트 수량당 35,000원 기준으로 별도 선택할 수 있습니다.",
          "실제 비용은 물류사 작업 방식과 입고 센터 조건에 따라 달라질 수 있습니다.",
        ],
      },
    ],
    faq: [
      {
        question: "쿠팡 입고는 반드시 파레트가 필요한가요?",
        answer: "항상 필요한 것은 아닙니다. 파레트 없이 보낼 수 있는 경우도 있으므로 상품과 입고 조건에 따라 확인해야 합니다.",
      },
      {
        question: "파레트 비용은 한 파레트당 비용인가요?",
        answer: "현재 계산기에서는 쿠팡 파레트&랩핑을 파레트 1개당 30,000원 기준으로 계산합니다.",
      },
    ],
  },
  {
    slug: "coupang-fee",
    title: "쿠팡 판매 수수료 계산 기준",
    metaTitle: "쿠팡 판매 수수료 계산 기준 | 로켓그로스 비용",
    description:
      "쿠팡 비용 단계에서 쿠팡 판매 수수료율을 입력하고 판매가 기준 수수료를 계산하는 방식과 주의사항을 설명합니다.",
    keyword: "쿠팡 판매 수수료",
    summary:
      "쿠팡 비용 단계는 현재 쿠팡 판매 수수료를 중심으로 계산합니다. 로켓그로스 사용료는 별도 고정 항목으로 두지 않고 실제 정책 확인이 필요한 항목으로 구분합니다.",
    sections: [
      {
        heading: "쿠팡 판매 수수료",
        body: [
          "쿠팡 판매 수수료는 카테고리별 수수료율을 판매가격에 적용해 계산하는 비용입니다.",
          "계산기에서는 대분류와 세부 카테고리를 선택하거나 직접 수수료율을 입력해 예상 수수료를 확인할 수 있습니다.",
        ],
      },
      {
        heading: "로켓그로스 사용료",
        body: [
          "현재 계산기에는 로켓그로스 사용료를 별도 고정 항목으로 넣지 않았습니다.",
          "로켓그로스 관련 비용은 쿠팡 정책과 상품 조건에 따라 달라질 수 있으므로 공식 공지와 실제 정산 자료 확인이 필요합니다.",
        ],
      },
      {
        heading: "마진 계산과 연결",
        body: [
          "쿠팡 판매 수수료는 최종 비용과 순이익 계산에 직접 반영됩니다.",
          "판매가를 낮게 잡으면 물류비와 수수료를 반영한 뒤 실제 마진이 급격히 줄어들 수 있습니다.",
        ],
      },
    ],
    faq: [
      {
        question: "쿠팡 판매 수수료율은 고정인가요?",
        answer: "카테고리와 쿠팡 정책에 따라 다릅니다. 계산기에서는 예상 수수료율을 입력하거나 선택해 판매 전 참고값을 계산합니다.",
      },
      {
        question: "로켓그로스 사용료는 왜 별도 항목이 없나요?",
        answer: "현재 요청 기준에서는 쿠팡 비용을 쿠팡 판매 수수료 중심으로 구성했고, 로켓그로스 사용료는 실제 정책 확인이 필요한 항목으로 분리했습니다.",
      },
    ],
  },
];

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

const db = new DatabaseSync(DATABASE_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kakao_id TEXT NOT NULL UNIQUE,
    nickname TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT,
    stages_json TEXT NOT NULL,
    final_summary_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

migrateProductNameKeys();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

app.use(async (req, res, next) => {
  const session = getSessionFromRequest(req);
  req.currentUser = session?.user || null;
  req.currentSessionId = session?.sessionId || null;
  next();
});

app.get("/api/me", (req, res) => {
  const accountFeatureEnabled = isAccountFeatureEnabled();

  res.json({
    accountFeatureEnabled,
    authenticated: accountFeatureEnabled && Boolean(req.currentUser),
    kakaoConfigured: isKakaoConfigured(),
    user: accountFeatureEnabled && req.currentUser
      ? {
          id: req.currentUser.id,
          kakaoId: req.currentUser.kakao_id,
          nickname: req.currentUser.nickname,
          email: req.currentUser.email,
        }
      : null,
  });
});

app.get("/auth/kakao/start", (req, res) => {
  if (!isAccountFeatureEnabled()) {
    res.status(404).send("계정 기능은 현재 제공되지 않습니다.");
    return;
  }

  if (!isKakaoConfigured()) {
    res.status(503).send(renderConfigErrorPage());
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  setSignedCookie(res, OAUTH_STATE_COOKIE, state, {
    maxAgeMs: OAUTH_STATE_TTL_MS,
    path: "/auth/kakao",
  });

  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", KAKAO_REST_API_KEY);
  url.searchParams.set("redirect_uri", KAKAO_REDIRECT_URI);
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

app.get("/auth/kakao/callback", async (req, res) => {
  if (!isKakaoConfigured()) {
    res.status(503).send(renderConfigErrorPage());
    return;
  }

  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    res.redirect(`/?auth=cancelled&reason=${encodeURIComponent(String(errorDescription || error))}`);
    return;
  }

  const cookieState = readSignedCookie(req, OAUTH_STATE_COOKIE);
  clearCookie(res, OAUTH_STATE_COOKIE, "/auth/kakao");

  if (!code || !state || !cookieState || state !== cookieState) {
    res.redirect("/?auth=invalid-state");
    return;
  }

  try {
    const token = await requestKakaoToken(String(code));
    const kakaoUser = await requestKakaoUser(token.access_token);
    const user = upsertUser(kakaoUser);
    const sessionId = createSession(user.id);

    setSignedCookie(res, SESSION_COOKIE, sessionId, {
      maxAgeMs: SESSION_TTL_MS,
      path: "/",
    });

    res.redirect("/?auth=success");
  } catch (errorObject) {
    console.error("Kakao login failed:", errorObject);
    res.redirect(`/?auth=error&reason=${encodeURIComponent(errorObject.message || "kakao-login-failed")}`);
  }
});

app.post("/auth/logout", requireLogin, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(req.currentSessionId);
  clearCookie(res, SESSION_COOKIE, "/");
  res.json({ ok: true });
});

app.get("/api/products", requireLogin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, stages_json, final_summary_json, created_at, updated_at
       FROM products
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(req.currentUser.id);

  res.json({
    products: rows.map(productFromRow),
  });
});

app.post("/api/products", requireLogin, (req, res) => {
  const name = String(req.body?.name || "").trim() || "상품 1";
  const nameKey = normalizeProductNameKey(name);
  const requestedId = String(req.body?.id || "").trim();
  const stages = req.body?.stages || {};
  const finalSummary = req.body?.finalSummary || {};
  const now = new Date().toISOString();
  const existingById = requestedId
    ? db.prepare("SELECT id FROM products WHERE id = ? AND user_id = ?").get(requestedId, req.currentUser.id)
    : null;
  const existingByName = nameKey
    ? db.prepare("SELECT id FROM products WHERE user_id = ? AND name_key = ? ORDER BY updated_at DESC").get(req.currentUser.id, nameKey)
    : null;
  const existing = existingById || existingByName;
  const id = existing?.id || requestedId || `product-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  if (existingById && existingByName && existingById.id !== existingByName.id) {
    res.status(409).json({
      error: "product_name_exists",
      message: "같은 상품명이 이미 저장되어 있습니다.",
      productId: existingByName.id,
    });
    return;
  }

  if (existing) {
    db.prepare(
      `UPDATE products
       SET name = ?, name_key = ?, stages_json = ?, final_summary_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(name, nameKey, JSON.stringify(stages), JSON.stringify(finalSummary), now, id, req.currentUser.id);
  } else {
    db.prepare(
      `INSERT INTO products (id, user_id, name, name_key, stages_json, final_summary_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, req.currentUser.id, name, nameKey, JSON.stringify(stages), JSON.stringify(finalSummary), now, now);
  }

  const row = db
    .prepare(
      `SELECT id, name, stages_json, final_summary_json, created_at, updated_at
       FROM products
       WHERE id = ? AND user_id = ?`,
    )
    .get(id, req.currentUser.id);

  res.json({ product: productFromRow(row), mode: existing ? "updated" : "created" });
});

app.delete("/api/products/:id", requireLogin, (req, res) => {
  const productId = String(req.params.id || "").trim();
  if (!productId) {
    res.status(400).json({ error: "invalid_product_id", message: "삭제할 계산안을 찾지 못했습니다." });
    return;
  }

  const result = db.prepare("DELETE FROM products WHERE id = ? AND user_id = ?").run(productId, req.currentUser.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "product_not_found", message: "삭제할 계산안을 찾지 못했습니다." });
    return;
  }

  res.json({ ok: true, deletedId: productId });
});

app.get(["/", "/index.html"], (req, res) => {
  res.type("html").send(renderIndexHtml());
});

app.get(["/guides", "/guides/"], (req, res) => {
  res.type("html").send(renderGuideIndexPage());
});

app.get("/guides/:slug", (req, res) => {
  const guide = SEO_GUIDES.find((item) => item.slug === req.params.slug);
  if (!guide) {
    res.status(404).type("html").send(renderNotFoundPage());
    return;
  }

  res.type("html").send(renderGuidePage(guide));
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(renderRobotsTxt());
});

app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml").send(renderSitemapXml());
});

app.get("/llms.txt", (req, res) => {
  res.type("text/plain").send(renderLlmsTxt());
});

app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    service: "rocket-growth-calculator",
    time: new Date().toISOString(),
  });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Rocket Growth Calculator running at http://localhost:${PORT}`);
  if (!isKakaoConfigured()) {
    console.log("Kakao login is not configured.");
  }
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const index = trimmed.indexOf("=");
    if (index < 0) {
      return;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function normalizeSiteUrl(value) {
  const url = String(value || "").trim().replace(/\/+$/, "");
  return url || `http://localhost:${PORT}`;
}

function renderIndexHtml() {
  const filePath = path.join(__dirname, "index.html");
  return fs
    .readFileSync(filePath, "utf8")
    .replaceAll("__SITE_URL__", PUBLIC_SITE_URL)
    .replace(/<section class="overview-section" aria-labelledby="overview-title" hidden>/, '<section class="overview-section" aria-labelledby="overview-title">')
    .replace(/<div class="category-explain-grid" aria-label="[^"]*" hidden>/, (match) => match.replace(" hidden", ""))
    .replace(/<section class="seo-content-section knowledge-hub-teaser" aria-labelledby="knowledge-title" hidden>/, '<section class="seo-content-section knowledge-hub-teaser" aria-labelledby="knowledge-title">');
}

function renderGuideIndexPage() {
  const title = "로켓그로스 계산기 지식 허브";
  const description = "로켓그로스 계산기, LCL 물류비, 수입 부가세, 쿠팡 파레트 비용, 쿠팡 판매 수수료 기준을 정리한 지식 허브입니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/guides`;
  const guideLinks = SEO_GUIDES.map(
    (guide) => `<li>
      <a href="/guides/${guide.slug}">
        <strong>${escapeHtml(guide.title)}</strong>
        <span>${escapeHtml(guide.description)}</span>
      </a>
    </li>`,
  ).join("");

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="guide-page-shell">
      <article class="guide-article">
        <p class="eyebrow">지식 허브</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="guide-lede">${escapeHtml(description)}</p>
        <ul class="guide-link-stack">${guideLinks}</ul>
        <div class="guide-cta">
          <a class="guide-primary-link" href="/">계산기로 돌아가기</a>
        </div>
      </article>
    </main>`,
    jsonLd: buildGuideIndexJsonLd(title, description, canonicalUrl),
  });
}

function renderGuidePage(guide) {
  const canonicalUrl = `${PUBLIC_SITE_URL}/guides/${guide.slug}`;
  const sections = guide.sections
    .map(
      (section) => `<section>
        <h2>${escapeHtml(section.heading)}</h2>
        ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </section>`,
    )
    .join("");
  const faq = guide.faq
    .map(
      (item) => `<article>
        <h3>${escapeHtml(item.question)}</h3>
        <p>${escapeHtml(item.answer)}</p>
      </article>`,
    )
    .join("");
  const relatedLinks = SEO_GUIDES.filter((item) => item.slug !== guide.slug)
    .slice(0, 4)
    .map((item) => `<a href="/guides/${item.slug}">${escapeHtml(item.title)}</a>`)
    .join("");

  return renderDocumentShell({
    title: guide.metaTitle,
    description: guide.description,
    canonicalUrl,
    body: `<main class="guide-page-shell">
      <article class="guide-article">
        <nav class="guide-breadcrumb" aria-label="breadcrumb">
          <a href="/">계산기</a>
          <span>/</span>
          <a href="/guides">지식 허브</a>
        </nav>
        <p class="eyebrow">${escapeHtml(guide.keyword)}</p>
        <h1>${escapeHtml(guide.title)}</h1>
        <p class="guide-lede">${escapeHtml(guide.summary)}</p>
        <div class="guide-cta">
          <a class="guide-primary-link" href="${getCalculatorHref(guide.slug)}">계산기에서 확인하기</a>
          <a class="guide-secondary-link" href="/guides">다른 기준 보기</a>
        </div>
        <div class="guide-section-list">${sections}</div>
        <section class="guide-faq-block" aria-labelledby="guide-faq-title">
          <p class="eyebrow">FAQ</p>
          <h2 id="guide-faq-title">자주 묻는 질문</h2>
          <div class="guide-faq-list">${faq}</div>
        </section>
        <aside class="guide-related" aria-label="관련 가이드">
          <p class="eyebrow">관련 기준</p>
          <div>${relatedLinks}</div>
        </aside>
      </article>
    </main>`,
    jsonLd: buildGuideJsonLd(guide, canonicalUrl),
  });
}

function renderNotFoundPage() {
  return renderDocumentShell({
    title: "페이지를 찾을 수 없습니다",
    description: "요청한 로켓그로스 계산기 가이드 페이지를 찾을 수 없습니다.",
    canonicalUrl: `${PUBLIC_SITE_URL}/guides`,
    body: `<main class="guide-page-shell">
      <article class="guide-article">
        <p class="eyebrow">404</p>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <p class="guide-lede">주소를 다시 확인하거나 지식 허브에서 필요한 계산 기준을 선택하세요.</p>
        <div class="guide-cta">
          <a class="guide-primary-link" href="/guides">지식 허브 보기</a>
          <a class="guide-secondary-link" href="/">계산기로 돌아가기</a>
        </div>
      </article>
    </main>`,
    jsonLd: null,
  });
}

function renderDocumentShell({ title, description, canonicalUrl, body, jsonLd }) {
  const jsonLdBlock = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2).replace(/</g, "\\u003c")}</script>`
    : "";

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:site_name" content="로켓그로스 계산기" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${PUBLIC_SITE_URL}/assets/site-flow.svg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${PUBLIC_SITE_URL}/assets/site-flow.svg" />
    <link rel="stylesheet" href="/styles.css" />
    ${jsonLdBlock}
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function buildGuideIndexJsonLd(title, description, canonicalUrl) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationNode(),
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        name: title,
        description,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        isPartOf: {
          "@id": `${PUBLIC_SITE_URL}/#website`,
        },
        hasPart: SEO_GUIDES.map((guide) => ({
          "@type": "WebPage",
          name: guide.title,
          url: `${PUBLIC_SITE_URL}/guides/${guide.slug}`,
        })),
      },
    ],
  };
}

function buildGuideJsonLd(guide, canonicalUrl) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationNode(),
      {
        "@type": "Article",
        "@id": `${canonicalUrl}#article`,
        headline: guide.title,
        name: guide.title,
        description: guide.description,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        mainEntityOfPage: canonicalUrl,
        author: {
          "@id": `${PUBLIC_SITE_URL}/#organization`,
        },
        publisher: {
          "@id": `${PUBLIC_SITE_URL}/#organization`,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "로켓그로스 계산기",
            item: `${PUBLIC_SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "지식 허브",
            item: `${PUBLIC_SITE_URL}/guides`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: guide.title,
            item: canonicalUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        inLanguage: "ko-KR",
        mainEntity: guide.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

function buildOrganizationNode() {
  return {
    "@type": "Organization",
    "@id": `${PUBLIC_SITE_URL}/#organization`,
    name: "로켓그로스 계산기",
    url: `${PUBLIC_SITE_URL}/`,
  };
}

function getCalculatorHref(slug) {
  const routes = {
    "rocket-growth-calculator": "/",
    "margin-price-calculator": "/?category=margin",
    "china-purchase-cost": "/?category=china-purchase",
    "ad-break-even-roas": "/?category=ad-break-even",
    "cash-flow-calculator": "/?category=cash-flow",
    "lcl-logistics-cost": "china-korea",
    "import-vat-customs": "china-korea",
    "coupang-pallet-cost": "korea-coupang",
    "coupang-fee": "coupang",
  };
  const route = routes[slug] || "final";
  return route.startsWith("/") ? route : `/?calc=${route}`;
}

function renderRobotsTxt() {
  return [
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    `Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

function renderSitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${PUBLIC_SITE_URL}/`, priority: "1.0", changefreq: "weekly" },
    { loc: `${PUBLIC_SITE_URL}/guides`, priority: "0.8", changefreq: "monthly" },
    ...SEO_GUIDES.map((guide) => ({
      loc: `${PUBLIC_SITE_URL}/guides/${guide.slug}`,
      priority: guide.slug === "rocket-growth-calculator" ? "0.9" : "0.8",
      changefreq: "monthly",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

function renderLlmsTxt() {
  const guideList = SEO_GUIDES.map((guide) => `- ${guide.title}: ${PUBLIC_SITE_URL}/guides/${guide.slug}
  - ${guide.summary}`).join("\n");

  return `# 로켓그로스 계산기

로켓그로스 계산기는 쿠팡 로켓그로스 판매자가 판매 전 비용을 단계별로 계산할 수 있는 한국어 웹 계산기입니다.

## 주요 기능
- 마진·판매가 계산
- 중국사입 원가 계산
- 광고 손익분기와 최소 ROAS 계산
- 사입·정산 현금흐름 계산
- 중국→한국 LCL 물류비 계산
- 한국→쿠팡 입고 비용 계산
- 쿠팡 판매 수수료 계산
- 최종 비용, 마진율, 최소 ROAS 요약

## 주요 답변
- 원산지증명서를 선택하면 관세율은 0%로 계산합니다.
- 수입 부가세 10%는 관세와 별도로 계산되는 수입 VAT입니다.
- 쿠팡 파레트&랩핑은 파레트 수량당 30,000원 기준으로 계산합니다.
- 파레트 없이 발송하면 파레트 비용은 0원입니다.

## 지식 허브
- 지식 허브: ${PUBLIC_SITE_URL}/guides
${guideList}

## Canonical
${PUBLIC_SITE_URL}/
`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isKakaoConfigured() {
  return isAccountFeatureEnabled() && Boolean(KAKAO_REST_API_KEY && KAKAO_REDIRECT_URI);
}

function isAccountFeatureEnabled() {
  return ACCOUNT_FEATURE_ENABLED;
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function encodeSignedValue(value) {
  return `${value}.${sign(value)}`;
}

function decodeSignedValue(value) {
  const [raw, signature] = String(value || "").split(".");
  if (!raw || !signature) {
    return null;
  }

  const expected = sign(raw);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  return raw;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf("=");
        if (index < 0) {
          return [pair, ""];
        }
        return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
      }),
  );
}

function readSignedCookie(req, name) {
  return decodeSignedValue(parseCookies(req)[name]);
}

function setSignedCookie(res, name, value, options) {
  const maxAgeSeconds = Math.floor(options.maxAgeMs / 1000);
  res.cookie(name, encodeSignedValue(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: options.maxAgeMs,
    path: options.path,
  });
  res.setHeader("Cache-Control", "no-store");
  return maxAgeSeconds;
}

function clearCookie(res, name, pathValue) {
  res.clearCookie(name, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: pathValue,
  });
}

function getSessionFromRequest(req) {
  const sessionId = readSignedCookie(req, SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT sessions.id AS session_id, sessions.expires_at, users.id, users.kakao_id, users.nickname, users.email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?`,
    )
    .get(sessionId);

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      kakao_id: row.kakao_id,
      nickname: row.nickname,
      email: row.email,
    },
  };
}

function requireLogin(req, res, next) {
  if (!isAccountFeatureEnabled()) {
    res.status(403).json({ error: "account_feature_disabled", message: "저장 기능은 현재 제공하지 않습니다." });
    return;
  }

  if (!req.currentUser) {
    res.status(401).json({ error: "login_required", message: "상품 저장을 위해 로그인이 필요합니다." });
    return;
  }
  next();
}

function normalizeProductNameKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function migrateProductNameKeys() {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  const hasNameKey = columns.some((column) => column.name === "name_key");

  if (!hasNameKey) {
    db.exec("ALTER TABLE products ADD COLUMN name_key TEXT");
  }

  const products = db.prepare("SELECT id, name FROM products WHERE name_key IS NULL OR name_key = ''").all();
  const updateNameKey = db.prepare("UPDATE products SET name_key = ? WHERE id = ?");
  products.forEach((product) => {
    updateNameKey.run(normalizeProductNameKey(product.name), product.id);
  });

  db.exec("CREATE INDEX IF NOT EXISTS products_user_name_key_idx ON products (user_id, name_key)");
  const duplicate = db
    .prepare(
      `SELECT user_id, name_key, COUNT(*) AS count
       FROM products
       WHERE name_key IS NOT NULL AND name_key <> ''
       GROUP BY user_id, name_key
       HAVING COUNT(*) > 1
       LIMIT 1`,
    )
    .get();
  if (!duplicate) {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS products_user_name_key_unique
       ON products (user_id, name_key)
       WHERE name_key IS NOT NULL AND name_key <> ''`,
    );
  }
}

async function requestKakaoToken(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: KAKAO_REDIRECT_URI,
    code,
  });

  if (KAKAO_CLIENT_SECRET) {
    body.set("client_secret", KAKAO_CLIENT_SECRET);
  }

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || "kakao-token-request-failed");
  }

  return data;
}

async function requestKakaoUser(accessToken) {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || "kakao-user-request-failed");
  }

  return data;
}

function upsertUser(kakaoUser) {
  const kakaoId = String(kakaoUser.id);
  const account = kakaoUser.kakao_account || {};
  const profile = account.profile || {};
  const nickname = profile.nickname || null;
  const email = account.email || null;
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT * FROM users WHERE kakao_id = ?").get(kakaoId);

  if (existing) {
    db.prepare("UPDATE users SET nickname = ?, email = ?, updated_at = ? WHERE kakao_id = ?").run(
      nickname,
      email,
      now,
      kakaoId,
    );
    return db.prepare("SELECT * FROM users WHERE kakao_id = ?").get(kakaoId);
  }

  const result = db
    .prepare("INSERT INTO users (kakao_id, nickname, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(kakaoId, nickname, email, now, now);

  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
}

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(sessionId, userId, expiresAt);
  return sessionId;
}

function productFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    stages: parseJson(row.stages_json, {}),
    finalSummary: parseJson(row.final_summary_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function renderConfigErrorPage() {
  return `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>계정 기능 점검 중</title>
        <style>
          body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f9fafb; color: #191f28; }
          main { max-width: 640px; margin: 80px auto; padding: 32px; border-radius: 16px; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
          h1 { margin: 0 0 16px; font-size: 26px; line-height: 36px; }
          p { color: #4e5968; line-height: 24px; }
          a { color: #3182f6; font-weight: 700; }
        </style>
      </head>
      <body>
        <main>
          <h1>계정 기능을 점검하고 있습니다.</h1>
          <p>계산기는 바로 사용할 수 있고, 상품 저장은 잠시 후 다시 이용해 주세요.</p>
          <p><a href="/">계산기로 돌아가기</a></p>
        </main>
      </body>
    </html>
  `;
}
