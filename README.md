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
e2e/wiring/next/    # 새 앱용 배선 — 골격만. 화면을 짓는 Task가 채운다
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

**이 명세는 아직 PR 게이트(G1)가 아니다.** 결정적 데이터(시드·픽스처)가 없는 동안은 빨간불이
앱 회귀인지 데이터 변동인지 구분되지 않아 차단 게이트가 될 수 없다. G1은 계속 빠른 검사(타입·린트)만 둔다.
