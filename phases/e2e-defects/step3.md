# Step 3: compare-pair-bar-columns

## 배경

이 phase(`e2e-defects`)는 2026-09-04 Maestro E2E 검증 세션에서 발견된 앱 결함 4건을 수정한다.
이 step 은 **결함 3 — Compare 카드 막대 행의 도시명·금액 잘림** 을 다룬다.

관찰(E2E 스크린샷): Compare 화면의 ComparePair 카드에서 도시 행만 `밴…`, `368.9…` 처럼 truncate 된다 (서울 행은 정상). 정보 손실.

원인 (`src/components/ComparePair.tsx` 막대 영역):

- 좌측 라벨 `Small` 이 `w-7`(28px), 우측 값 `Small` 이 `w-14`(56px) 고정 폭 + `numberOfLines={1}`.
- 디자인 원안(`docs/design/README.md` §3, 77줄) 은 라벨을 3글자 코드(`SEO`/`VAN`, 10px) 로 상정했지만, 구현은
  `app/compare/[cityId].tsx` 에서 `sLabel="서울"`, `cLabel={city.name.ko}`(최대 6자: 로스앤젤레스·샌프란시스코), 값은 `formatKRW()` 문자열(예: `368.9만원`, `1.2억원`) 을 넘긴다.
- 서울 행은 2글자·작은 값이라 우연히 맞고, 도시 행은 잘린다.

**step 2 에서 ComparePair 의 헤더/컨테이너 구조가 바뀌었다** (Switch 를 Pressable 밖 독립 요소로 분리). 막대 영역은 step 2 에서 손대지 않았다.

## 읽어야 할 파일

문서 본문은 프롬프트에 인라인되지 않으므로(ADR-069), 아래 목록을 반드시 직접 Read 할 것:

- `docs/ARCHITECTURE.md`
- `docs/ADR.md` (인덱스)
- `docs/UI_GUIDE.md` §ComparePair (142~150줄 부근 — "좌측 라벨 28px width / 우측 값 56px width" 명세가 이 step 에서 바뀐다)
- `docs/design/README.md` §3 (77줄 부근 — 원안의 28/56px 근거)
- `docs/TESTING.md` §9.17 (`ComparePair.tsx` 인벤토리)
- `src/components/ComparePair.tsx` — step 2 결과 전체. 막대 영역(서울 행/도시 행) 의 현재 className
- `src/components/__tests__/ComparePair.test.tsx` — className 단언 방식(`props.className` `toContain`)
- `src/components/cards/HeroCard.tsx` — `flex-1` / `shrink-0` 컬럼 레이아웃 참고
- `app/compare/[cityId].tsx` 425~445줄 부근 — `sLabel`/`cLabel`/`sValue`/`cValue` 로 넘기는 실제 문자열
- `src/lib/format.ts` — `formatKRW` 출력 형태
- `tailwind.config.js`, `src/theme/tokens.ts` — 사용 가능한 spacing 토큰

## 작업

### 1. 막대 영역 레이아웃 — 고정 폭 제거, 정렬 유지

불변식 (테스트·리뷰가 강제):

- **A. 잘림 없음**: 라벨 컬럼과 값 컬럼은 내용 폭에 맞춘다 (`shrink-0`, 고정 `w-*`/`min-w-*` 없음). 막대 컬럼이 `flex-1 min-w-0` 으로 남는 폭을 흡수한다.
- **B. 막대 정렬**: 서울 행과 도시 행의 막대는 **같은 x 에서 시작하고 같은 x 에서 끝난다** (듀얼 바의 존재 이유 — 길이 비교). 두 행의 라벨 폭이 다르면(`서울` vs `샌프란시스코`) 행별 auto 폭으로는 정렬이 깨지므로, 아래 **컬럼 우선(column-major)** 구조를 권장한다.
- **C. 스타일 유지**: 색상(`gray-2`/`orange` 라벨, `gray`/`navy` 값), 폰트 클래스, 막대 높이 `h-2`·track `bg-light`·fill `bg-gray`/`bg-orange`, 막대 폭 `${sw*100}%`/`${cw*100}%`, testID `-bar-seoul`/`-bar-city` 모두 유지. `numberOfLines={1}` 은 안전망으로 유지.
- **D. 토큰만**: 높이·간격은 tailwind spacing 토큰만 사용. 매직 px 금지.

권장 구조:

```tsx
<View className="flex-row items-center gap-2">
  {/* 라벨 컬럼 — 두 행의 라벨을 세로로 쌓아 폭 = 긴 쪽 */}
  <View className="shrink-0 gap-1.5">
    <셀 h-? justify-center><Small color="gray-2" …>{sLabel}</Small></셀>
    <셀 h-? justify-center><Small color="orange" …>{cLabel}</Small></셀>
  </View>
  {/* 막대 컬럼 */}
  <View className="flex-1 min-w-0 gap-1.5">
    <셀 h-? justify-center>{서울 track + fill}</셀>
    <셀 h-? justify-center>{도시 track + fill}</셀>
  </View>
  {/* 값 컬럼 — 우측 정렬 */}
  <View className="shrink-0 items-end gap-1.5">
    <셀 h-? justify-center><Small color="gray" …>{sValue}</Small></셀>
    <셀 h-? justify-center><Small color="navy" …>{cValue}</Small></셀>
  </View>
</View>
```

- 세 컬럼의 셀 높이(`h-?`) 와 행 간격(`gap-1.5`) 을 **동일하게** 해 행이 가로로 정렬되게 한다. 높이는 `Small` 의 line-height 를 담는 토큰(예: `h-4`/`h-5`) 중 하나로 통일한다.
- 코드 주석에 불변식 B(정렬 이유) 를 1~2줄 남긴다.

### 2. `src/components/__tests__/ComparePair.test.tsx`

jest 에는 레이아웃 엔진이 없으므로 구조·클래스 단언으로 고정한다:

- 라벨·값 텍스트 노드의 `className` 에 `w-7`, `w-14` 가 없다.
- 긴 입력으로 렌더: `cLabel="샌프란시스코"`, `cValue="1234.5만원"` 같은 값 → 텍스트가 **그대로**(생략 없이) 렌더되고 `numberOfLines` 는 `1`.
- `-bar-seoul`/`-bar-city` 의 `style.width` 퍼센트가 `swPct`/`cwPct` 와 일치 (기존 테스트 유지).
- 색상/폰트 클래스 유지 단언 (기존 테스트가 있으면 유지, 없으면 추가하지 않아도 됨 — 최소 변경).

### 3. 문서

- `docs/UI_GUIDE.md` §ComparePair: "좌측 라벨 28px width / 우측 값 56px width 11px right" 를
  "좌측 라벨·우측 값은 내용 폭(shrink-0), 막대 flex-1; 두 행 막대 x 정렬 유지 — design/README §3 의 28/56px 는 SEO/VAN 3글자 코드 원안이며 구현은 한글 도시명·formatKRW 기준" 으로 교체.
- `docs/TESTING.md` §9.17 인벤토리에 위 테스트를 `- [x]` 로 추가.

## Acceptance Criteria

```bash
npm run typecheck && npm run lint && npm test
! grep -nE "w-7\b|w-14\b" src/components/ComparePair.tsx   # 막대 행 고정 폭 제거 (step 2 의 mr-14 등 여백 토큰은 무관)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - 불변식 A~D 충족. 특히 B — 세 컬럼의 셀 높이·간격이 동일한가?
   - `docs/UI_GUIDE.md` §ComparePair 명세와 `docs/TESTING.md` §9.17 갱신됐는가? (누락 = step 미완)
   - iOS 시뮬레이터 + 개발 빌드가 이미 실행 가능하면 Compare 화면(밴쿠버, 샌프란시스코) 스크린샷으로 잘림 없음·막대 정렬을 눈으로 확인한다.
     불가능하면 summary 에 "시각 확인은 /verify-e2e 세션에서" 라고 기록한다 (AC 아님).
3. 결과에 따라 `phases/e2e-defects/index.json`의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 레이아웃 변경 요지·테스트 수 기록
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `app/compare/[cityId].tsx` 가 넘기는 라벨·값을 줄이거나(도시명 축약, 단위 생략) `formatKRW` 를 바꾸지 마라. 이유: 정보 손실이 결함의 본질이며 포맷 함수는 앱 전체가 공유한다.
- `adjustsFontSizeToFit`·폰트 축소로 우회하지 마라. 이유: 가독성·타이포 토큰 정책 위반.
- 헤더 row·Switch·Pressable 구조(step 2 결과) 를 변경하지 마라. 이유: step 2 의 범위이며 접근성 불변식 테스트가 의존한다.
- 고정 px 폭(`w-[72px]` 같은 arbitrary value) 을 쓰지 마라. 이유: 도시명·값 길이는 데이터에 따라 달라지며 토큰 정책 위반.
- 기존 테스트를 깨뜨리지 마라.
