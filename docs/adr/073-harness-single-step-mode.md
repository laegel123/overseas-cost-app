[← ADR 인덱스](../ADR.md)

# ADR-073: 하네스 단일 step 실행 모드 (`run --once`)

> **상태**: Active

**맥락:**

`scripts/execute.py run <phase>` 는 `_execute_all_steps()` 의 while 루프에서 pending step 을 소진할 때까지 멈추지 않는다. step 하나가 최대 30분(기본 `--timeout 1800`), 재시도까지 포함하면 phase 하나에 수 시간이 걸린다. 그 사이 사람이 개입할 지점이 없다 — 중간 산출물이 설계 의도에서 벗어나도 error 나 blocked 로 떨어지지 않는 한 다음 step 이 그대로 이어 달린다. AC 는 "테스트가 통과하는가" 만 판정하므로, 통과하지만 방향이 틀린 산출물은 걸러지지 않는다.

이미 있는 `--from-step N` 으로 흉내 낼 수는 있으나, 다음 step 번호를 사람이 매번 세어서 넘겨야 하고 그 이전 pending step 에 대한 WARN 이 매번 뜬다. 애초에 "이전 step 을 건너뛰는" 플래그이지 "한 개만 실행하는" 플래그가 아니다.

**결정:**

`run` 에 `--once` 플래그를 추가한다. pending step **하나만** 실행하고 프로세스를 종료한다.

1. 실행 대상은 기존 `run` 과 동일한 규칙 — `index.json` 의 첫 pending step (`--from-step` 과 조합 가능). 별도의 step 지정 인자는 두지 않는다: 상태는 이미 `index.json` 에 있으므로 사람이 번호를 셀 이유가 없다.
2. step 내부 자동 재시도(`MAX_RETRIES = 3`)는 그대로 둔다. `--once` 는 **step 경계**에서만 멈추는 플래그다. AC 실패 후의 자가 교정은 하네스의 핵심 가치이고, 이를 끄면 `--once` 는 "재시도 없는 실행"이라는 다른 의미가 섞인다.
3. `_execute_all_steps()` 가 bool(= 남은 pending 없음)을 반환하고, `run()` 은 그 값이 True 일 때만 `_finalize()` 를 호출한다. 즉 `--once` 로 실행한 step 이 phase 의 마지막이었다면 완료 마킹·summary·`--push` 까지 기존 `run` 과 동일하게 수행되고, 남은 step 이 있으면 phase 는 미완료 상태로 남는다.
4. 실행 후 다음 명령과 남은 step 수를 안내 출력한다.

**대안 검토:**

- **(A) 채택 — `--once` (실행 후 프로세스 종료)**: 셸로 복귀하므로 step 사이에 리뷰·수정·`git log` 확인 등 무엇이든 할 수 있고, 그 사이 터미널이 묶이지 않는다. 상태가 전부 `index.json` 에 있어 세션 간 재개가 공짜다.
- **(B) 기각 — `--interactive` (step 마다 y/N 프롬프트 후 계속)**: 프로세스가 살아있어 상태 재개는 필요 없지만, 확인 대기 동안 터미널이 점유되고 step 사이에 다른 작업을 하려면 결국 중단해야 한다. stdin 대기가 생겨 CI·백그라운드 실행과도 충돌한다.
- **(C) 기각 — `--from-step N` 으로 대체**: 위 맥락 참조. 의미가 다르고 사람이 번호를 관리해야 한다.

**결과 / 영향:**

- 긴 phase 를 사람이 step 단위로 검수하며 진행할 수 있다. 방향이 틀린 산출물을 다음 step 이 물려받기 전에 잡는다.
- 기존 `run` 의 동작은 그대로다 (`--once` 미지정 시 `_execute_all_steps()` 는 항상 True 를 반환 → 종전과 같이 finalize).
- error/blocked 처리 경로는 공유한다 — `--once` 실행 중 step 이 실패하면 기존과 동일하게 exit 1 / exit 2 로 끝나고 `reset` 후 재실행한다.
- 검증: `npm run test:harness` (`TestOnceMode` 11케이스 + `TestRunCmd` 2케이스 — 실행 개수, 반환값, `--from-step` 조합, finalize 호출 여부, 헤더·안내 출력, 인자 전달).

**관련:** ADR-069 (하네스 doc pull), `scripts/execute.py`, `phases/improve-harness-dx/` (하네스 이력).
