# Step 3: folder-aliases

## 읽어야 할 파일

- `phases/bootstrap/step{0,1,2}.md` 와 산출물
- `docs/ARCHITECTURE.md` §디렉터리 구조 (lines 5–80)
- `CLAUDE.md` §네이밍·코드 스타일 (import 순서)

## 작업

`src/` 하위의 표준 디렉터리를 만들고, TypeScript / Babel / Metro 의 path alias `@/*` 를 일관되게 등록한다. import 순서 규칙은 Step 5 의 ESLint 셋업에서 강제하므로 본 step 에서는 alias 동작만 검증한다.

### 1. 디렉터리 생성 — `.gitkeep` placeholder 만 둠

ARCHITECTURE.md §디렉터리 구조 와 1:1 일치:

```
src/
├── components/.gitkeep
├── store/.gitkeep
├── lib/.gitkeep
├── types/.gitkeep
└── theme/                  # tokens.ts 는 Step 1 에서 이미 작성됨 — 손대지 않는다
```

추가로 다음 디렉터리 (Phase 3+ 에서 채워짐):

```
src/
├── __fixtures__/.gitkeep
├── __test-utils__/.gitkeep
├── i18n/.gitkeep            # ADR-034 — 한국어 strings/errors 향후 분리
└── ...
```

자산·데이터 디렉터리:

```
data/
├── seed/.gitkeep            # 번들 시드 (Phase 3 에서 seoul.json, vancouver.json 추가)
└── cities/.gitkeep          # 런타임 fetch 도시 JSON (Phase 3+)
assets/
├── fonts/.gitkeep           # Step 5 에서 폰트 추가
└── (icon.png, splash.png 는 Step 0 에서 이미 placeholder)
```

> `data/sources.md`, `data/seed/*.json` 등 실 데이터는 Phase 3 / 6 의 책임. 본 step 은 디렉터리 골격만.

### 2. `tsconfig.json` path alias

기존 `compilerOptions` 에 다음 추가:

```json
{
  "compilerOptions": {
    "...": "...",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

> `baseUrl` 과 `paths` 만 추가. 기존 strict 옵션은 그대로.

### 3. `babel.config.js` — `babel-plugin-module-resolver` 추가

NativeWind preset 과 충돌 없이 동작해야 한다. 기존 step 1 의 babel.config.js 를 다음과 같이 갱신:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
    ],
  };
};
```

`devDependencies` 에 `babel-plugin-module-resolver` (`^5.0.x`) 추가.

> Metro 는 Expo Router 와 함께 babel resolver alias 를 자동 인식한다. 별도 metro.config.js 수정 불필요.

### 4. Jest 도 동일 alias 인식 — 본 step 에서는 미리 준비만

Jest 의 `moduleNameMapper` 는 Step 4 의 `jest.config.js` 작성 시 함께 추가된다. 본 step 에서 jest.config.js 를 만들지 않는다.

### 5. Smoke import — alias 동작 검증

`app/_layout.tsx` 또는 다른 파일에서 한 줄 import 로 alias 검증:

```tsx
import { colors } from '@/theme/tokens';
// 사용하지 않으면 typecheck 에서 unused 경고가 날 수 있으므로
// console.log(colors) 또는 inline 주석 처리는 금지 (ADR-024 — console.log 사용 X).
// 대신 Step 5 의 ESLint 가 unused import 잡으면 그때 제거.
```

> 가장 안전한 검증은 `tsc --noEmit` + 새로운 dummy 파일을 잠깐 만들어보는 것. 본 step 에서는 `src/types/index.ts` 를 만들어 alias 를 사용하는 stub 으로 검증:

`src/types/index.ts`:

```ts
/**
 * 도메인 타입의 단일 진입점. Phase 3 에서 City, Persona 등 실제 타입 추가.
 * 본 step 은 alias 동작 검증을 위한 stub.
 */

export {} as const;
```

`src/lib/index.ts` (alias 검증용 stub):

```ts
/**
 * lib 모듈의 단일 진입점. Phase 3 에서 format/currency/data/compare/errors 추가.
 */
export {} as const;
```

`src/store/index.ts`:

```ts
/**
 * Zustand 스토어의 단일 진입점. Phase 3 에서 추가.
 */
export {} as const;
```

`src/components/index.ts`:

```ts
/**
 * 도메인 컴포넌트의 단일 진입점. Phase 4 에서 추가.
 */
export {} as const;
```

> `index.ts` 들이 모두 `export {} as const` 만 노출하는 것은 의도된 stub. Phase 3+ 에서 실제 export 로 교체.

> **주의**: `tsconfig.json` 의 `coverageFrom` (TESTING.md §2) 에 `'!**/index.ts'` 가 있어 위 stub 들은 커버리지에서 제외된다. 의도된 동작.

### 6. `.gitkeep` 파일 내용

빈 파일 또는 한 줄 주석 (선호):

```
# placeholder — Phase N 에서 파일 추가
```

(Phase 번호는 디렉터리별로 명시 — components → Phase 4, store/lib/types → Phase 3, fixtures → Phase 3, fonts → Step 5)

### 7. `index.json` summary

`"summary": "src/{components,store,lib,types,theme,__fixtures__,__test-utils__,i18n} 디렉터리 + path alias @/* (tsconfig + babel-plugin-module-resolver)"`

## Acceptance Criteria

```bash
npm install
npm run typecheck
```

- `babel-plugin-module-resolver` 설치 성공
- `tsc --noEmit` 통과
- `@/types`, `@/lib`, `@/store`, `@/components`, `@/theme/tokens` import 가 모두 resolve (각 stub `index.ts` 에서 검증 가능)

추가 sanity:

```bash
# alias 가 babel 단에서도 인식되는지 확인 — metro bundle (3초 후 ctrl+c)
npx expo start --no-dev --minify 2>&1 | head -50
```

bundle 에러가 없으면 OK.

## 검증 절차

1. AC 커맨드 실행.
2. 디렉터리 체크리스트:
   - `src/` 하위 8개 디렉터리 (`components`, `store`, `lib`, `types`, `theme`, `__fixtures__`, `__test-utils__`, `i18n`) 존재
   - `data/seed/`, `data/cities/`, `assets/fonts/` 존재
   - 각 디렉터리에 `.gitkeep` 또는 `index.ts` stub 존재 (빈 디렉터리는 git 이 추적 안 함)
   - `tsconfig.json` 에 `paths: { "@/*": ["src/*"] }` 존재
   - `babel.config.js` 에 `module-resolver` plugin 존재 (NativeWind preset 다음 위치)
3. `phases/bootstrap/index.json` 의 step 3 업데이트.

## 금지사항

- 디렉터리에 실제 코드 (City type, format 함수 등) 작성 금지. 이유: Phase 3+ 의 책임. 본 step 은 골격 + alias 만.
- `index.ts` stub 에 실제 export 추가 금지 (`export {} as const` 만). 이유: 동일.
- `tsconfig.json` 에 다른 alias (`@components/*`, `@lib/*`) 추가 금지. 이유: `@/*` 단일 alias 정책 (CLAUDE.md import 순서 §3 — `@/` alias). 다중 alias 는 import 순서 ESLint 규칙 복잡도 ↑.
- `metro.config.js` 에 alias 추가 시도 금지. 이유: babel-plugin-module-resolver 가 transform 단계에서 처리 → metro 가 추가 작업 불필요. 이중 처리 시 동작 충돌 가능.
- `package.json` 의 `imports` 필드 (`#/*` 식 Node subpath) 사용 금지. 이유: Expo / RN 환경에서 Node `imports` 는 metro/babel 설정과 어긋나기 쉬움.
- `data/seed/*.json` 또는 도시 JSON 추가 금지. 이유: Phase 3 의 책임 + ADR-005 / ADR-032 의 데이터 출처 정책.
- 폰트 파일 추가 금지. 이유: Step 5 의 책임.
- ESLint import 순서 규칙 추가 금지. 이유: Step 5 가 종합 셋업.
