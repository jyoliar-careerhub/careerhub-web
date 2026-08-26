# careerhub-web

careerhub의 새 프론트엔드. 근거 결정은 ops-workflow의 ADR이 담는다:

- **ADR-0012** — 스택은 Next.js(React)
- **ADR-0013** — TypeScript로 짓는다(strict — 타입 검사가 사라진 리뷰어의 대체재다)
- **ADR-0015** — 스타일 토큰을 Tailwind로 강제한다(정의에 그치지 않는다)

## 스택

- Next.js 16.2 (App Router) · React 19 · TypeScript 5 (strict)
- Tailwind CSS 4 — 디자인 토큰은 `src/app/globals.css`의 `@theme`이 유일한 원천
- Node 24 (Active LTS)

## 검사 — 로컬 한 커맨드

```bash
npm run check   # typecheck(tsc --noEmit) + lint(eslint, warning도 실패)
```

이 커맨드가 CI 머지 게이트의 필수 체크가 된다(ops-workflow#10).

## REST 계약 타입 — 백엔드 스펙에서 생성한다 (ADR-0014 · ADR-0020)

REST 계약 타입을 손으로 선언하지 않는다. 손으로 쓴 선언은 백엔드 계약이 바뀌는 순간
**거짓말하는 타입**이 되고, 컴파일러가 그 거짓말을 보증한다.

결합 대상은 api-composer의 가변 브랜치나 실행 중인 서버가 아니라 **공표 좌표**(불변 태그)다.
어느 좌표에 올라탈지는 이 저장소의 핀이 정한다.

핀은 provider마다 하나다 — api-composer(데이터 경로)와 auth-service(인가 원장 — 온보딩
게이트의 동의 수집, ops-workflow#54):

```
contracts/api-composer.pin          # 핀 — 이 커밋이 어느 계약으로 빌드됐나 (repo · tag)
contracts/auth-service.pin          # 핀 — auth-service 인가 원장 계약 (spec/authz-ledger/vX.Y.Z)
scripts/gen-api-types.sh            # 핀 읽기 → 좌표 조립 → 스펙 fetch → 생성. 로컬과 CI가 같은 이것을 부른다
src/lib/api/schema.d.ts             # 생성물 — 커밋한다. 손으로 고치지 않는다
src/lib/api/auth-ledger-schema.d.ts # 생성물 — auth-service 계약
src/lib/api/client.ts               # 손으로 쓰는 부분: baseUrl 둘 · Bearer 토큰 부착 미들웨어 (서버 전용)
src/lib/api/job-postings.ts         # 호출 — 계약 타입은 전부 생성물에서 온다
```

```bash
npm run gen:api        # api-composer 핀 좌표에서 타입 재생성 (약 1.5초)
npm run gen:api:auth   # auth-service 핀 좌표에서 타입 재생성
```

**핀을 올리는 것은 사람이다.** 새 좌표가 났을 때 자동으로 따라 올라가는 폴링·봇은 두지 않는다.
`contracts/api-composer.pin`의 `tag`를 바꾸고 `npm run gen:api` 후 **핀과 생성물을 같은 커밋에** 담는다.

구조로 지키는 것들:

- **스펙 원본은 커밋하지 않는다.** 사본을 두면 검사가 사본끼리의 정합만 보게 된다(ADR-0020).
- **생성물은 커밋한다.** 빌드마다 생성하면 모든 CI 잡·프리뷰 배포·로컬 설치가 cross-repo
  자격증명을 요구하게 되고, 생성기가 의존성 그래프에 들어온다.
- **생성기는 `package.json`에 없다.** 버전을 고정해 `npx`로 격리 실행한다 — 앱의 typescript
  버전과 충돌하지 않고, 생성기 업그레이드가 산출물을 재포맷해 게이트를 터뜨리지도 않는다.
- **PR 게이트는 둘 다 돈다** — 재생성 diff(`spec-drift` job)와 typecheck(`check` job).
  diff만으로는 "타입은 최신인데 앱이 안 맞음"을, typecheck만으로는 "타입이 낡음"을 못 잡는다.
- **읽기 자격증명은 최소다.** 로컬은 개발자 자신의 `gh` 자격증명, CI는 Actions secret
  `SPEC_READ_TOKEN`(두 provider — api-composer·auth-service — 에 대한 `Contents: read`).
  Actions가 주입하는 `GITHUB_TOKEN`은 자기 저장소로 한정되어 이 일을 못 한다.

## 브라우저의 상대는 web 호스트 하나다 (ops-workflow#76)

**api-composer는 내부 전용이다.** 종착 공개면은 careerhub-web과 Zitadel 둘뿐이라 composer에는
공개 호스트가 없다 — 토큰이 브라우저에 없고, CORS가 소멸하며, 공개면이 최소가 되는 것이 근거다.
그래서 composer를 부르는 것은 **언제나 Next 서버**이고, 브라우저가 보내는 요청은 전부 web 호스트로 간다.

구조로 지키는 것:

- **composer 주소는 `API_BASE_URL`이다 — `NEXT_PUBLIC_` 접두가 없다.** 그 접두가 값이 클라이언트
  번들에 실리는 유일한 길이므로, 떼는 것 자체가 "브라우저는 composer 주소를 모른다"의 보증이다.
  `src/lib/api/*`(생성 타입 제외)를 브라우저 코드가 **값으로** 부르면 그 보증이 깨진다.
- **브라우저가 필요한 것은 route handler를 거친다.** 지금 그런 것은 조건 어휘 둘이다:

  ```
  src/app/api/conditions/skills/route.ts      GET  → /skills     (계약 선언대로 max-age=86400)
  src/app/api/conditions/companies/route.ts   GET  → /companies  (계약 선언대로 max-age=43200)
  src/app/api/conditions/serve.ts             두 축이 공유하는 배선 — 캐시 헤더·오류 상태
  src/lib/api/conditions-browser.ts           브라우저 쪽 호출. 화면은 이것만 부른다
  ```

  내주는 모양은 composer 응답 원문이 아니라 `src/lib/api/conditions.ts`가 이미 다듬어 놓은
  것이다(옵셔널 제거·정렬·검색어 손질) — 통째로 흘려보내는 프록시가 아니라서 경로도 계약의
  경로와 일부러 다르다. 계약이 선언한 캐시 수명은 그대로 실어 보낸다 — 기술스택 전체 목록을
  브라우저 캐시가 한 번만 받는 성질(아래 목록 화면)이 경유해도 살아 있어야 한다.
- **서버 컴포넌트의 직접 호출은 이 경유의 대상이 아니다.** 목록·상세·스크랩은 서버가 서버에게
  묻는 것이라 이미 내부 통신이다.

캐시는 **두 층이고 몫이 다르다**:

| 층 | 수명 | 몫 |
|---|---|---|
| 브라우저 HTTP 캐시 | 하루 (계약 선언) | 이 값의 수명을 책임진다 |
| Next 서버 (`/skills`만) | 5분 | 동시 미스를 흡수한다 |

서버 쪽을 짧게 잡은 이유는 트레이드오프가 대칭이 아니기 때문이다. 어휘의 원천
(`posting-skillscanner`)은 **하루 한 번**만 돈다 — 서버 TTL이 정하는 것은 그 스캔 직후의
**오염 창**의 너비다. 그 창 안에 처음 온 사람은 어제 어휘를 받고 자기 브라우저에 하루를
붙든다. 길게 잡아서 줄어드는 쪽은 DB 질의 몇 백 번이고, 넓어지는 쪽은 하루짜리 틀린 어휘다.
`/companies`에는 걸지 않는다 — 검색어마다 키가 달라 롱테일로 벌어지고 히트율이 낮다.

**이 캐시 성질은 e2e가 지킨다** — `e2e/scenarios/condition-vocabulary-cache.spec.ts`.
캐시는 드러나지 않는 것이 목적이라 화면에게 물어서는 볼 수 없어서, 이 명세만 화면 뒤의
트래픽을 본다(드라이버의 `skillVocabularyTraffic` 하나로 격리). 헤더가 빠지거나 호출에
`no-store`가 붙는 회귀는 **타입도 린트도 다른 명세도 못 잡는다** — 화면이 똑같아 보인다.

## 스타일 규율 — 구조로 강제

토큰(`@theme`)을 Tailwind 유틸리티로만 소비한다. 다음 이탈은 린트가 거부한다:

| 이탈 | 거부 규칙 |
|---|---|
| `<style>` 블록 | `react/forbid-elements` |
| 인라인 `style` prop | `react/forbid-dom-props` · `react/forbid-component-props` |
| 임의 값 (`bg-[#123]`, `p-[13px]`) | `tailwindcss/no-arbitrary-value` |
| 토큰 밖 커스텀 클래스 | `tailwindcss/no-custom-classname` |
| 별도 CSS 반입 (CSS Modules 포함) | `no-restricted-imports` (globals.css만 허용) |
| `src/` 안 JS 파일 | `no-restricted-syntax` (TypeScript만 — ADR-0013) |

색·간격이 더 필요하면 마크업에 값을 적지 말고 `globals.css`의 `@theme`에 토큰을 추가한다.
정말 예외가 필요하면 `eslint-disable` 주석으로 명시해 리뷰에 드러낸다.

클래스가 `cn()`·`cva()` 안으로 숨어도 검사를 벗어나지 않는다 — 플러그인의 `functions`
설정에 그 이름들을 명시해 뒀다(v3의 `callees`가 v4에서 바뀐 축이다).

## UI 컴포넌트 — shadcn/ui (ops-workflow#69)

기성 컴포넌트는 **shadcn/ui**에서 가져온다. 동작(a11y·포커스)은 **Base UI**(`@base-ui/react`)가 맡는다.

```bash
npx shadcn@4.18.0 add <component>   # src/components/ui/ 로 복사된다
```

```
components.json          # CLI 설정 — style: base-nova · Tailwind v4(config 파일 없음)
src/components/ui/       # 복사되어 들어온 컴포넌트. 우리 코드다 — 손으로 고쳐도 된다
src/lib/utils.ts         # cn() — clsx + tailwind-merge
```

**copy-in 모델이라 들어온 코드는 이 저장소의 것이다.** 그래서 위 스타일 규율이 그대로 적용된다 —
shadcn 원본이 쓰는 임의 값은 린트가 거부하므로, **가져온 뒤 토큰으로 옮기고** 그 토큰을
`globals.css`에 추가한다. 규칙을 푸는 방향은 ADR-0015를 무력화하므로 택하지 않는다.

`globals.css`의 색 구조는 두 층이다:

- `:root` — 시맨틱 토큰(`--primary`·`--muted`·`--destructive` …)의 **값**. 색의 원천은 여기 하나다.
- `@theme inline` — 그 토큰을 `bg-primary` 같은 **유틸리티로 노출**. 값이 아니라 참조만 산다.

다크는 클래스(`.dark`)가 아니라 `prefers-color-scheme`을 따른다 — 앱에 테마 토글이 없다.
shadcn 컴포넌트의 `dark:` 유틸리티도 `@custom-variant`로 이 한 기전에 물려 있다.

런타임 의존은 `@base-ui/react` + `clsx`·`tailwind-merge`·`class-variance-authority`,
그리고 아이콘(`lucide-react`)까지다. 컴포넌트를 더 들일 때 그 밖의 의존이 붙으면 멈추고 확인한다.

## 화면 — 채용공고 목록 (ops-workflow#70)

`/job_posting` — 검색·필터·페이지네이션이 한 화면이다.

**상태의 원천은 주소 하나다.** 걸어 둔 조건도 보고 있는 페이지도 질의문자열에만 살고,
서버 컴포넌트가 그것을 읽어 그린다. 그래서 다시 열어도 조건이 그대로고(공유·북마크·새로고침),
컴포넌트 최상위에서 `window`를 만질 일이 없으며(SSR-safe 규율), 렌더링 전략을 여기서 정하지
않아도 된다 — 상태가 클라이언트에 고이지 않으므로 라우트별 전환의 문이 열린 채 남는다.

```
/job_posting?category=…&skill=…&company=<site>:<이름>&minCareer=…&maxCareer=…&page=…
```

계약의 `encoded_query`(base64 JSON)는 **호출 직전에** 붙인다. 공유되는 것은 위의 읽히는 주소다.

```
src/app/job_posting/page.tsx           주소를 읽어 그린다 (서버 컴포넌트)
src/lib/job-posting/list-search.ts     주소 ↔ 화면 상태 ↔ 계약 질의의 변환이 전부 여기
src/lib/api/conditions.ts              좁히는 축의 어휘 — 직군·기술스택·회사
src/components/job-posting/            이 화면의 조각들
```

카드가 말하는 것: 제목·회사·직군·기술스택·경력·지역에 더해 **회사 평판(별점·리뷰 수)** 과
**출처 사이트**. 앞은 지원할지를 가르는 값이고, 뒤는 같은 자리가 사이트마다 다른 이름·다른
직군으로 올라오기 때문에 필요하다 — 지우면 걸어 둔 직군 조건과 화면이 어긋나 보인다.

규율이 아니라 구조로 지키는 것들:

- **넣는 것과 거는 것이 갈라져 있다.** 검색어는 컴포넌트 안에만 살고, 조건이 되는 것은
  제시된 후보를 고르는 순간이다 — 그때 하는 일이 주소를 새로 만드는 것이라, 주소를 거치지
  않고 결과가 움직일 길이 없다.
- **조건을 켜고 끄는 것은 버튼, 진짜 이동은 앵커.** 직군 토글·후보 고르기·조건 해제는
  사용자에게 이동이 아니라 동작이라 `<button>`이고(보조기술도 그렇게 읽는다), 페이지 넘김만
  `<a href>`다. 덕분에 걸린 조건이 직군 링크 예순여덟 개에 복제되지 않는다 — 서버가 실어
  보내는 것은 `search` 한 벌이고, 주소는 누른 순간 브라우저가 조립한다. 조립에 쓰는 함수는
  서버가 쓰는 것과 같다(`list-search.ts`) — "조건이 바뀌면 첫 페이지부터" 같은 규칙이
  `URLSearchParams`를 손으로 주무르는 코드로 복제되면 그 순간 원천이 둘이 된다.
- **조건이 바뀌면 첫 페이지부터 본다.** 조건을 바꾸는 모든 길이 `list-search.ts`의 한 함수를
  지나므로, 3페이지를 보다 좁혀서 빈 화면을 보는 일이 생기지 않는다.
- **걸린 조건은 그것을 건 축 아래에 선다.** 한 곳에 모으면 "무엇으로 좁혀져 있나"는 읽히지만
  "이 축에 무엇이 걸렸나"가 안 읽힌다 — 조건을 더 걸거나 푸는 일이 언제나 축 단위로 일어나므로.
  모양은 축을 가리지 않고 하나다(칩 + 해제).
- **다 그려졌는지를 화면이 말한다.** 결과 영역이 `aria-busy`를 내고, 조건이 갈리면 그 영역만
  `<Suspense>`로 다시 선다. e2e 배선이 "두 번 재서 같으면 멈춘 것"으로 추정하지 않는 이유다.

원천의 사정 둘을 화면이 흡수한다 — 둘 다 실측으로 확인한 것이다:

- **직군은 사이트별로 제시한다.** 직군의 어휘가 사이트마다 다르고(같은 이름이 양쪽에 있기도,
  한쪽에만 있기도 하다) 그 차이가 결과를 가른다. 합쳐서 한 줄로 늘어놓으면 고르는 사람이
  그것을 볼 수 없으므로 계약과 같은 단위로 묶고, 관심 없는 사이트는 접을 수 있게 둔다
  (`<details>` — JS 없이 동작한다). 순서는 이름순으로 고정한다 — 계약이 주는 순서가
  호출마다 다르다.
- **회사 검색어는 첫 토막만 보낸다.** 원천은 이름을 괄호에서 끊어 색인해서
  `원프레딕트(onepredict)` 전체로는 하나도 안 찾히고, 짝이 안 맞는 괄호는 500을 낸다.
  사용자가 넣는 검색어는 화면에서 본 이름이므로 `src/lib/api/conditions.ts`에서 다듬는다.

## 화면 — 채용공고 상세 (ops-workflow#71)

`/job_posting/:site/:postingId` — 포지션 정보와 회사 리뷰가 한 화면이다.

목록과 **같은 규율**이다: 상태의 원천은 주소 하나다. 어느 공고인지는 경로가, 리뷰의 몇 페이지를
보고 있는지는 질의문자열이 말한다 — 리뷰 7페이지에서 주소를 건네면 받는 쪽도 7페이지를 본다.

```
/job_posting/<site>/<postingId>?reviewPage=…
```

```
src/app/job_posting/[site]/[postingId]/page.tsx   주소를 읽어 그린다 (서버 컴포넌트)
src/lib/job-posting/detail-view.ts                상세 주소를 만드는 곳은 여기 하나다
src/lib/api/reviews.ts                            회사 리뷰 호출
src/components/job-posting/detail/                이 화면의 조각들
```

**목록 Task가 만든 것을 다시 쓴다** — 같은 요소가 두 화면에서 다르게 생기지 않도록 이 Task에서
꺼냈다. 별점(`src/components/rating.tsx`)은 카드·리뷰 요약·리뷰 한 건이 같은 것을 쓰고,
페이지네이션(`src/components/page-navigation.tsx`)은 "각 페이지의 주소를 무엇으로 만드는가"만
받으므로 목록의 조건 한 벌과 상세의 리뷰 페이지가 같은 부품을 지난다. 태그는 이미 `ui/badge`다.

- **리뷰 1페이지는 호출하지 않는다.** 상세 응답의 `firstPageReviews`가 리뷰 0페이지와
  문자 그대로 같다(실측). 들어오자마자 같은 것을 한 번 더 청할 이유가 없어 2페이지부터만 부른다.
- **리뷰는 공고가 아니라 회사에 달린다.** 그래서 좌표가 공고 식별자가 아니라 회사 이름인데,
  그 이름의 원천은 화면에 보이는 회사명이 아니라 `reviewInfo.defaultName`이다
  (`원프레딕트(onepredict)`와 `원프레딕트`처럼 갈린다).
- **몇 페이지인지는 수집이 끝났을 때만 센다.** `isCompleteCrawl`이 아니면 요약이 말하는 리뷰
  수보다 실제로 가진 것이 적을 수 있어, 넘길 수 있다고 말해 놓고 빈 페이지를 주게 된다.
- **리뷰가 없어도 경계는 선다.** 영역째 사라지면 "리뷰가 없다"와 "아직 안 그려졌다"가 화면에서
  구분되지 않는다 — 보조기술도, e2e 배선도 그 둘을 가릴 수 없다.
- **비어 있는 절은 그리지 않는다.** 원천이 채우지 않은 칸을 제목만 남겨 두면 "이 회사는
  우대사항이 없다"로 읽히는데, 실제로는 수집되지 않은 것이다.
- **한눈 요약은 옆단에 산다.** 긴 글을 읽는 도중에도 답이 필요한 것들(회사·경력·근무지역·
  지원 경로)이라 넓은 화면에서는 스크롤을 따라 붙어 오고, 좁은 화면에서는 본문보다 먼저 놓인다.

로그인 상태에 딸린 요소(스크랩·태그)는 이 화면의 범위 밖이다 — 인증 화면 재작성에서 다룬다.

## 인증 — 토큰은 브라우저에 닿지 않는다 (ADR-0028 · ops-workflow#8·#59)

인증은 외부 IdP(Zitadel)가 소유하고, 인가 원장(권한·동의)은 auth-service에 남는다.
로그인은 **Authorization Code + PKCE 표준 리다이렉트**다 — 레거시의 팝업·`postMessage`가 아니다.

**토큰 접근은 `src/lib/auth` 하나에 갇혀 있다.** 읽기·쓰기·갱신·첨부, 그리고 OIDC 왕복까지
전부 그 안이고, 밖에서는 `@/lib/auth`만 import한다. 저장 매체를 고르는 지점도 그 안의
`store/index.ts` 한 줄이라, 축 D(토큰 저장)를 다시 고르는 일이 모듈 밖으로 새지 않는다.

```
src/lib/auth/index.ts             공개면 — 밖에서 import하는 유일한 파일
src/lib/auth/login.ts             로그인·로그아웃 흐름 (라우트가 부르는 표면)
src/lib/auth/oidc.ts              authorize URL·code 교환·logout URL · PKCE/state/nonce
src/lib/auth/login-transaction.ts 진행 중인 왕복(state·nonce·verifier)의 봉인 쿠키
src/lib/auth/session.ts           세션의 읽기·쓰기·갱신
src/lib/auth/store/index.ts       ★ 저장 매체를 고르는 유일한 지점 (지금은 D1)
src/app/auth/{start,callback,logout}/route.ts   HTTP만 아는 얇은 라우트
```

토큰은 **Next 서버가 굽는 암호화 HttpOnly 쿠키**에 산다(축 D 판정 = D1). 브라우저 JS는
토큰 문자열에 도달할 수 없고, 그래서 인증이 얽힌 API 호출은 서버 컴포넌트·라우트를 경유한다.
api-composer는 여전히 `Authorization` 헤더만 본다 — 소비 계약은 바뀌지 않았다.

쿠키 자동 첨부로 옮긴 대가가 CSRF 표면이라, 세션 쿠키의 `SameSite=Lax`와 상태 변경 요청
(로그아웃·동의 제출 POST)의 오리진 검사가 짝으로 선다.

필요한 env는 `.env.example`에 있다. 로컬은 `.env.local`로 복사해 채운다.

## 온보딩 — 약관동의는 클레임 기반 앱 게이트다 (ops-workflow#54)

미동의 사용자도 토큰은 받는다(ADR-0028) — 게이트는 발급 거부가 아니라 앱의 유도다.

- **판정의 입력은 클레임뿐이다.** 보호 화면(`/my`)이 `careerhub:agreements_fulfilled`를
  읽어 미충족이면 `/onboarding`으로 보낸다. 동의 상태를 확인하러 어디에도 묻지 않는다
  (사람 판정 260818 — 조회 왕복 폐기).
- **수집은 원장 소유자의 표면으로.** 온보딩 화면이 auth-service의 `/auth/agreement`를
  Next 서버에서 부른다(조회·제출) — 계약은 `contracts/auth-service.pin`의 공표 좌표다.
- **제출 직후 세션을 갱신한다**(`/onboarding/submit`). 클레임은 발급 시점 스냅샷이라
  (ADR-0031) 갱신 없이는 게이트가 계속 미충족을 본다 — 이 갱신 트리거가 흐름의 일부다.
- **이 유도는 UX 게이트다.** 집행은 검증자(api-composer·auth-service)의 401/403이 진다 —
  프론트가 뚫려도 보호 API가 막는다.

## 개발

```bash
npm run dev     # 개발 서버
npm run build   # 프로덕션 빌드
```

## e2e 명세 — 재작성의 완료 조건 (ops-workflow#9)

기존 앱이 도는 동안 공개 4개 라우트(`/` · `/job_posting` · `/job_posting/:site/:postingId` · `/login`)의
사용자 여정을 먼저 명세했다. **이 명세가 새 화면의 완료 조건이다** — 화면 Task는 자기 화면의
배선을 `e2e/wiring/next/`에 채워 해당 시나리오를 통과시키면 된다.

```
e2e/scenarios/      # 앱도 호스트도 모른다. 라우트·여정·불변식만 — 대상 앱이 바뀌어도 안 바뀐다
e2e/support/        # driver 인터페이스(시나리오가 쓰는 유일한 언어)·픽스처·라우트 게이트
e2e/wiring/legacy/  # 기존 앱용 배선. 기존 앱이 은퇴하면 통째로 지운다
e2e/wiring/next/    # 새 앱용 배선 — 지어진 화면만큼 채워진다(지금: 로그인 진입·공고 목록·공고 상세)
```

```bash
npm run e2e:legacy                               # 기존 앱(prod)에 대고 돌린다
LEGACY_BASE_URL=… npm run e2e:legacy             # 다른 환경을 겨눈다
NEXT_BASE_URL=http://localhost:3000 npm run e2e  # 새 앱 배선이 채워진 뒤
```

규율이 아니라 구조로 지키는 것들:

- **시나리오는 배선을 통해서만 앱을 만진다.** 선택자·URL·탭 동작은 배선이 흡수한다 —
  기존 앱의 해시 라우팅도, 공고를 새 탭에서 여는 것도 시나리오에는 보이지 않는다.
- **명세는 앱 바깥에 묻지 않는다.** 무엇으로 검색할지도, 어느 공고에 리뷰가 달렸는지도,
  결과가 몇 페이지인지도 **화면이 알려준다.** 백엔드 API를 따로 부르지 않는다.
- **어서션은 불변식만.** 건수·공고 제목·카테고리명 같은 구체값을 시나리오에 박지 않는다
  (실데이터가 하루 한 번 갈린다).
- **데이터 전제는 `test.skip`으로 명시한다.** 전제가 안 갖춰지면 **건너뛴 것으로 보고**되므로
  앱 회귀(빨간 실패)와 같은 신호가 되지 않는다.
- **라우트 게이트**가 화면이 아닌 곳에서 부른 메서드를 즉시 거부한다.
- **조건을 거는 일은 두 단계다** — 검색어를 넣어 후보를 보고(`type`·`candidates`),
  골라서 건다(`choose`). 시나리오가 이 둘을 갈라 어서션하므로, 넣기만 한 것으로 결과가 바뀌는
  화면은 명세를 통과하지 못한다. 후보를 어떻게 그리는지(드롭다운·리스트)는 배선의 것이다.

**이 명세는 아직 PR 게이트(G1)가 아니다.** 결정적 데이터(시드·픽스처)가 없는 동안은 빨간불이
앱 회귀인지 데이터 변동인지 구분되지 않아 차단 게이트가 될 수 없다. G1은 계속 빠른 검사(타입·린트·계약 드리프트)만 둔다.
