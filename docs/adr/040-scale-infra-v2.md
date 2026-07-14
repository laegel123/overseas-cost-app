[← ADR 인덱스](../ADR.md)

# ADR-040: 사용자 1M+ 확장 시 인프라 전환 (v2 검토)

> **상태**: Active

**결정**: v1.0 GitHub Raw + jsDelivr 무료 호스팅. 사용자 1M+ 도달 시 Cloudflare R2 또는 자체 CDN 전환 검토 (별도 ADR).
**이유**: 현재는 무료. 트래픽 폭증 시 jsDelivr 의존성 위험 + GitHub raw 대역폭 한계. 단, 1M+ 은 v2 시점 가정.
**트레이드오프**: 전환 시 비용 발생 (월 ~$5~20 추정). 그 시점에 광고 또는 freemium 검토 필요.
