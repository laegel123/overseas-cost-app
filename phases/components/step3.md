# Step 3: atoms

단순 atom — MenuRow (설정 메뉴 행) + RegionPill (홈 권역 필터). 다음 step (HeroCard / ComparePair / rows) 가 본 atom 패턴을 변형해서 사용.

## 읽어야 할 파일

- `CLAUDE.md` — CRITICAL
- `docs/design/README.md` §3 (홈 — 권역 그리드), §5 (설정 — 메뉴 리스트)
- `docs/UI_GUIDE.md`
- `docs/TESTING.md` §9.15 (MenuRow), §9.16 (RegionPill)
- step 0~2 산출물: Text variants, Icon, Screen/TopBar (테스트 wrap 용)

## 작업

### 1. `src/components/MenuRow.tsx`

```ts
export type MenuRowProps = {
  icon: IconName;
  label: string;
  rightText?: string;       // 오른쪽 보조 (예: "v1.0.0", "한국어")
  variant?: 'default' | 'hot' | 'dim';  // 기본 default
  isLast?: boolean;         // 마지막 행 — bottom border 제거
  disabled?: boolean;
  showChevron?: boolean;    // dim 류는 chevron 미표시
  onPress?: () => void;
  testID?: string;
};
```

- `default`: light icon bg (`bg-light`), navy text, chevron `chev-right`
- `hot`: `bg-orange-soft` icon + orange icon color
- `dim`: gray-2 text, chevron 미표시 (`showChevron=false` default 와 함께 조합)
- icon 박스 36×36 rounded `rounded-icon-md` (16px), Icon 22px
- rightText: 11px Tiny gray-2, `numberOfLines={1}`
- disabled: opacity 0.5, onPress 미호출
- isLast=true → bottom border 없음, 그 외 `border-line` (border-color tokens)
- 행 padding 좌우 14px, 상하 12px

### 2. `src/components/RegionPill.tsx`

```ts
export type RegionPillProps = {
  label: string;
  count?: number;
  active?: boolean;
  onSelect?: () => void;
  testID?: string;
};
```

- `active=true`: `bg-navy`, white text
- `active=false`: `bg-white`, `border-line`, navy text
- `count` 있으면 `"북미 (8)"` 형식, 없으면 `"북미"`
- 라운드 chip (999px), 패딩 좌우 14px / 상하 8px
- hit slop 44×44 보장 (`hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}`)
- 긴 label `numberOfLines={1}` ellipsis

### 3. `src/components/index.ts` re-export

기존 + MenuRow / RegionPill / 타입 export.

### 4. 테스트

#### `MenuRow.test.tsx` (~15 case, TESTING.md §9.15)

- 3 variant (default / hot / dim) 시각 분기
- rightText 있을 / 없을 / 긴 (ellipsis)
- isLast → bottom border 없음
- disabled → opacity + onPress 미호출
- showChevron=false → chevron 미렌더
- 탭 → onPress

#### `RegionPill.test.tsx` (~10 case, TESTING.md §9.16)

- active true / false 색상
- count 있을 / 없을
- 긴 region 이름 ellipsis
- 탭 → onSelect
- hit slop 44×44 검증 (간접 — props.hitSlop)

대략 25 case.

### 5. TESTING.md §9.15~9.16 인벤토리 갱신

## Acceptance Criteria

```bash
npm run typecheck \
  && npm run lint \
  && npm test
```

- 모든 테스트 통과
- `src/components/**` 100/100/100/100 유지
- 변경 파일: 2 신규 컴포넌트 + 2 테스트, `src/components/index.ts`, `docs/TESTING.md`

## 검증 절차

1. AC 명령 실행
2. 체크리스트:
   - MenuRow variant 3 모두 시각 분기?
   - RegionPill hit slop 44×44 보장?
   - tokens 외 hex / 매직 px 없음?
   - Icon / Text variants 만 사용?
3. `phases/components/index.json` step 3 → completed

## 금지사항

- **MenuRow 의 rightText 위치에 다른 widget (switch / button) 추가 금지.** 이유: design/README.md 단순 텍스트만. Switch 류는 별도 atom.
- **RegionPill 의 count 를 라이브러리 (Badge 등) 로 wrap 금지.** 이유: 라벨에 그대로 결합 — 단일 텍스트 출력.
- **icon 색상 / bg 를 매직 hex 로 박지 마라.** 이유: tokens 단일 출처.
- **chevron 을 항상 표시하지 마라.** 이유: design/README.md §Settings 의 dim 행은 chevron 없음.
- 기존 테스트 깨뜨리지 마라.
