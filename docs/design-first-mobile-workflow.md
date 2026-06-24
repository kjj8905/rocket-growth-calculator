# Sellerdit 앱/모바일 디자인 우선 작업 모드

## 결정

현재 단계는 **기능 확장 일시 보류 + 앱/모바일 기준 디자인 안정화**로 진행한다.

- 메인 기준: 앱/모바일 화면
- 웹 PC: 운영 확인 및 보조 대응
- 기존 MVP 기능: 유지하되 새 기능 확장은 보류
- 디자인 수정 방식: 화면별 덧칠이 아니라 공통 컴포넌트 기준으로 정리

## 지금부터 작업 원칙

1. **새 기능 추가 금지**
   - 예외: 디자인 검수에 필요한 최소 상태/더미/버그 수정
   - 예외가 필요하면 작업 전에 이유를 남긴다.

2. **모바일 1순위**
   - 모든 UI 수정은 390px 전후 모바일 뷰에서 먼저 확인한다.
   - 그 다음 768px 태블릿, 1280px 데스크톱을 확인한다.

3. **기능 유지**
   - 글/댓글/대댓글/좋아요/저장/팔로우/검색/프로필/공급처 흐름은 깨지면 안 된다.
   - UI만 바꾸더라도 버튼 selector, form, API endpoint는 유지한다.

4. **공통 컴포넌트 기준으로 수정**
   - 같은 형태의 카드/행/탭/버튼을 화면마다 따로 고치지 않는다.
   - CSS 추가 시 기존 충돌 여부를 확인하고, 가능하면 공통 class로 묶는다.

5. **검수 후 커밋**
   - `npm run check`
   - `npm run design:smoke`
   - 브라우저에서 모바일/PC 최소 1회 확인
   - 필요한 경우 운영 반영 확인

## 디자인 수정 우선순위

### 1순위: 앱 핵심 화면

- 홈/커뮤니티 피드
- 글 상세
- 댓글/대댓글 영역
- 글쓰기 진입
- 검색
- 내 프로필
- 공급처
- 알림/저장 진입

### 2순위: 공통 UI

- App header
- Bottom navigation 후보
- Feed row/card
- Action bar
- Underline tab
- Profile header
- Supplier/community card
- Empty/loading/error state
- Login prompt

### 3순위: PC 웹 정리

- 좌/우 rail 정렬
- 데스크톱 여백/폭
- 운영 SEO/공유용 화면 유지

## 작업 전 체크리스트

디자인 수정 시작 전에 아래를 확인한다.

```bash
npm run check
npm run design:smoke
```

그리고 브라우저에서 최소 아래 URL을 확인한다.

```text
/community
/community?sort=new&cat=china-sourcing
/community/suppliers
/u/%EC%B4%88%EB%B3%B4%EC%85%80%EB%9F%AC%EB%AF%BC%EC%88%98
```

## 작업 후 체크리스트

- [ ] 모바일 390px에서 주요 화면이 깨지지 않는다.
- [ ] PC 1280px에서 좌/중/우 영역이 겹치지 않는다.
- [ ] 글/댓글/좋아요/저장/팔로우 버튼이 DOM에서 유지된다.
- [ ] 공급처 supplier 카드에 멤버/설명/팔로우가 노출되지 않는다.
- [ ] 프로필 중앙 영역은 박스 중첩 없이 유지된다.
- [ ] `npm run check` 통과
- [ ] `npm run design:smoke` 통과

## 나중에 진행할 구조 정리

디자인이 70~80% 확정되면 다음 순서로 분리한다.

```text
src/
  routes/
  views/
  services/
  db/
public/
  css/
  js/
```

그 전까지는 대규모 백엔드 구조 변경, Postgres 전환, 기능 확장은 보류한다.
