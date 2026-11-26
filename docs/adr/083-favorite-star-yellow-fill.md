[← ADR 인덱스](../ADR.md)

# ADR-083: 즐겨찾기 별 — 버튼 배경 강조 대신 아이콘 yellow 채움 (`yellow` 토큰 추가)

**상태:** 채택 (2026-11-26)

**맥락:**

Compare 화면 TopBar 의 즐겨찾기 버튼은 켜진 상태를 버튼 배경(`orange-soft`)으로만 표시했다.
별 자체는 navy 외곽선 그대로라, 별 주위에 색 박스만 생겨 "켜졌다"는 느낌이 약하고 어색했다.

**결정:**

- 켜진 상태에서 버튼 배경은 `bg-light` 로 두고 **별 아이콘을 yellow 로 채운다** (stroke·fill 모두).
- 색 토큰 `yellow: #FFC107` 을 `tailwind.config.js` 와 `src/theme/tokens.ts` 에 추가한다.
- `Icon` 에 옵셔널 `fill` prop 을 추가한다 (미제공 시 기존과 같은 outline).

**대안:**

- **기존 `orange` 로 채움** — 토큰 추가가 없지만, orange 는 hot(≥2.0×)·CTA 의미로 쓰여 즐겨찾기와 섞인다. 기각.
- **배경 강조 유지 + 별도 채움** — 강조가 이중이라 여전히 과하다. 기각.

**결과:**

- 켜짐/꺼짐이 색(yellow/navy)과 형태(채움/외곽선)로 이중 인코딩된다.
- `docs/design/README.md` §3 Top bar 의 "star = orange-soft" 사양을 대체한다.
- `yellow` 는 즐겨찾기 별 전용이다. 다른 용도로 넓히려면 별도 결정이 필요하다.
