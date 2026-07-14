[← ADR 인덱스](../ADR.md)

# ADR-006: 환율 API — open.er-api.com (무료, 키 불필요)

> **상태**: Active

**결정**: 환율은 `https://open.er-api.com/v6/latest/USD` 같은 무료 엔드포인트 사용. 일 1회 fetch 후 AsyncStorage 캐시.
**이유**: 무료 정책, API 키 발급 절차 없음, 사이드 프로젝트 영구 유지에 적합. 정확도는 일별 평균이라 생활비 비교에 충분.
**트레이드오프**: 운영자 변경 시 fallback 필요. 환율 변동성 큰 통화는 지연 반영 가능. 거래용이 아닌 정보 표시용이라 허용 범위.
