# Rocket Growth Calculator SEO/AEO/GEO Strategy

작성일: 2026-06-06

## Brand Core 결론

현재 적용된 메타태그, FAQ, JSON-LD, sitemap, robots.txt만으로는 "로켓그로스 계산기" 검색 노출을 충분히 만들기 어렵다.

이유는 단순하다. 검색엔진과 AI 답변 엔진은 페이지가 무엇인지 이해할 단서만 보는 것이 아니라, 사용자가 묻는 질문에 대해 독립적으로 인용할 수 있는 충분한 텍스트, 주제별 URL, 내부 연결, 외부 신뢰 신호를 함께 본다. 계산기 한 페이지 안에 FAQ만 넣는 방식은 기본 안전장치로는 맞지만, GEO/AEO 관점에서는 "공식 지식 출처"가 부족하다.

따라서 계산기는 첫 화면의 주인공으로 유지하고, 검색 및 AI 크롤러가 읽기 쉬운 주제별 지식 허브 URL을 별도로 만든다.

## Department Review

### Brand Core

- 계산기 UX가 핵심이다. SEO 문구를 상단에 과하게 배치하면 사용자가 바로 계산하지 못한다.
- 브랜드의 신뢰는 "과장된 마케팅 문구"가 아니라 계산 기준, 비용 항목, 주의사항을 투명하게 설명하는 데서 생긴다.
- 로켓그로스 비용 계산이라는 좁은 문제를 깊게 해결하는 것이 초기 포지셔닝에 가장 적합하다.

### Marketing / GEO

- SEO는 검색결과 노출, AEO는 질문형 답변 최적화, GEO는 생성형 AI 답변에 인용될 수 있는 출처 구조를 만드는 일로 본다.
- AI 답변 엔진은 단일 랜딩보다 주제별로 명확한 문서를 더 쉽게 해석한다.
- "로켓그로스 계산기", "로켓그로스 마진 계산기", "쿠팡 로켓그로스 비용", "중국사입 계산기", "LCL 물류비 계산", "수입 부가세 10%", "쿠팡 파레트 비용"처럼 의도별 쿼리를 분리해야 한다.

### Content Strategy

- 이미지 안에만 있는 설명은 크롤러가 안정적으로 이해하기 어렵다. 계산 기준은 반드시 HTML 텍스트로 병기한다.
- FAQ만 반복하면 얕은 콘텐츠가 된다. 각 질문은 독립 URL에서 계산 기준, 예외, 주의사항, 관련 계산기 링크를 함께 제공해야 한다.
- 향후 블로그, 유튜브, 고객 리뷰, 보도자료는 사이트의 공식 설명을 보강하는 외부 신뢰 근거로 운영한다.

### Development

- 동적 계산기는 유지하되, 지식 문서는 서버 렌더링 HTML로 제공한다.
- 각 지식 문서는 고유 canonical, title, meta description, Article/WebPage JSON-LD, FAQPage JSON-LD, BreadcrumbList를 가져야 한다.
- sitemap.xml과 llms.txt에 지식 문서 URL을 포함한다.
- robots.txt는 검색엔진과 AI 검색 크롤러가 공개 문서를 수집할 수 있게 하되, API와 인증 경로는 제외한다.

### Data / Measurement

- 노출은 적용 직후 확정되지 않는다. 배포 후 Google Search Console, Naver Search Advisor, Bing Webmaster Tools에서 색인 상태와 검색어를 추적해야 한다.
- GEO/AEO는 단일 지표가 없다. 초기에는 타깃 질문 30~50개를 정하고 ChatGPT, Gemini, Perplexity, Naver AI 검색에서 인용 여부와 표현을 월 1회 기록한다.

## Source-Based Principles

### 1. Helpful content first

Google은 사람에게 도움이 되는 신뢰 가능한 콘텐츠를 우선한다고 설명한다. 따라서 이 사이트는 "로켓그로스 비용을 계산하는 사람"이 실제로 이해해야 하는 계산 기준을 중심으로 작성해야 한다.

적용 방향:

- 실제 계산 항목과 비용 기준을 명확히 설명한다.
- 단순 키워드 나열보다 "왜 이 비용이 들어가는지"를 설명한다.
- 관세, 수입 부가세, LCL, 파레트 비용처럼 헷갈리는 항목은 별도 문서로 분리한다.

참고: https://developers.google.com/search/docs/fundamentals/creating-helpful-content

### 2. Structured data is support, not the content itself

Google은 구조화 데이터를 페이지 의미를 명확히 하는 단서로 설명하지만, 사용자에게 보이지 않는 내용을 구조화 데이터에만 넣는 방식은 피해야 한다.

적용 방향:

- FAQPage JSON-LD는 화면에 실제로 보이는 FAQ와 일치시킨다.
- WebApplication JSON-LD는 계산기 기능을 설명한다.
- 각 가이드 페이지는 Article 또는 WebPage 구조화 데이터를 가진다.

참고: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data

### 3. Sitemap and robots must be explicit

Google과 Naver 모두 sitemap과 robots.txt를 통해 수집 가능한 URL을 알리는 것을 권장한다.

적용 방향:

- `/sitemap.xml`에 홈과 모든 가이드 URL을 넣는다.
- `/robots.txt`에 sitemap 위치를 명시한다.
- `/api/`, `/auth/`는 크롤링 대상에서 제외한다.

참고:

- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://searchadvisor.naver.com/guide/seo-basic-robots

### 4. OpenAI search crawler access

OpenAI는 `OAI-SearchBot`이 ChatGPT 검색 기능에서 웹사이트를 표시하기 위한 크롤러라고 설명한다. `GPTBot`은 모델 학습 용도로 별도 관리될 수 있다.

적용 방향:

- 공개 계산기와 가이드 문서는 수집 허용한다.
- 로그인, 저장 API, 인증 경로는 제외한다.
- 운영 정책상 학습 크롤링을 원하지 않으면 `GPTBot`만 별도로 차단할 수 있다. 현재 목적이 GEO 노출 강화라면 우선 허용한다.

참고: https://platform.openai.com/docs/bots

### 5. Naver and Korean query reality

네이버 노출은 구조화 데이터만으로 해결되지 않는다. 네이버는 기본적으로 title, description, robots, 수집 가능성, 본문 품질, 사용자에게 유용한 콘텐츠를 본다.

적용 방향:

- 한국어 키워드를 페이지 제목과 본문에 자연스럽게 포함한다.
- 네이버 서치어드바이저 등록과 sitemap 제출이 필요하다.
- 장기적으로 네이버 블로그 또는 외부 리뷰/콘텐츠가 보완되어야 한다.

참고: https://searchadvisor.naver.com/guide/seo-help

## Target Query Clusters

### Primary

- 로켓그로스 계산기
- 로켓그로스 마진 계산기
- 쿠팡 로켓그로스 비용
- 쿠팡 로켓그로스 마진율

### Import and Logistics

- 중국사입 계산기
- 중국에서 한국 LCL 물류비
- LCL 해상운임 계산
- 터미널 운송료 계산
- 쿠팡 인천센터 입고 운송비

### Tax and Customs

- 수입 부가세 10%
- 원산지증명서 관세 0%
- 중국 수입 관세 계산
- 통관수수료

### Coupang Cost

- 쿠팡 판매 수수료
- 쿠팡 파레트 비용
- 로켓그로스 입고 비용
- 쿠팡 파레트 없이 입고

## Content Architecture

### Home

역할: 계산기 첫 진입과 브랜드 대표 URL.

필수 요소:

- 계산기 UI 우선 배치
- 하단에는 지식 허브로 이동하는 얇은 내부 링크만 배치
- 긴 FAQ와 계산 기준 설명은 별도 가이드 URL로 분리
- WebApplication, Organization, WebSite JSON-LD

### Guide: Rocket Growth Calculator

역할: "로켓그로스 계산기"와 "로켓그로스 마진 계산기" 검색 의도 대응.

내용:

- 이 계산기가 어떤 비용을 단계별로 계산하는지
- 판매 전 비용 흐름
- 최종 비용, 마진율, 최소 ROAS의 의미
- 계산기 바로가기

### Guide: LCL Logistics Cost

역할: "LCL 물류비 계산", "중국에서 한국 물류비" 검색 의도 대응.

내용:

- CBM, 청구 부피, 해상운임
- 최저가 기준 예상치라는 한계
- 터미널 운송료가 총 물류비에 포함되는 이유
- 실제 청구 운임과 차이가 날 수 있는 이유

### Guide: Import VAT and Customs

역할: "수입 부가세 10%", "원산지증명서 관세" 검색 의도 대응.

내용:

- 세금계산 기준금액의 의미
- 관세와 수입 부가세의 차이
- 원산지증명서 선택 시 관세율 0% 처리
- 통관수수료와 수입 VAT의 차이

### Guide: Coupang Pallet Cost

역할: "쿠팡 파레트 비용", "파레트 없이 입고" 검색 의도 대응.

내용:

- 파레트 없이 발송할 수 있는 경우
- 쿠팡 파레트&랩핑 비용 기준
- 파레트 수량 입력이 비용에 미치는 영향

### Guide: Coupang Fee

역할: "쿠팡 판매 수수료", "쿠팡 수수료 계산" 검색 의도 대응.

내용:

- 쿠팡 판매 수수료가 판매가 기준으로 계산되는 구조
- 카테고리별 수수료율 입력의 의미
- 로켓그로스 사용료가 현재 계산기에 별도 항목으로 없는 이유

## Owned, Earned, Measurement Roadmap

### Phase 1: Site foundation

- 주제별 가이드 URL 추가
- sitemap.xml, llms.txt, robots.txt 업데이트
- 각 가이드의 title, description, canonical, JSON-LD 적용
- 홈 하단에 지식 허브 링크 추가

### Phase 2: Owned media expansion

- 블로그 또는 지식 허브에 10~20개 실무형 글 작성
- 글의 기준은 "검색량"보다 실제 셀러 질문 해결력
- 예: "수입 부가세 10%는 환급되나요?", "LCL CBM은 어떻게 계산하나요?", "쿠팡 파레트 없이 입고할 수 있나요?"

### Phase 3: Earned media and reviews

- 실제 사용 사례, 계산 예시, 셀러 피드백을 외부 채널에 축적
- 쿠팡 셀러 커뮤니티, 블로그, 영상 설명란, 리뷰성 콘텐츠에서 공식 사이트로 연결
- 단순 홍보보다 계산 기준 검증과 사용 사례 중심으로 운영

### Phase 4: GEO/AEO monitoring

- 타깃 질문 30~50개를 만든다.
- 월 1회 ChatGPT, Gemini, Perplexity, Naver AI 검색에서 답변 포함 여부를 기록한다.
- 지표: 인용 여부, 브랜드명 언급, 링크 노출, 답변 정확도, 경쟁 사이트 대비 위치.

## Applied Changes

- `/guides/rocket-growth-calculator`
- `/guides/lcl-logistics-cost`
- `/guides/import-vat-customs`
- `/guides/coupang-pallet-cost`
- `/guides/coupang-fee`
- 홈 하단의 소형 지식 허브 링크
- sitemap.xml 가이드 URL 포함
- llms.txt 가이드 요약 포함
- robots.txt에 AI 검색 크롤러 허용 및 API/인증 경로 제외 명시

## Limitations

- 로컬 사이트만으로는 실제 노출이 발생하지 않는다. 운영 도메인 배포, Search Console, Naver Search Advisor, Bing Webmaster Tools 등록이 필요하다.
- GEO/AEO는 보장형 작업이 아니다. AI 답변 노출은 크롤링 가능성, 출처 신뢰도, 외부 언급, 콘텐츠 품질, 시점, 질문 문맥에 따라 변한다.
- 계산 기준은 실제 물류사, 관세사, 쿠팡 정책 변경에 따라 달라질 수 있으므로 운영 단계에서는 기준일과 출처 업데이트 관리가 필요하다.
