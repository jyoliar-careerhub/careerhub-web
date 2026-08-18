import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tailwind from "eslint-plugin-tailwindcss";

// 별도 CSS(CSS Modules 포함) 반입 차단 — 토큰 정의는 globals.css 한 곳뿐이다.
// 정말 예외가 필요하면 eslint-disable 주석으로 명시하고 리뷰에 드러낸다 (ADR-0015 "이탈은 명시적으로만").
const cssImportGuard = {
  group: ["**/*.css", "!**/globals.css"],
  message:
    "별도 CSS 반입 금지 — 토큰을 globals.css @theme에 추가하고 유틸리티로 소비한다 (ADR-0015)",
};

// ops-workflow#8 — 인증 토큰 접근은 `src/lib/auth` 안에서만 일어난다.
// 이 경계가 지켜지는 한 토큰 저장 매체(축 D)를 바꾸는 일은 그 모듈 안의 일이고,
// 밖의 코드는 한 줄도 바뀌지 않는다. 규율을 문서가 아니라 여기에 둔 이유다.
const authModuleGuard = {
  group: ["**/auth/*", "**/auth/*/**"],
  message:
    "인증 토큰 모듈의 내부를 직접 부르지 않는다 — 공개면은 `@/lib/auth` 하나다 (ops-workflow#8)",
};

// 토큰을 요청에 싣는 이음매는 하나뿐이고, 그것을 채우는 것은 인증 모듈뿐이다.
const tokenAttachGuard = {
  group: ["**/api/client", "./client"],
  importNames: ["setAccessTokenProvider"],
  message:
    "토큰 부착의 배선은 `src/lib/auth`만 한다 — 화면·호출 계층은 토큰을 만지지 않는다 (ops-workflow#8)",
};

// 토큰이 브라우저 저장소에 새는 길을 막는다. 저장 매체의 선택은 인증 모듈 안의 일이므로,
// 밖에서 이 API들을 부를 이유가 없다 (ops-workflow#8 · ADR-0012의 SSR-safe 규율과 같은 방향).
const browserStorageGuard = [
  {
    selector: "MemberExpression[object.name='document'][property.name='cookie']",
    message:
      "`document.cookie` 금지 — 토큰 저장은 `src/lib/auth` 안에서만 한다 (ops-workflow#8)",
  },
  {
    selector: "Identifier[name='localStorage']",
    message:
      "`localStorage` 금지 — 토큰 저장은 `src/lib/auth` 안에서만 한다 (ops-workflow#8)",
  },
  {
    selector: "Identifier[name='sessionStorage']",
    message:
      "`sessionStorage` 금지 — 토큰 저장은 `src/lib/auth` 안에서만 한다 (ops-workflow#8)",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      tailwindcss: tailwind,
    },
    settings: {
      tailwindcss: {
        // Tailwind v4 — 토큰의 원천은 CSS 엔트리포인트다
        cssConfigPath: "src/app/globals.css",
        // 클래스가 `cn()`·`cva()` 안으로 들어가도 검사를 벗어나지 않는다 (ops-workflow#69).
        // 플러그인 기본값에 이미 이 이름들이 있지만, 강제가 기본값에 얹혀 조용히
        // 흔들리지 않도록 여기 명시한다 — 구멍이 나면 ADR-0015가 무력해진다.
        // (v3의 `callees`가 v4에서 `functions`로 바뀐 축이다.)
        functions: [
          "cn",
          "cva",
          "clsx",
          "classnames",
          "classNames",
          "ctl",
          "tv",
          "tw",
          "twMerge",
          "twJoin",
        ],
      },
    },
    rules: {
      // ADR-0015 — 토큰을 우회하는 이탈은 린트에서 거부한다.
      // 예외가 정말 필요하면 여기서 규칙을 완화하지 말고 globals.css @theme에 토큰을 추가한다.
      "tailwindcss/no-arbitrary-value": "error",
      "tailwindcss/no-custom-classname": "error",
      "tailwindcss/no-contradicting-classname": "error",
      "no-restricted-imports": [
        "error",
        { patterns: [cssImportGuard, authModuleGuard, tokenAttachGuard] },
      ],
      "no-restricted-syntax": ["error", ...browserStorageGuard],
      "react/forbid-elements": [
        "error",
        {
          forbid: [
            {
              element: "style",
              message:
                "<style> 블록 금지 — globals.css @theme에 토큰을 추가하고 유틸리티로 소비한다 (ADR-0015)",
            },
          ],
        },
      ],
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message: "인라인 스타일 금지 — 토큰 유틸리티를 사용한다 (ADR-0015)",
            },
          ],
        },
      ],
      "react/forbid-component-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message: "인라인 스타일 금지 — 토큰 유틸리티를 사용한다 (ADR-0015)",
            },
          ],
        },
      ],
    },
  },
  {
    // ADR-0013 — 앱 코드는 TypeScript로만 짓는다. JS 파일은 타입 검사를 통째로 우회하므로 존재 자체를 거부한다.
    files: ["src/**/*.js", "src/**/*.jsx", "src/**/*.mjs", "src/**/*.cjs"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Program",
          message: "JS 파일 금지 — TypeScript(.ts/.tsx)로 작성한다 (ADR-0013)",
        },
      ],
    },
  },
  {
    // ops-workflow#8 — 경계의 안쪽. 여기가 토큰을 만져도 되는 유일한 곳이므로,
    // 밖을 향한 두 금지(부착 이음매·브라우저 저장소)를 이 디렉터리에서만 푼다.
    // CSS 금지는 그대로 둔다 — 그건 다른 규율(ADR-0015)이고 여기서 풀 이유가 없다.
    files: ["src/lib/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [cssImportGuard, authModuleGuard] },
      ],
      "no-restricted-syntax": "off",
    },
  },
  {
    // Playwright 픽스처의 두 번째 인자는 관례상 `use`다 — React Hook과 이름만 같다.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 계약 생성물 — 손으로 고치지 않으므로 린트가 고칠 것도 없다 (ADR-0014 · npm run gen:api).
    "src/lib/api/schema.d.ts",
  ]),
]);

export default eslintConfig;
