# 출처 색인

`data/seed/all.json` 및 (장차) 자동화 산출 `data/all.json` 의 모든 데이터 포인트가 어느 공공 출처에서 왔는지 색인한다. 본 색인에 등재된 출처만 사용 가능 (CLAUDE.md CRITICAL · DATA.md §3.2).

> **v1.0 시드 주의:** 현재 `data/seed/all.json` 은 schema-pass fixture (실값 미검증) 다. ADR-045 참조. 실 데이터는 자동화 phase 산출물이 GitHub raw 로 호스팅되며, 분기 갱신 시 본 색인이 함께 갱신된다.

## 서울 (KR)

| 카테고리  | 출처                | URL                          | 마지막 접속 |
| --------- | ------------------- | ---------------------------- | ----------- |
| rent      | 국토교통부 실거래가 | https://rt.molit.go.kr/      | 2026-04-01  |
| food      | 한국소비자원 참가격 | https://www.price.go.kr/     | 2026-04-01  |
| transport | 서울교통공사        | https://www.seoulmetro.co.kr/ | 2026-04-01  |

## 밴쿠버 (CA)

| 카테고리  | 출처                      | URL                                                            | 마지막 접속 |
| --------- | ------------------------- | -------------------------------------------------------------- | ----------- |
| rent      | CMHC Rental Market Survey | https://www03.cmhc-schl.gc.ca/hmip-pimh/en/                    | 2026-04-01  |
| food      | Statistics Canada CPI     | https://www150.statcan.gc.ca/                                  | 2026-04-01  |
| transport | TransLink                 | https://www.translink.ca/transit-fares                         | 2026-04-01  |
| tuition   | UBC International Tuition | https://you.ubc.ca/financial-planning/cost/                    | 2026-04-01  |
| tax       | Canada Revenue Agency     | https://www.canada.ca/en/revenue-agency.html                   | 2026-04-01  |
| visa      | IRCC                      | https://www.canada.ca/en/immigration-refugees-citizenship.html | 2026-04-01  |
