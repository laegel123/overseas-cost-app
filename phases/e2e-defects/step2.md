# Step 2: compare-pair-switch-a11y

## 배경

이 phase(`e2e-defects`)는 2026-09-04 Maestro E2E 검증 세션에서 발견된 앱 결함 4건을 수정한다.
이 step 은 **결함 2 — Compare 카드의 합산 토글 `Switch` 접근성** 을 다룬다.

관찰(E2E, iOS 시뮬레이터): `src/components/ComparePair.tsx` 의 합산 포함 토글(`testID`: `compare-pair-{category}-toggle`) 은
**OFF 일 때만 iOS 접근성 트리에 노출**되고 ON 이면 사라진다. VoiceOver 사용자가 켠 스위치를 다시 찾아 끌 수 없고,
Maestro 도 ON→OFF 방향을 검증할 수 없었다.

코드에서 확인된 결함 2가지 (이 세션에는 실기·시뮬레이터가 없으므로 "ON 일 때만 사라지는" 정확한 기전은 미확인이다.
아래 두 가지를 구조적으로 제거하면 기전과 무관하게 해결된다):

1. `Switch` 에 `accessibilityState` 가 없다 → 스크린리더가 켜짐/꺼짐 상태를 알 수 없다.
2. `Switch` 가 카드 전체를 감싸는 `Pressable`(`accessibilityRole="button"`, `accessible` 기본 true) 의 **자손**이다.
   iOS 에서 `accessible` 컨테이너는 하나의 접근성 요소로 묶이고 자손은 VoiceOver 에서 개별 요소로 노출되지 않는다.
   즉 토글이 독립 접근성 요소가 아니다.

현재 구조 (`ComparePair.tsx`):

```
card = <View className="bg-white border border-line rounded-card p-3" testID={testID} style={{opacity}}>
         헤더 row: [아이콘 박스, 라벨, (제외됨 배지)]  …  [배수 텍스트, Switch]
         막대 영역: 서울 행 / 도시 행
       </View>
onPress 있으면 <Pressable accessibilityRole="button" accessibilityLabel={`${label} 비교 카드`}>{card}</Pressable>, 없으면 card 그대로
```

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md`
- `docs/ADR.md` — 인덱스. ADR-062(카테고리 합산 포함 토글), ADR-067(통합 뷰) 를 골라 읽을 것
- `docs/UI_GUIDE.md` — §ComparePair(142줄 부근) 와 §접근성(662줄 부근)
- `docs/TESTING.md` — §9.17 (`ComparePair.tsx` 인벤토리) 와 §11 접근성 테스트
- `.maestro/GOTCHAS.md` §4·§5 — iOS 접근성 트리에서 요소가 안 잡히는 관찰 사례
- `src/components/ComparePair.tsx` — 전체
- `src/components/__tests__/ComparePair.test.tsx` — 특히 토글 관련 describe(230~285줄 부근)
- `app/compare/[cityId].tsx` 425~445줄 부근 — ComparePair 사용부(`onPress`, `onToggleInclude`, `testID`)
- `.maestro/flows/03-compare/unified-categories.yaml` — `compare-pair-{category}` testID 로 카드를 조회하는 E2E (root testID 유지 필요)

## 작업

### 1. `Switch` 상태 노출

```tsx
accessibilityState={{ checked: included }}
```

기존 `accessibilityRole="switch"`, `accessibilityLabel={`${label} 합산 포함`}`, `testID` 는 유지한다.

### 2. `Switch` 를 접근성 컨테이너 밖으로 — 구조 불변식

다음 불변식을 만족하도록 JSX 를 재구성한다 (테스트가 강제한다):

- **불변식 A**: `Switch` 의 조상 중 `accessible === true` 이거나 `accessibilityRole === 'button'` 인 요소가 없다.
- **불변식 B**: 카드의 탭 영역(아이콘·라벨·배지·배수·막대)은 여전히 **하나의** `accessibilityRole="button"` 요소이며
  라벨은 `${label} 비교 카드` 다. `onPress` 가 없으면 Pressable 없이 렌더한다 (현재 동작 유지).
- **불변식 C**: 시각 레이아웃은 현재와 동일 — 헤더 row 우측 끝에 배수 텍스트 옆 Switch, 아래 막대 영역. 카드 padding·radius·border·excluded opacity 동일.
- **불변식 D**: 모든 testID 유지 — root `testID`, `-icon-box`, `-excluded-badge`, `-mult`, `-toggle`, `-bar-seoul`, `-bar-city`.
  root `testID` 는 카드의 **가장 바깥 시각 컨테이너** 에 남긴다 (E2E 가 이 id 로 카드를 탭한다).

권장 구조 (동등한 대안 가능):

```tsx
<View className="bg-white border border-line rounded-card" style={{ opacity }} testID={testID}>   // 시각 컨테이너
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} 비교 카드`} className="p-3">
    {헤더 좌측 + 배수 텍스트 + 막대 영역}   // Switch 제외. 토글이 있으면 배수 텍스트 우측에 Switch 폭만큼 여백(tailwind spacing 토큰, 예: mr-14)
  </Pressable>
  {onToggleInclude !== undefined && (
    <Switch … className="absolute top-3 right-3" />   // 헤더 우측 끝 위치 = 카드 padding 토큰(p-3) 과 동일 오프셋
  )}
</View>
```

- `onPress` 가 없을 때는 Pressable 대신 같은 className 의 `View` 로 감싼다.
- 절대 배치 오프셋·여백은 반드시 tailwind spacing 토큰(`top-3`, `right-3`, `mr-14` 등) 으로만. 매직 px 금지.

### 3. `src/components/__tests__/ComparePair.test.tsx`

- 토글의 `accessibilityState.checked` 가 `included` 와 같다 (`true`/`false` 각각).
- 불변식 A: `getByTestId('…-toggle')` 에서 `.parent` 체인을 따라 올라가며 `props.accessible === true` 또는
  `props.accessibilityRole === 'button'` 인 조상이 없음을 단언한다.
- 불변식 B: `accessibilityRole="button"` + 라벨 `${label} 비교 카드` 요소가 존재하고 press 시 `onPress` 호출.
  토글 `onValueChange` 시 `onToggleInclude(!included)` 호출되고 `onPress` 는 호출되지 않는다.
- `onPress` 미지정 시 button 요소가 없고 토글은 여전히 렌더된다.
- 기존 토글 테스트(230~285줄 부근) 는 유지·보강한다.

### 4. 문서

- `docs/UI_GUIDE.md` §ComparePair 에 접근성 구조 1~2줄 추가: 카드 = 단일 button 요소(라벨 `{카테고리} 비교 카드`), 합산 토글 = 그 **밖의** 독립 switch 요소(`accessibilityState.checked`).
- `.maestro/GOTCHAS.md` §5 관찰 사례 목록에 1줄 추가: "`accessible` Pressable 자손인 Switch 는 iOS 접근성 트리에서 상태에 따라 사라졌음(2026-09-04 검증, e2e-defects step 2 에서 구조 분리로 해결)".
- `docs/TESTING.md` §9.17 인벤토리에 위 테스트를 `- [x]` 로 추가.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
grep -n "accessibilityState={{ checked: included }}" src/components/ComparePair.tsx   # 1건
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - 불변식 A~D 를 테스트가 실제로 단언하는가? (특히 A 의 조상 체인 검사)
   - 매직 px 없이 tailwind 토큰만 사용했는가? (CLAUDE.md CRITICAL)
   - `docs/TESTING.md` §9.17 인벤토리·UI_GUIDE·GOTCHAS 갱신됐는가? (누락 = step 미완)
   - iOS 시뮬레이터 + 개발 빌드가 이미 실행 가능하면 `.maestro/flows/03-compare/unified-categories.yaml` 을 돌려 카드 탭 회귀가 없는지 확인한다.
     불가능하면 summary 에 "시각·VoiceOver 확인은 /verify-e2e 세션에서" 라고 기록한다 (AC 아님).
3. 결과에 따라 `phases/e2e-defects/index.json`의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 구조 변경 요지·테스트 수 기록
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 카드 Pressable 에 `accessible={false}` 를 주는 지름길을 쓰지 마라. 이유: VoiceOver 가 카드 안 텍스트를 낱개로 읽게 되어 "카드 = 하나의 버튼" 내비게이션이 깨진다.
- 막대 영역(서울 행/도시 행) 의 레이아웃·className 을 변경하지 마라. 이유: 결함 3(잘림) 은 step 3 의 범위. 이 step 은 헤더·컨테이너 구조만 다룬다.
- `src/store/categoryInclusion.ts` 나 토글 의미(ON=합산 포함) 를 변경하지 마라. 이유: 결함은 접근성 구조뿐이다.
- `accessibilityLabel` 문구를 바꾸지 마라. 이유: 기존 테스트·E2E 가 의존하며 한국어 문구 정책과 이미 일치한다.
- 기존 테스트를 깨뜨리지 마라.
