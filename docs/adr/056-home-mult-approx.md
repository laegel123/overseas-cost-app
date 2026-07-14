[← ADR 인덱스](../ADR.md)

# ADR-056: Home 카드 배수는 단순화된 총비용 근사값 (Compare 와 의도적 분리)

**상태:** 채택 (2026-05-02)

**맥락:**

- Compare 화면 (`app/compare/[cityId].tsx`) 의 도시 vs 서울 배수는 카테고리 합산 (`rent + food + transport + tuition + tax + visa`) 으로 계산. `'신규'` 케이스 (서울에 없는 항목) 도 명시.
- Home 화면 (`app/(tabs)/index.tsx`) 의 FavCard / RecentRow 배수는 `rent.share + food (외식 20일 + 식재료 4종) + transport.monthlyPass` 만 사용. 페르소나·세금·비자비·학비 모두 제외.
- 동일 도시에 대해 Home 카드 배수와 Compare 화면 배수가 다를 수 있다 (예: 도쿄 — Home 1.4× / Compare student 1.7×). PR #18 review round 3 에서 일관성 우려 제기.

**결정:**

1. **Home 의 배수는 의도적으로 단순화된 근사값.** 페르소나 분기를 적용하지 않으며, 카테고리도 가장 보편적인 3개 (rent / food / transport) 만 사용한다.
2. 정확한 페르소나 기반 배수는 **Compare 진입 후** 확인하도록 UX 흐름 설계 (Home → 카드 탭 → Compare).
3. Home 의 `multFromTotals` 는 v1.x 에서도 단순 식을 유지. 페르소나 일치를 원하면 `compare.ts` 헬퍼 추출 후 양쪽 공유 (별도 ADR).

**대안 검토:**

- (A 선택) Home 단순화 + Compare 정밀, ADR 로 명시: Home 의 카드 배수는 "어림 비교" UX 역할. 학비·비자비처럼 페르소나 종속 항목을 카드에 노출하면 의미가 모호해짐. 단순 식이 사용자 멘탈 모델과 일치. 채택.
- (B) Home 도 페르소나 분기 적용: persona store 의존성 + Compare 와 동일 헬퍼 추출 필요. 카드 단위 정보로는 과도. 거부.
- (C) Home 배수 표기 자체 제거: design/README §2 의 카드 정보 밀도 의도 (배수 + hot 표시) 와 충돌. 거부.

**결과 / 영향:**

- Home 화면은 빠른 시각적 비교 카드, Compare 화면은 정밀 분석 — 역할 분리 명확화.
- 배수 차이는 정상이며 버그 아님. 사용자 혼동 발생 시 UI 카피 (예: "어림 비교" 라벨) 추가 검토.
- v1.x 에서 헬퍼 통합 검토 시 본 ADR 갱신 필요.

**관련:** `app/(tabs)/index.tsx` (`computeCityTotal`, `multFromTotals`), `app/compare/[cityId].tsx`, `docs/PRD.md` §Home, design/README §2.
