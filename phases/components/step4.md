# Step 4: hero-card

HeroCard — 비교 화면의 시각 핵심. orange / navy 2 variant, 정규화 progress bar, ❓ info 아이콘 hook.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/design/README.md` §3 (Compare — 듀얼 바)
- `docs/UI_GUIDE.md` §HeroCard 사양
- `docs/TESTING.md` §9.14 (HeroCard 매트릭스)
- `docs/design/hifi/compare.jsx` (시각 참조)
- step 0~3 산출물: Text variants, Icon, Screen, TopBar

## 작업

### 1. `src/components/cards/HeroCard.tsx`

```ts
export type HeroCardProps = {
  variant: 'orange' | 'navy';
  leftLabel: string;        // 예: "서울"
  leftValue: string;        // 예: "320만/월"
  centerMult: string;       // 예: "↑1.9×"
  centerCaption?: string;   // 예: "+165만/월"
  rightLabel: string;       // 예: "밴쿠버"
  rightValue: string;       // 예: "+485만/월"
  swPct: number;            // 0~1, 서울 막대 정규화 폭
  cwPct: number;            // 0~1, 도시 막대 정규화 폭
  footer?: string;          // 예: "출처: e-나라지표 · 2025-Q4"
  showInfoIcon?: boolean;   // 기본 true
  onInfoPress?: () => void;
  testID?: string;
};
```

**시각 사양:**

- `variant='orange'`: `bg-orange`, white text, progress bar 6px height, `rounded-hero-lg` (22px), `shadows.card` (Platform.select).
- `variant='navy'`: `bg-navy` (gradient `navy → navy-2` — `tokens.gradients.navyPersonaCard` 활용 또는 `LinearGradient` 도입 시 ADR), white text, progress bar 4px, mult 색상 `orange` 강조.
- progress bar: 좌측 서울 폭 `swPct * 100%`, 우측 도시 폭 `cwPct * 100%`. `swPct + cwPct ≠ 1` 일 때 정규화 (둘의 합으로 나눠 비율 보존). 둘 다 0 이면 막대 미표시.
- center mult: `Display` (orange variant) 또는 `Display + orange color override` (navy variant).
- `centerCaption` 슬래시 줄바꿈 방지 — `numberOfLines={1}` + `adjustsFontSizeToFit` (RN Text prop).
- `leftValue` / `rightValue` 긴 값 (`"999만"`) squeeze 안 됨 — `numberOfLines={1}` + `adjustsFontSizeToFit minimumFontScale={0.7}`.
- ❓ 아이콘 우측 상단 (`info` Icon, 22px). `onInfoPress` 콜백 — 미제공 / `showInfoIcon=false` 면 미렌더.
- footer: `Tiny` (11px) gray-2 또는 white opacity 0.7 (variant 별).

### 2. gradient 처리 (navy variant)

LinearGradient 도입 시 `expo-linear-gradient` (Expo SDK 권장 dep). 의존성 추가는 ADR 필요. 대안: navy 단색 + 시각 차이 없음. 본 phase 에서는:

- (A) `expo-linear-gradient` 도입 → ADR-N + bundle 영향 ~수 KB.
- (B) navy 단색 fallback 으로 일단 구현 → ADR 없이 진행, 후속 phase 에서 gradient 도입.

본 step 의 첫 작업: 결정. 1인 사이드 프로젝트 무료 인프라 정책상 (B) 가 안전. 화면 phase 에서 시각 비교 후 (A) 로 전환 가능.

### 3. `src/components/index.ts` re-export

```ts
export { HeroCard } from './cards/HeroCard';
export type { HeroCardProps } from './cards/HeroCard';
```

### 4. 테스트 — `src/components/cards/__tests__/HeroCard.test.tsx`

- 2 variant 시각 분기 (bg / progress 두께)
- left/right label/value 렌더
- centerMult / centerCaption 렌더 + omit
- swPct + cwPct 정규화: (0.5, 0.5), (0, 1), (1, 0), (0.4, 0.6) 막대 폭 검증
- footer 표시 / omit
- ❓ 아이콘 탭 → onInfoPress
- showInfoIcon=false → 아이콘 미렌더
- 긴 값 / 이모지 라벨 / `+165만/월` caption — numberOfLines / adjustsFontSizeToFit 적용 확인

대략 20 case.

### 5. TESTING.md §9.14 인벤토리 갱신

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test
```

- 모든 테스트 통과
- `src/components/**` 100/100/100/100 유지
- 변경 파일:
  - 신규 `src/components/cards/HeroCard.tsx`, `src/components/cards/__tests__/HeroCard.test.tsx`
  - 수정 `src/components/index.ts`, `docs/TESTING.md`
  - (gradient 도입 시) ADR + package.json

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - swPct + cwPct = 1 일 때 막대 정확히 채움?
   - 합계 ≠ 1 일 때 정규화 또는 명시 정책?
   - ❓ 탭 hook 작동?
   - 긴 값 (`"999만"`) squeeze 안 됨?
   - tokens 만 사용?
3. `phases/components/index.json` step 4 → completed

## 금지사항

- **swPct / cwPct 음수 / >1 입력 silent 무시 금지.** 이유: silent fail 정책. `Math.max(0, Math.min(1, x))` 로 clamp 후 dev warn.
- **footer 에 링크 / 버튼 추가 금지.** 이유: 출처 텍스트 표시 전용 (PRD §F8 출처 시트는 별도 phase).
- **gradient 임의 hex 박지 마라.** 이유: tokens.gradients.navyPersonaCard 단일 출처 (현재 navy/navy-2 두 색).
- **`Display` 외 사이즈로 mult 표시 금지.** 이유: design/README.md §3 의 hero size 강제.
- **shadow Platform.select 우회 금지.** 이유: tokens.shadows.card 단일 출처.
- 기존 테스트 깨뜨리지 마라.
