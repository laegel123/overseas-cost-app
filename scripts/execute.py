#!/usr/bin/env python3
"""
Harness Step Executor — phase 내 step을 순차 실행하고 자가 교정한다.

Usage:
    python3 scripts/execute.py <phase-dir> [--push]
"""

import argparse
import contextlib
import json
import os
import subprocess
import sys
import threading
import time
import types
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent


@contextlib.contextmanager
def progress_indicator(label: str):
    """터미널 진행 표시기. with 문으로 사용하며 .elapsed 로 경과 시간을 읽는다."""
    frames = "◐◓◑◒"
    stop = threading.Event()
    t0 = time.monotonic()

    def _animate():
        idx = 0
        while not stop.wait(0.12):
            sec = int(time.monotonic() - t0)
            sys.stderr.write(f"\r{frames[idx % len(frames)]} {label} [{sec}s]")
            sys.stderr.flush()
            idx += 1
        sys.stderr.write("\r" + " " * (len(label) + 20) + "\r")
        sys.stderr.flush()

    th = threading.Thread(target=_animate, daemon=True)
    th.start()
    info = types.SimpleNamespace(elapsed=0.0)
    try:
        yield info
    finally:
        stop.set()
        th.join()
        info.elapsed = time.monotonic() - t0


class StepExecutor:
    """Phase 디렉토리 안의 step들을 순차 실행하는 하네스."""

    MAX_RETRIES = 3
    FEAT_MSG = "feat({phase}): step {num} — {name}"
    CHORE_MSG = "chore({phase}): step {num} output"
    TZ = timezone(timedelta(hours=9))

    def __init__(
        self,
        phase_dir_name: str,
        *,
        auto_push: bool = False,
        from_step: int = 0,
        model: str = "claude-opus-4-5",
        timeout: int = 1800,
        verbose: bool = False,
    ):
        self._root = str(ROOT)
        self._phases_dir = ROOT / "phases"
        self._phase_dir = self._phases_dir / phase_dir_name
        self._phase_dir_name = phase_dir_name
        self._top_index_file = self._phases_dir / "index.json"
        self._auto_push = auto_push
        self._from_step = from_step
        self._model = model
        self._timeout = timeout
        self._verbose = verbose

        if not self._phase_dir.is_dir():
            print(f"ERROR: {self._phase_dir} not found")
            sys.exit(1)

        self._index_file = self._phase_dir / "index.json"
        if not self._index_file.exists():
            print(f"ERROR: {self._index_file} not found")
            sys.exit(1)

        idx = self._read_json(self._index_file)
        self._project = idx.get("project", "project")
        self._phase_name = idx.get("phase", phase_dir_name)
        self._total = len(idx["steps"])

    def run(self):
        self._print_header()
        self._check_blockers()
        self._preflight_check()
        self._checkout_branch()
        guardrails = self._load_guardrails()
        self._ensure_created_at()
        self._execute_all_steps(guardrails)
        self._finalize()

    # --- timestamps ---

    def _stamp(self) -> str:
        return datetime.now(self.TZ).strftime("%Y-%m-%dT%H:%M:%S%z")

    # --- JSON I/O ---

    @staticmethod
    def _read_json(p: Path) -> dict:
        return json.loads(p.read_text(encoding="utf-8"))

    @staticmethod
    def _write_json(p: Path, data: dict):
        p.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # --- git ---

    def _run_git(self, *args) -> subprocess.CompletedProcess:
        cmd = ["git"] + list(args)
        return subprocess.run(cmd, cwd=self._root, capture_output=True, text=True)

    def _checkout_branch(self):
        branch = f"feat-{self._phase_name}"

        r = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        if r.returncode != 0:
            print(f"  ERROR: git을 사용할 수 없거나 git repo가 아닙니다.")
            print(f"  {r.stderr.strip()}")
            sys.exit(1)

        if r.stdout.strip() == branch:
            return

        r = self._run_git("rev-parse", "--verify", branch)
        r = self._run_git("checkout", branch) if r.returncode == 0 else self._run_git("checkout", "-b", branch)

        if r.returncode != 0:
            print(f"  ERROR: 브랜치 '{branch}' checkout 실패.")
            print(f"  {r.stderr.strip()}")
            print(f"  Hint: 변경사항을 stash하거나 commit한 후 다시 시도하세요.")
            sys.exit(1)

        print(f"  Branch: {branch}")

    def _commit_step(self, step_num: int, step_name: str):
        output_rel = f"phases/{self._phase_dir_name}/step{step_num}-output.json"
        index_rel = f"phases/{self._phase_dir_name}/index.json"

        self._run_git("add", "-A")
        self._run_git("reset", "HEAD", "--", output_rel)
        self._run_git("reset", "HEAD", "--", index_rel)

        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.FEAT_MSG.format(phase=self._phase_name, num=step_num, name=step_name)
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  Commit: {msg}")
            else:
                print(f"  WARN: 코드 커밋 실패: {r.stderr.strip()}")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = self.CHORE_MSG.format(phase=self._phase_name, num=step_num)
            r = self._run_git("commit", "-m", msg)
            if r.returncode != 0:
                print(f"  WARN: housekeeping 커밋 실패: {r.stderr.strip()}")

    # --- top-level index ---

    def _update_top_index(self, status: str):
        if not self._top_index_file.exists():
            return
        top = self._read_json(self._top_index_file)
        ts = self._stamp()
        for phase in top.get("phases", []):
            if phase.get("dir") == self._phase_dir_name:
                phase["status"] = status
                ts_key = {"completed": "completed_at", "error": "failed_at", "blocked": "blocked_at"}.get(status)
                if ts_key:
                    phase[ts_key] = ts
                break
        self._write_json(self._top_index_file, top)

    # --- guardrails & context ---

    def _load_guardrails(self) -> str:
        sections = []
        claude_md = ROOT / "CLAUDE.md"
        if claude_md.exists():
            sections.append(f"## 프로젝트 규칙 (CLAUDE.md)\n\n{claude_md.read_text()}")
        docs_dir = ROOT / "docs"
        if docs_dir.is_dir():
            for doc in sorted(docs_dir.glob("*.md")):
                sections.append(f"## {doc.stem}\n\n{doc.read_text()}")
        return "\n\n---\n\n".join(sections) if sections else ""

    @staticmethod
    def _build_step_context(index: dict) -> str:
        lines = [
            f"- Step {s['step']} ({s['name']}): {s['summary']}"
            for s in index["steps"]
            if s["status"] == "completed" and s.get("summary")
        ]
        if not lines:
            return ""
        return "## 이전 Step 산출물\n\n" + "\n".join(lines) + "\n\n"

    def _build_preamble(self, guardrails: str, step_context: str,
                        prev_error: Optional[str] = None) -> str:
        commit_example = self.FEAT_MSG.format(
            phase=self._phase_name, num="N", name="<step-name>"
        )
        retry_section = ""
        if prev_error:
            retry_section = (
                f"\n## ⚠ 이전 시도 실패 — 아래 에러를 반드시 참고하여 수정하라\n\n"
                f"{prev_error}\n\n---\n\n"
            )
        return (
            f"당신은 {self._project} 프로젝트의 개발자입니다. 아래 step을 수행하세요.\n\n"
            f"{guardrails}\n\n---\n\n"
            f"{step_context}{retry_section}"
            f"## 작업 규칙\n\n"
            f"1. 이전 step에서 작성된 코드를 확인하고 일관성을 유지하라.\n"
            f"2. 이 step에 명시된 작업만 수행하라. 추가 기능이나 파일을 만들지 마라.\n"
            f"3. 기존 테스트를 깨뜨리지 마라.\n"
            f"4. AC(Acceptance Criteria) 검증을 직접 실행하라.\n"
            f"5. /phases/{self._phase_dir_name}/index.json의 해당 step status를 업데이트하라:\n"
            f"   - AC 통과 → \"completed\" + \"summary\" 필드에 이 step의 산출물을 한 줄로 요약\n"
            f"   - {self.MAX_RETRIES}회 수정 시도 후에도 실패 → \"error\" + \"error_message\" 기록\n"
            f"   - 사용자 개입이 필요한 경우 (API 키, 인증, 수동 설정 등) → \"blocked\" + \"blocked_reason\" 기록 후 즉시 중단\n"
            f"6. 모든 변경사항을 커밋하라:\n"
            f"   {commit_example}\n\n---\n\n"
        )

    # --- Claude 호출 ---

    def _invoke_claude(self, step: dict, preamble: str) -> dict:
        step_num, step_name = step["step"], step["name"]
        step_file = self._phase_dir / f"step{step_num}.md"

        if not step_file.exists():
            print(f"  ERROR: {step_file} not found")
            sys.exit(1)

        prompt = preamble + step_file.read_text()
        cmd = ["claude", "--model", self._model, "-p", "--dangerously-skip-permissions", "--output-format", "json", prompt]

        if self._verbose:
            stdout_buf = []
            stderr_buf = []

            proc = subprocess.Popen(
                cmd, cwd=self._root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )

            def _read_stream(stream, buf, out):
                for line in stream:
                    buf.append(line)
                    out.write(line)
                    out.flush()

            t_out = threading.Thread(target=_read_stream, args=(proc.stdout, stdout_buf, sys.stdout), daemon=True)
            t_err = threading.Thread(target=_read_stream, args=(proc.stderr, stderr_buf, sys.stderr), daemon=True)
            t_out.start()
            t_err.start()

            try:
                proc.wait(timeout=self._timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

            t_out.join()
            t_err.join()

            returncode = proc.returncode
            stdout_str = "".join(stdout_buf)
            stderr_str = "".join(stderr_buf)
        else:
            result = subprocess.run(
                cmd, cwd=self._root, capture_output=True, text=True, timeout=self._timeout,
            )
            returncode = result.returncode
            stdout_str = result.stdout
            stderr_str = result.stderr

        if returncode != 0:
            print(f"\n  WARN: Claude가 비정상 종료됨 (code {returncode})")
            if stderr_str:
                print(f"  stderr: {stderr_str[:500]}")

        output = {
            "step": step_num, "name": step_name,
            "exitCode": returncode,
            "stdout": stdout_str, "stderr": stderr_str,
        }
        out_path = self._phase_dir / f"step{step_num}-output.json"
        with open(out_path, "w") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return output

    # --- 헤더 & 검증 ---

    def _print_header(self):
        print(f"\n{'='*60}")
        print(f"  Harness Step Executor")
        print(f"  Phase: {self._phase_name} | Steps: {self._total}")
        if self._auto_push:
            print(f"  Auto-push: enabled")
        print(f"{'='*60}")

    def _check_blockers(self):
        index = self._read_json(self._index_file)
        for s in reversed(index["steps"]):
            if s["status"] == "error":
                print(f"\n  ✗ Step {s['step']} ({s['name']}) failed.")
                print(f"  Error: {s.get('error_message', 'unknown')}")
                print(f"  Fix and reset status to 'pending' to retry.")
                sys.exit(1)
            if s["status"] == "blocked":
                print(f"\n  ⏸ Step {s['step']} ({s['name']}) blocked.")
                print(f"  Reason: {s.get('blocked_reason', 'unknown')}")
                print(f"  Resolve and reset status to 'pending' to retry.")
                sys.exit(2)
            if s["status"] != "pending":
                break

    def _preflight_check(self):
        """실행 전 검증: step 파일 존재, step 번호 연속성, --from-step 범위, pending 경고."""
        index = self._read_json(self._index_file)
        steps = sorted(index["steps"], key=lambda s: s["step"])

        # 검증 1: step 파일 존재 여부
        for s in steps:
            step_num = s["step"]
            step_file = self._phase_dir / f"step{step_num}.md"
            if not step_file.exists():
                print(f"ERROR: Missing step file: phases/{self._phase_dir_name}/step{step_num}.md")
                sys.exit(1)

        # 검증 2: step 번호 연속성 (0부터 시작, gap 없음)
        for i, s in enumerate(steps):
            if s["step"] != i:
                print(f"ERROR: Step numbers must be consecutive starting from 0. Found gap at step {i}.")
                sys.exit(1)

        # 검증 3: --from-step 범위
        total = len(steps)
        if self._from_step < 0 or self._from_step >= total:
            print(f"ERROR: --from-step {self._from_step} is out of range. Phase has {total} steps (0-{total - 1}).")
            sys.exit(1)

        # 검증 4: --from-step 이전 step 상태 경고 (실행 중단 아님)
        if self._from_step > 0:
            for s in steps:
                if s["step"] < self._from_step and s.get("status") == "pending":
                    print(f"  WARN: Skipping step {s['step']} ({s['name']}) which is still 'pending'.")

    def _ensure_created_at(self):
        index = self._read_json(self._index_file)
        if "created_at" not in index:
            index["created_at"] = self._stamp()
            self._write_json(self._index_file, index)

    # --- 실행 루프 ---

    def _execute_single_step(self, step: dict, guardrails: str) -> bool:
        """단일 step 실행 (재시도 포함). 완료되면 True, 실패/차단이면 False."""
        step_num, step_name = step["step"], step["name"]
        done = sum(1 for s in self._read_json(self._index_file)["steps"] if s["status"] == "completed")
        prev_error = None

        for attempt in range(1, self.MAX_RETRIES + 1):
            index = self._read_json(self._index_file)
            step_context = self._build_step_context(index)
            preamble = self._build_preamble(guardrails, step_context, prev_error)

            tag = f"Step {step_num}/{self._total - 1} ({done} done): {step_name}"
            if attempt > 1:
                tag += f" [retry {attempt}/{self.MAX_RETRIES}]"

            with progress_indicator(tag) as pi:
                self._invoke_claude(step, preamble)
                elapsed = int(pi.elapsed)

            index = self._read_json(self._index_file)
            status = next((s.get("status", "pending") for s in index["steps"] if s["step"] == step_num), "pending")
            ts = self._stamp()

            if status == "completed":
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["completed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✓ Step {step_num}: {step_name} [{elapsed}s]")
                return True

            if status == "blocked":
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["blocked_at"] = ts
                self._write_json(self._index_file, index)
                reason = next((s.get("blocked_reason", "") for s in index["steps"] if s["step"] == step_num), "")
                print(f"  ⏸ Step {step_num}: {step_name} blocked [{elapsed}s]")
                print(f"    Reason: {reason}")
                self._update_top_index("blocked")
                sys.exit(2)

            err_msg = next(
                (s.get("error_message", "Step did not update status") for s in index["steps"] if s["step"] == step_num),
                "Step did not update status",
            )

            if attempt < self.MAX_RETRIES:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "pending"
                        s.pop("error_message", None)
                self._write_json(self._index_file, index)
                prev_error = err_msg
                print(f"  ↻ Step {step_num}: retry {attempt}/{self.MAX_RETRIES} — {err_msg}")
            else:
                for s in index["steps"]:
                    if s["step"] == step_num:
                        s["status"] = "error"
                        s["error_message"] = f"[{self.MAX_RETRIES}회 시도 후 실패] {err_msg}"
                        s["failed_at"] = ts
                self._write_json(self._index_file, index)
                self._commit_step(step_num, step_name)
                print(f"  ✗ Step {step_num}: {step_name} failed after {self.MAX_RETRIES} attempts [{elapsed}s]")
                print(f"    Error: {err_msg}")
                self._update_top_index("error")
                sys.exit(1)

        return False  # unreachable

    def _execute_all_steps(self, guardrails: str):
        if self._from_step > 0:
            print(f"  WARN: --from-step {self._from_step} 지정됨. Step {self._from_step} 이전은 건너뜁니다.")

        while True:
            index = self._read_json(self._index_file)
            pending = next(
                (s for s in index["steps"]
                 if s["status"] == "pending" and s["step"] >= self._from_step),
                None,
            )
            if pending is None:
                print("\n  All steps completed!")
                return

            step_num = pending["step"]
            for s in index["steps"]:
                if s["step"] == step_num and "started_at" not in s:
                    s["started_at"] = self._stamp()
                    self._write_json(self._index_file, index)
                    break

            self._execute_single_step(pending, guardrails)

    def _print_phase_summary(self, index: dict):
        """완료된 step들의 요약을 출력한다."""
        W = 60
        phase_name = index.get("phase", self._phase_name)
        steps = index.get("steps", [])

        completed_steps = [s for s in steps if s.get("status") == "completed"]

        print(f"\n{'='*W}")
        print(f"  Phase '{phase_name}' Summary")
        print(f"{'='*W}")
        print(f"  {'Step':<6} {'Name':<22} {'Elapsed':<9} {'Summary'}")
        print(f"  {'─'*56}")

        for s in completed_steps:
            num = str(s.get("step", "-"))
            name = str(s.get("name", "-"))
            started_at = s.get("started_at")
            completed_at = s.get("completed_at")
            elapsed = _elapsed_str(started_at, completed_at)
            summary = s.get("summary", "(no summary)")
            print(f"  {num:<6} {name:<22} {elapsed:<9} {summary}")

        print(f"  {'─'*56}")

        # 전체 소요시간: created_at ~ 현재
        created_at = index.get("created_at")
        now_ts = self._stamp()
        total_str = "-"
        try:
            s_dt = _parse_iso(created_at)
            e_dt = _parse_iso(now_ts)
            if s_dt and e_dt:
                total_sec = int((e_dt - s_dt).total_seconds())
                minutes = total_sec // 60
                seconds = total_sec % 60
                total_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"
        except Exception:
            pass

        n = len(completed_steps)
        print(f"  Total: {n} steps | {total_str}")
        print(f"{'='*W}")

    def _finalize(self):
        index = self._read_json(self._index_file)
        index["completed_at"] = self._stamp()
        self._write_json(self._index_file, index)
        self._update_top_index("completed")

        self._run_git("add", "-A")
        if self._run_git("diff", "--cached", "--quiet").returncode != 0:
            msg = f"chore({self._phase_name}): mark phase completed"
            r = self._run_git("commit", "-m", msg)
            if r.returncode == 0:
                print(f"  ✓ {msg}")

        self._print_phase_summary(index)

        if self._auto_push:
            branch = f"feat-{self._phase_name}"
            r = self._run_git("push", "-u", "origin", branch)
            if r.returncode != 0:
                print(f"\n  ERROR: git push 실패: {r.stderr.strip()}")
                sys.exit(1)
            print(f"  ✓ Pushed to origin/{branch}")

        print(f"\n{'='*60}")
        print(f"  Phase '{self._phase_name}' completed!")
        print(f"{'='*60}")


def cmd_run(args):
    StepExecutor(
        args.phase_dir,
        auto_push=args.push,
        from_step=args.from_step,
        model=args.model,
        timeout=args.timeout,
        verbose=args.verbose,
    ).run()


# ---------------------------------------------------------------------------
# status helpers
# ---------------------------------------------------------------------------

def _parse_iso(ts: str) -> Optional[datetime]:
    """ISO 타임스탬프 파싱. 실패 시 None 반환.

    Python 3.9의 fromisoformat은 '+0900'(콜론 없는 offset)을 지원하지 않으므로
    '+09:00' 형태로 정규화 후 재시도한다.
    """
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        pass
    try:
        # +0900 → +09:00 정규화
        if len(ts) >= 5 and ts[-5] in ('+', '-') and ':' not in ts[-5:]:
            ts = ts[:-2] + ':' + ts[-2:]
            return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        pass
    return None


def _elapsed_str(started_at: Optional[str], ended_at: Optional[str]) -> str:
    """두 타임스탬프의 차이를 '42s' 형태로 반환. 계산 불가 시 '-'."""
    s = _parse_iso(started_at)
    e = _parse_iso(ended_at)
    if s and e:
        return f"{int((e - s).total_seconds())}s"
    return "-"


def _phase_status_from_steps(steps: list) -> str:
    """steps 목록에서 phase의 종합 status를 결정한다."""
    statuses = [s.get("status", "pending") for s in steps]
    if any(st == "error" for st in statuses):
        return "error"
    if any(st == "blocked" for st in statuses):
        return "blocked"
    if statuses and all(st == "completed" for st in statuses):
        return "completed"
    return "pending"


def _status_all(phases_dir: Path, phases: list):
    W = 60
    print("=" * W)
    print("  Harness Status")
    print("=" * W)
    print(f"  {'Phase':<20} {'Status':<12} {'Steps'}")
    print(f"  {'─' * 55}")

    for entry in phases:
        dir_name = entry.get("dir", "")
        phase_index = phases_dir / dir_name / "index.json"

        if not phase_index.exists():
            print(f"  {dir_name:<20} {'unknown':<12} -")
            continue

        idx = json.loads(phase_index.read_text(encoding="utf-8"))
        steps = idx.get("steps", [])
        total = len(steps)
        completed = sum(1 for s in steps if s.get("status") == "completed")
        status = entry.get("status") or _phase_status_from_steps(steps)
        steps_str = f"{completed}/{total}"

        extra = ""
        if status == "error":
            err_step = next((s for s in steps if s.get("status") == "error"), None)
            if err_step:
                msg = err_step.get("error_message", "")[:50]
                extra = f"  ← Step {err_step['step']}: \"{msg}\""
        elif status == "blocked":
            blk_step = next((s for s in steps if s.get("status") == "blocked"), None)
            if blk_step:
                reason = blk_step.get("blocked_reason", "")[:50]
                extra = f"  ← Step {blk_step['step']}: \"{reason}\""

        print(f"  {dir_name:<20} {status:<12} {steps_str}{extra}")

    print("=" * W)


def _status_phase_detail(phases_dir: Path, phase_dir_name: str):
    phase_index = phases_dir / phase_dir_name / "index.json"

    if not phase_index.exists():
        print(f"ERROR: {phase_index} not found")
        sys.exit(1)

    idx = json.loads(phase_index.read_text(encoding="utf-8"))
    steps = idx.get("steps", [])
    project = idx.get("project", "-")
    status = _phase_status_from_steps(steps)

    W = 66
    print("=" * W)
    print(f"  Phase: {phase_dir_name}  [{status}]")
    print(f"  Project: {project}")
    print("=" * W)
    print(f"  {'Step':<6} {'Name':<18} {'Status':<12} {'Started':<10} {'Elapsed':<9} {'Summary'}")
    print(f"  {'─' * 64}")

    for s in steps:
        num = str(s.get("step", "-"))
        name = str(s.get("name", "-"))[:17]
        st = s.get("status", "pending")

        started_at = s.get("started_at")
        started_str = "-"
        if started_at:
            dt = _parse_iso(started_at)
            if dt:
                started_str = dt.strftime("%H:%M:%S")

        ended_at = s.get("completed_at") or s.get("failed_at")
        elapsed = _elapsed_str(started_at, ended_at) if ended_at else "-"

        summary = s.get("summary") or s.get("error_message") or "-"
        if len(summary) > 40:
            summary = summary[:40] + "..."

        print(f"  {num:<6} {name:<18} {st:<12} {started_str:<10} {elapsed:<9} {summary}")

    print("=" * W)


def cmd_status(args):
    phases_dir = ROOT / "phases"
    top_index = phases_dir / "index.json"

    if not top_index.exists():
        print("No phases found.")
        return

    top = json.loads(top_index.read_text(encoding="utf-8"))
    phases = top.get("phases", [])

    if args.phase_dir:
        _status_phase_detail(phases_dir, args.phase_dir)
    else:
        _status_all(phases_dir, phases)


def cmd_reset(args):
    # args.phase_dir: str
    # args.step: Optional[int]
    # args.all: bool

    phases_dir = ROOT / "phases"
    phase_path = phases_dir / args.phase_dir

    if not phase_path.is_dir():
        print(f"ERROR: phases/{args.phase_dir} not found")
        sys.exit(1)

    phase_index = phase_path / "index.json"
    if not phase_index.exists():
        print(f"ERROR: phases/{args.phase_dir} not found")
        sys.exit(1)

    idx = json.loads(phase_index.read_text(encoding="utf-8"))
    steps = idx["steps"]

    _REMOVE_FIELDS = ["error_message", "blocked_reason", "failed_at", "blocked_at"]

    def _reset_step(s):
        old = s["status"]
        s["status"] = "pending"
        for f in _REMOVE_FIELDS:
            s.pop(f, None)
        return old

    reset_count = 0

    if args.step is not None:
        target = next((s for s in steps if s["step"] == args.step), None)
        if target is None:
            print(f"WARN: Step {args.step} not found.")
            sys.exit(0)
        status = target.get("status", "pending")
        if status not in ("error", "blocked"):
            print(f"WARN: Step {args.step} is '{status}', not error/blocked. Skipping.")
            sys.exit(0)
        old = _reset_step(target)
        print(f"  ✓ Step {args.step} ({target['name']}): {old} → pending")
        reset_count = 1
    elif args.all:
        for s in steps:
            if s.get("status") in ("error", "blocked"):
                old = _reset_step(s)
                print(f"  ✓ Step {s['step']} ({s['name']}): {old} → pending")
                reset_count += 1
        if reset_count == 0:
            print(f"No error or blocked steps found in {args.phase_dir}.")
            sys.exit(0)
    else:
        target = next((s for s in steps if s.get("status") in ("error", "blocked")), None)
        if target is None:
            print(f"No error or blocked steps found in {args.phase_dir}.")
            sys.exit(0)
        old = _reset_step(target)
        print(f"  ✓ Step {target['step']} ({target['name']}): {old} → pending")
        reset_count = 1

    phase_index.write_text(json.dumps(idx, indent=2, ensure_ascii=False), encoding="utf-8")
    print()
    print(f"  Reset {reset_count} step(s). Run: python3 scripts/execute.py run {args.phase_dir}")


def _make_step_template(n: int, phase_name: str) -> str:
    """step{n}.md 파일에 들어갈 마크다운 템플릿을 반환한다."""
    return (
        f"# Step {n}: step-{n}\n"
        "\n"
        "## 읽어야 할 파일\n"
        "\n"
        "먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:\n"
        "\n"
        "- `/docs/ARCHITECTURE.md`\n"
        "- `/docs/ADR.md`\n"
        "- (이전 step에서 생성/수정된 파일 경로를 여기에 추가하라)\n"
        "\n"
        "## 작업\n"
        "\n"
        "TODO: 이 step에서 수행할 작업을 구체적으로 작성하라.\n"
        "- 파일 경로, 함수/클래스 시그니처, 핵심 로직을 포함할 것\n"
        "- 인터페이스만 제시하고 구현은 에이전트에게 맡길 것\n"
        "- 설계 의도에서 벗어나면 안 되는 핵심 규칙은 명시할 것\n"
        "\n"
        "## Acceptance Criteria\n"
        "\n"
        "```bash\n"
        "# TODO: 실제 실행 가능한 검증 커맨드를 작성하라\n"
        "npm run build && npm test\n"
        "```\n"
        "\n"
        "## 검증 절차\n"
        "\n"
        "1. 위 AC 커맨드를 실행한다.\n"
        "2. 아키텍처 체크리스트를 확인한다:\n"
        "   - ARCHITECTURE.md 디렉토리 구조를 따르는가?\n"
        "   - ADR 기술 스택을 벗어나지 않았는가?\n"
        "   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?\n"
        f"3. 결과에 따라 `phases/{phase_name}/index.json`의 해당 step을 업데이트한다:\n"
        '   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`\n'
        '   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`\n'
        '   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단\n'
        "\n"
        "## 금지사항\n"
        "\n"
        '- TODO: 이 step에서 하지 말아야 할 것을 "X를 하지 마라. 이유: Y" 형식으로 작성하라.\n'
        "- 기존 테스트를 깨뜨리지 마라.\n"
    )


def cmd_init(args):
    phases_dir = ROOT / "phases"
    phase_name = args.phase_name
    phase_dir = phases_dir / phase_name
    n_steps = args.steps
    project = args.project if args.project else ROOT.name

    if n_steps < 1:
        print("ERROR: --steps must be at least 1.")
        sys.exit(1)

    if phase_dir.exists():
        print(f"ERROR: phases/{phase_name} already exists.")
        sys.exit(1)

    # phases/ 디렉토리가 없으면 생성
    phases_dir.mkdir(parents=True, exist_ok=True)

    # phase 디렉토리 생성
    phase_dir.mkdir()
    print(f"  ✓ Created phases/{phase_name}/")

    # index.json 생성
    index = {
        "project": project,
        "phase": phase_name,
        "steps": [
            {"step": i, "name": f"step-{i}", "status": "pending"}
            for i in range(n_steps)
        ],
    }
    (phase_dir / "index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  ✓ Created phases/{phase_name}/index.json ({n_steps} steps)")

    # step*.md 파일 생성
    for i in range(n_steps):
        (phase_dir / f"step{i}.md").write_text(
            _make_step_template(i, phase_name), encoding="utf-8"
        )
        print(f"  ✓ Created phases/{phase_name}/step{i}.md")

    # phases/index.json 업데이트 (없으면 신규 생성)
    top_index_file = phases_dir / "index.json"
    if top_index_file.exists():
        top = json.loads(top_index_file.read_text(encoding="utf-8"))
    else:
        top = {"phases": []}
    top["phases"].append({"dir": phase_name, "status": "pending"})
    top_index_file.write_text(
        json.dumps(top, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  ✓ Updated phases/index.json")

    print()
    print(f"  Next steps:")
    print(f"    1. Edit step files: phases/{phase_name}/step*.md")
    print(f"    2. Run: python3 scripts/execute.py run {phase_name}")


def main():
    parser = argparse.ArgumentParser(description="Harness Step Executor")
    sub = parser.add_subparsers(dest="command", metavar="subcommand")
    sub.required = True

    # run
    p_run = sub.add_parser("run", help="Phase 내 step 순차 실행")
    p_run.add_argument("phase_dir")
    p_run.add_argument("--push", action="store_true")
    p_run.add_argument("--from-step", type=int, default=0, metavar="N",
                       help="N번 step부터 시작 (기본: 0)")
    p_run.add_argument("--model", default="claude-opus-4-5",
                       help="Claude 모델 (기본: claude-opus-4-5)")
    p_run.add_argument("--timeout", type=int, default=1800,
                       help="Claude 호출 타임아웃(초) (기본: 1800)")
    p_run.add_argument("--verbose", action="store_true",
                       help="Claude 출력을 실시간으로 터미널에 표시")
    p_run.set_defaults(func=cmd_run)

    # status (stub)
    p_status = sub.add_parser("status", help="Phase 현황 조회")
    p_status.add_argument("phase_dir", nargs="?", help="특정 phase (생략 시 전체)")
    p_status.set_defaults(func=cmd_status)

    # reset (stub)
    p_reset = sub.add_parser("reset", help="Error/Blocked step을 pending으로 리셋")
    p_reset.add_argument("phase_dir")
    p_reset.add_argument("--step", type=int, metavar="N", help="특정 step 번호만 리셋")
    p_reset.add_argument("--all", action="store_true", help="모든 error/blocked step 리셋")
    p_reset.set_defaults(func=cmd_reset)

    # init (stub)
    p_init = sub.add_parser("init", help="새 phase 초기화")
    p_init.add_argument("phase_name")
    p_init.add_argument("--steps", type=int, required=True, help="생성할 step 수")
    p_init.add_argument("--project", default=None, help="project 이름")
    p_init.set_defaults(func=cmd_init)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
