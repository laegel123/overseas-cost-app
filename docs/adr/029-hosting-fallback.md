[← ADR 인덱스](../ADR.md)

# ADR-029: 데이터 호스팅 fallback — GitHub Raw + jsDelivr 미러

> **상태**: Active

**결정**: 도시 JSON primary 호스팅은 GitHub Raw, backup 은 jsDelivr CDN (자동 미러). data.ts 의 fetch 가 primary 실패 시 자동으로 backup 시도.
**이유**: GitHub Raw 도 다운될 수 있고, repo 정책 변경 가능성도 있음. jsDelivr 는 GitHub 자동 미러링이라 우리가 별도 운영 부담 없이 backup 확보.
**트레이드오프**: jsDelivr 변경 가능성도 있음 (그 시점에 새 backup ADR). 둘 다 다운 시 시드 데이터 사용.
