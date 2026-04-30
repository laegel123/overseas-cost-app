# Step 3: error-boundary

ARCHITECTURE.md §에러 핸들링 전략 의 3계층 중 **app 계층** 을 구현한다. RootLayout 의 자식 트리 throw 를 잡아 `<ErrorView fatal />` 를 표시하고 "다시 시작" CTA 제공.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL (silent fail 금지)
- `docs/ARCHITECTURE.md` §에러 핸들링 전략 (3계층), §247 (DEV 모드 LogBox 우선)
- `docs/UI_GUIDE.md` — ErrorView 사양 (있으면)
- `docs/design/README.md` — 디자인 토큰 (button / typography)
- `src/lib/errors.ts` — `AppError` 베이스 + 카탈로그
- `src/theme/tokens.ts` — colors, radius, spacing
- step 0~2 산출물: `app/_layout.tsx`

## 작업

### 1. `src/components/ErrorView.tsx` 신규 작성

```ts
type Variant = 'fatal' | 'inline' | 'screen';

export type ErrorViewProps = {
  variant: Variant;
  message: string;          // 한국어 사용자 노출 문구
  detail?: string;          // dev 빌드 한정 추가 정보 (AppError.code)
  onRetry?: () => void;     // 재시도 / 재시작 CTA
  retryLabel?: string;      // 기본값: '다시 시작' (fatal) / '다시 시도' (그 외)
};

export function ErrorView(props: ErrorViewProps): JSX.Element;
```

- `fatal`: 전체 화면, 중앙 정렬, 큰 타이포 + CTA. RootLayout 의 ErrorBoundary 가 사용.
- `inline`: 한 줄 경고 배지. ARCHITECTURE.md §242 의 "데이터 갱신 실패 · 다시 시도" 패턴.
- `screen`: 화면 단위 fallback (스키마 실패 등). 본 phase 에서는 내부 UI 만 정의, 사용처는 후속 phase.

스타일은 NativeWind 클래스만 사용 (CLAUDE.md CRITICAL — 매직 넘버 색상 금지). 색상에만 의존하지 않게 아이콘 + 색상 + 텍스트 3중 인코딩 (CLAUDE.md).

### 2. `src/components/ErrorBoundary.tsx` 신규 작성

React 의 ErrorBoundary 는 class component 가 유일 — function/hook 패턴 없음.

```ts
type Props = {
  children: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
};

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // ARCHITECTURE.md §247 — DEV 빌드는 RN 표준 LogBox 가 먼저 잡으므로 추가 로그 없이 fall-through.
    // production: dev 콘솔 로그만 (운영 전송은 v2 이후).
    if (!__DEV__) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
    this.props.onError?.(error, info);
  }

  reset = (): void => this.setState({ error: null });

  render(): React.ReactNode {
    if (this.state.error) {
      const message = this.state.error instanceof AppError
        ? '앱에서 오류가 발생했습니다.'
        : '알 수 없는 오류가 발생했습니다.';
      const detail = __DEV__ && this.state.error instanceof AppError
        ? this.state.error.code
        : undefined;
      return (
        <ErrorView
          variant="fatal"
          message={message}
          detail={detail}
          retryLabel="다시 시작"
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
```

핵심 규칙:

- "다시 시작" 은 reset → 자식 트리 다시 mount. native restart 가 아닌 component-level reset (Expo managed 에서는 native restart API 부재).
- reset 후 동일 에러 재발 시 다시 ErrorView 표시 (무한 루프 가능성 — 의도된 동작).
- `AppError` 카탈로그 vs 외부 throw 구분해 메시지 분기.

### 3. `app/_layout.tsx` 수정

```ts
return (
  <ErrorBoundary>
    <StatusBar style="dark" />
    <Stack ... />
  </ErrorBoundary>
);
```

step 0~2 의 boot 로직은 ErrorBoundary 바깥 (boot 도중 throw 는 RN 의 redbox 로 처리 — splash 단계라 ErrorBoundary 가 재렌더할 자식이 없음).

### 4. 테스트 — `src/components/__tests__/`

#### `ErrorView.test.tsx`

- 3 variant 각각 렌더 (fatal / inline / screen) — 스냅샷 대신 핵심 텍스트 + 접근성 role 검증
- `onRetry` 미제공 시 CTA 미렌더
- `retryLabel` 기본값 검증 (`다시 시작` / `다시 시도`)
- `detail` 은 `__DEV__` 에서만 표시 (Jest 환경에서 `__DEV__` true 가정)

#### `ErrorBoundary.test.tsx`

- 자식이 throw 하면 ErrorView fatal 렌더
- `reset` 호출 시 자식 다시 렌더 시도 (throw 가 멎었다면 정상 표시)
- `AppError` throw 시 message 가 "앱에서 오류" 분기 + (DEV) detail 에 code 표시
- 외부 Error throw 시 message 가 "알 수 없는 오류" 분기
- `onError` 콜백이 throw 정보와 함께 호출됨

mocking: `jest.spyOn(console, 'error').mockImplementation(() => undefined)` 로 production 분기의 로그 노이즈 차단. 컴포넌트 트리 throw 는 자식 컴포넌트의 render 에서 throw 하는 fixture 작성.

### 5. TESTING.md 인벤토리

신규 section §N.y `src/components/{ErrorBoundary,ErrorView}` 추가.
RootLayout section 에 한 줄 추가:

```
- [ ] 자식 트리 throw → <ErrorView fatal /> 표시 + "다시 시작" CTA
```

### 6. jest.config 커버리지 — components threshold

`src/components/**` 은 본 phase 에서 처음 들어오는 영역. CLAUDE.md / TESTING.md §4 에 명시된 components threshold (예: 85/75/85/85) 가 있으면 본 step 에서 활성. 없으면 별도 ADR/PR — 본 step 은 신규 컴포넌트 한정 100% 커버하되 threshold enable 은 phase 범위 외.

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test -- src/components app
```

- typecheck / lint 통과
- ErrorView 4+ case, ErrorBoundary 5+ case, RootLayout (앞 step + boundary 통합) 통과
- 신규 파일 라인 100% 커버
- 변경 파일:
  - 신규 `src/components/ErrorView.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/index.ts` (re-export), `src/components/__tests__/{ErrorView,ErrorBoundary}.test.tsx`
  - 수정 `app/_layout.tsx`, `app/__tests__/_layout.test.tsx`, `docs/TESTING.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - NativeWind 클래스 + tokens.ts 만 사용 (매직 컬러 금지)?
   - 색상 + 아이콘 + 텍스트 3중 인코딩 (UI_GUIDE 정합성)?
   - `__DEV__` 가드로 production 로그 분리?
   - `AppError` vs 외부 Error 메시지 분기?
   - reset 후 자식 다시 mount?
3. `phases/app-shell/index.json` step 3 → completed

## 금지사항

- **외부 ErrorBoundary 라이브러리 (react-error-boundary 등) 도입 금지.** 이유: ADR 없는 신규 의존성 = CLAUDE.md CRITICAL 위반. RN 의 표준 class boundary 면 충분.
- **native app restart API 호출 금지** (`expo-updates` 의 reload 등). 이유: managed workflow 의 dev/prod 동작 차이 + 사이드프로젝트 무료 인프라 정책. component-level reset 으로 충분.
- **에러를 catch 후 silent return 금지.** 이유: silent fail 정책. dev/prod 모두 콘솔 로그 + UI 표시.
- **inline 배지 / screen variant 사용처 추가 금지.** 이유: 본 phase 는 컴포넌트 정의까지. 사용처는 후속 phase 화면 작업.
- **components threshold enable 금지** (jest.config 의 `src/components/**`). 이유: 단일 phase 에서 임계치 결정 부적절. 별도 결정 (ADR / 후속 phase).
- 기존 테스트 깨뜨리지 마라.
