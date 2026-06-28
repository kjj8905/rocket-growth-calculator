# 셀러딧 앱 배포 직전 체크리스트

## 현재 앱 패키징 상태

- 앱 방식: Capacitor WebView 앱
- 앱 ID: `site.wingcoupang.sellerdit`
- 앱 이름: `셀러딧`
- 운영 URL: `https://wingcoupang.site`
- Android 프로젝트: `android/`
- iOS 프로젝트: 아직 미생성. macOS/Xcode 환경에서 생성 필요

현재 Android 네이티브 프로젝트와 PWA 앱 셸은 생성되어 있습니다. 스토어 제출 전에는 아래 항목만 남습니다.

## 배포 전 필수 명령

```bash
npm run check
npm run pwa:smoke
npm run community:api-smoke
npm run app:sync
node scripts/capacitor-predeploy-check.mjs
npm run app:doctor
```

운영 URL 기준 확인:

```bash
PWA_SMOKE_BASE_URL=https://wingcoupang.site npm run pwa:smoke
DESIGN_BASE_URL=https://wingcoupang.site npm run design:smoke
COMMUNITY_SMOKE_BASE_URL=https://wingcoupang.site npm run community:api-smoke
```

## Android 배포 직전 남은 작업

현재 WSL에는 Java/Android SDK가 없어 release build는 이 PC 환경에서 바로 만들 수 없습니다. Android Studio가 설치된 PC에서 아래를 진행합니다.

1. JDK 17 이상 설치
2. Android Studio 설치
3. Android SDK Platform 36 설치
4. `npm install`
5. `npm run app:sync`
6. Android Studio에서 `android/` 열기
7. 패키지 정보 확인
   - applicationId: `site.wingcoupang.sellerdit`
   - versionCode: `1`
   - versionName: `1.0`
8. 실제 서명키 생성 또는 기존 키 연결
9. Release App Bundle 생성
   - Android Studio: Build > Generate Signed Bundle / APK > Android App Bundle
   - 또는 CLI 환경 구성 후 `cd android && ./gradlew bundleRelease`
10. Play Console에 업로드 전 내부 테스트 트랙에서 설치 검수

## iOS 배포 직전 남은 작업

macOS/Xcode 환경에서만 진행합니다.

```bash
npm install
npm install @capacitor/ios --save-dev
npx cap add ios
npm run app:sync
npx cap open ios
```

그 다음 Xcode에서 확인합니다.

- Bundle Identifier: `site.wingcoupang.sellerdit`
- Display Name: `셀러딧`
- Signing Team 설정
- App Icon / Launch Screen 최종 확인
- Archive 생성 후 TestFlight 업로드

## 스토어 심사 전 주의

- 현재 앱은 운영 웹을 로드하는 Capacitor WebView 방식입니다.
- Play Store/App Store 심사에서는 단순 웹뷰 앱으로 보이지 않도록 다음을 보강하는 편이 안전합니다.
  - 명확한 커뮤니티 기능 설명
  - 로그인/글쓰기/댓글/저장 등 앱 내 핵심 기능 검수 영상
  - 개인정보 처리방침 URL
  - 고객지원 연락처
  - 테스트 계정 또는 테스트 절차
- 푸시 알림은 아직 미구현입니다. 알림 기능을 스토어 설명에 넣으면 안 됩니다.
- Kakao 로그인은 앱 WebView/OAuth 리다이렉트 동작을 실제 기기에서 반드시 확인해야 합니다.

## 앱 QA 체크

- 앱 첫 실행 시 `https://wingcoupang.site/community` 접근 가능
- 뒤로가기 동작 확인
- 외부 링크 처리 확인
- 로그인 후 세션 유지 확인
- 글쓰기/댓글/좋아요/저장/팔로우 확인
- 공급처 페이지 이동 확인
- 네트워크 끊김 상태에서 fallback 화면 확인
- 360px~430px Android 기기 폭에서 가로 스크롤 없음 확인
