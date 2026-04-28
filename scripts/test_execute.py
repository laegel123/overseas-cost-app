"""
execute.py 리팩터링 안전망 테스트.
리팩터링 전후 동작이 동일한지 검증한다.
"""

import json
import os
import subprocess
import sys
import textwrap
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import execute as ex


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_project(tmp_path):
    """phases/, CLAUDE.md, docs/ 를 갖춘 임시 프로젝트 구조."""
    phases_dir = tmp_path / "phases"
    phases_dir.mkdir()

    claude_md = tmp_path / "CLAUDE.md"
    claude_md.write_text("# Rules\n- rule one\n- rule two")

    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "arch.md").write_text("# Architecture\nSome content")
    (docs_dir / "guide.md").write_text("# Guide\nAnother doc")

    return tmp_path


@pytest.fixture
def phase_dir(tmp_project):
    """step 3개를 가진 phase 디렉토리."""
    d = tmp_project / "phases" / "0-mvp"
    d.mkdir()

    index = {
        "project": "TestProject",
        "phase": "mvp",
        "steps": [
            {"step": 0, "name": "setup", "status": "completed", "summary": "프로젝트 초기화 완료"},
            {"step": 1, "name": "core", "status": "completed", "summary": "핵심 로직 구현"},
            {"step": 2, "name": "ui", "status": "pending"},
        ],
    }
    (d / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))
    (d / "step2.md").write_text("# Step 2: UI\n\nUI를 구현하세요.")

    return d


@pytest.fixture
def top_index(tmp_project):
    """phases/index.json (top-level)."""
    top = {
        "phases": [
            {"dir": "0-mvp", "status": "pending"},
            {"dir": "1-polish", "status": "pending"},
        ]
    }
    p = tmp_project / "phases" / "index.json"
    p.write_text(json.dumps(top, indent=2))
    return p


@pytest.fixture
def executor(tmp_project, phase_dir):
    """테스트용 StepExecutor 인스턴스. git 호출은 별도 mock 필요."""
    with patch.object(ex, "ROOT", tmp_project):
        inst = ex.StepExecutor("0-mvp")
    # 내부 경로를 tmp_project 기준으로 재설정
    inst._root = str(tmp_project)
    inst._phases_dir = tmp_project / "phases"
    inst._phase_dir = phase_dir
    inst._phase_dir_name = "0-mvp"
    inst._index_file = phase_dir / "index.json"
    inst._top_index_file = tmp_project / "phases" / "index.json"
    return inst


# ---------------------------------------------------------------------------
# _stamp (= 이전 now_iso)
# ---------------------------------------------------------------------------

class TestStamp:
    def test_returns_kst_timestamp(self, executor):
        result = executor._stamp()
        assert "+0900" in result

    def test_format_is_iso(self, executor):
        result = executor._stamp()
        dt = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert dt.tzinfo is not None

    def test_is_current_time(self, executor):
        before = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0)
        result = executor._stamp()
        after = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0) + timedelta(seconds=1)
        parsed = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert before <= parsed <= after


# ---------------------------------------------------------------------------
# _read_json / _write_json
# ---------------------------------------------------------------------------

class TestJsonHelpers:
    def test_roundtrip(self, tmp_path):
        data = {"key": "값", "nested": [1, 2, 3]}
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, data)
        loaded = ex.StepExecutor._read_json(p)
        assert loaded == data

    def test_save_ensures_ascii_false(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"한글": "테스트"})
        raw = p.read_text()
        assert "한글" in raw
        assert "\\u" not in raw

    def test_save_indented(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"a": 1})
        raw = p.read_text()
        assert "\n" in raw

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            ex.StepExecutor._read_json(tmp_path / "nope.json")


# ---------------------------------------------------------------------------
# _load_guardrails
# ---------------------------------------------------------------------------

class TestLoadGuardrails:
    def test_loads_claude_md_and_docs(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "# Rules" in result
        assert "rule one" in result
        assert "# Architecture" in result
        assert "# Guide" in result

    def test_sections_separated_by_divider(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "---" in result

    def test_docs_sorted_alphabetically(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        arch_pos = result.index("arch")
        guide_pos = result.index("guide")
        assert arch_pos < guide_pos

    def test_no_claude_md(self, executor, tmp_project):
        (tmp_project / "CLAUDE.md").unlink()
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "CLAUDE.md" not in result
        assert "Architecture" in result

    def test_no_docs_dir(self, executor, tmp_project):
        import shutil
        shutil.rmtree(tmp_project / "docs")
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "Rules" in result
        assert "Architecture" not in result

    def test_empty_project(self, tmp_path):
        with patch.object(ex, "ROOT", tmp_path):
            # executor가 필요 없는 static-like 동작이므로 임시 인스턴스
            phases_dir = tmp_path / "phases" / "dummy"
            phases_dir.mkdir(parents=True)
            idx = {"project": "T", "phase": "t", "steps": []}
            (phases_dir / "index.json").write_text(json.dumps(idx))
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
            result = inst._load_guardrails()
        assert result == ""


# ---------------------------------------------------------------------------
# _build_step_context
# ---------------------------------------------------------------------------

class TestBuildStepContext:
    def test_includes_completed_with_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert "Step 0 (setup): 프로젝트 초기화 완료" in result
        assert "Step 1 (core): 핵심 로직 구현" in result

    def test_excludes_pending(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert "ui" not in result

    def test_excludes_completed_without_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        del index["steps"][0]["summary"]
        result = ex.StepExecutor._build_step_context(index)
        assert "setup" not in result
        assert "core" in result

    def test_empty_when_no_completed(self):
        index = {"steps": [{"step": 0, "name": "a", "status": "pending"}]}
        result = ex.StepExecutor._build_step_context(index)
        assert result == ""

    def test_has_header(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text())
        result = ex.StepExecutor._build_step_context(index)
        assert result.startswith("## 이전 Step 산출물")


# ---------------------------------------------------------------------------
# _build_preamble
# ---------------------------------------------------------------------------

class TestBuildPreamble:
    def test_includes_project_name(self, executor):
        result = executor._build_preamble("", "")
        assert "TestProject" in result

    def test_includes_guardrails(self, executor):
        result = executor._build_preamble("GUARD_CONTENT", "")
        assert "GUARD_CONTENT" in result

    def test_includes_step_context(self, executor):
        ctx = "## 이전 Step 산출물\n\n- Step 0: done"
        result = executor._build_preamble("", ctx)
        assert "이전 Step 산출물" in result

    def test_includes_commit_example(self, executor):
        result = executor._build_preamble("", "")
        assert "feat(mvp):" in result

    def test_includes_rules(self, executor):
        result = executor._build_preamble("", "")
        assert "작업 규칙" in result
        assert "AC" in result

    def test_no_retry_section_by_default(self, executor):
        result = executor._build_preamble("", "")
        assert "이전 시도 실패" not in result

    def test_retry_section_with_prev_error(self, executor):
        result = executor._build_preamble("", "", prev_error="타입 에러 발생")
        assert "이전 시도 실패" in result
        assert "타입 에러 발생" in result

    def test_includes_max_retries(self, executor):
        result = executor._build_preamble("", "")
        assert str(ex.StepExecutor.MAX_RETRIES) in result

    def test_includes_index_path(self, executor):
        result = executor._build_preamble("", "")
        assert "/phases/0-mvp/index.json" in result


# ---------------------------------------------------------------------------
# _update_top_index
# ---------------------------------------------------------------------------

class TestUpdateTopIndex:
    def test_completed(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "completed"
        assert "completed_at" in mvp

    def test_error(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("error")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "error"
        assert "failed_at" in mvp

    def test_blocked(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("blocked")
        data = json.loads(top_index.read_text())
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "blocked"
        assert "blocked_at" in mvp

    def test_other_phases_unchanged(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text())
        polish = next(p for p in data["phases"] if p["dir"] == "1-polish")
        assert polish["status"] == "pending"

    def test_nonexistent_dir_is_noop(self, executor, top_index):
        executor._top_index_file = top_index
        executor._phase_dir_name = "no-such-dir"
        original = json.loads(top_index.read_text())
        executor._update_top_index("completed")
        after = json.loads(top_index.read_text())
        for p_before, p_after in zip(original["phases"], after["phases"]):
            assert p_before["status"] == p_after["status"]

    def test_no_top_index_file(self, executor, tmp_path):
        executor._top_index_file = tmp_path / "nonexistent.json"
        executor._update_top_index("completed")  # should not raise


# ---------------------------------------------------------------------------
# _checkout_branch (mocked)
# ---------------------------------------------------------------------------

class TestCheckoutBranch:
    def _mock_git(self, executor, responses):
        call_idx = {"i": 0}
        def fake_git(*args):
            idx = call_idx["i"]
            call_idx["i"] += 1
            if idx < len(responses):
                return responses[idx]
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

    def test_already_on_branch(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="feat-mvp\n", stderr=""),
        ])
        executor._checkout_branch()  # should return without checkout

    def test_branch_exists_checkout(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_branch_not_exists_create(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="not found"),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_checkout_fails_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="dirty tree"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1

    def test_no_git_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=1, stdout="", stderr="not a git repo"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _commit_step (mocked)
# ---------------------------------------------------------------------------

class TestCommitStep:
    def test_two_phase_commit(self, executor):
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_calls = [c for c in calls if c[0] == "commit"]
        assert len(commit_calls) == 2
        assert "feat(mvp):" in commit_calls[0][2]
        assert "chore(mvp):" in commit_calls[1][2]

    def test_no_code_changes_skips_feat_commit(self, executor):
        call_count = {"diff": 0}
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                call_count["diff"] += 1
                if call_count["diff"] == 1:
                    return MagicMock(returncode=0)
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_msgs = [c[2] for c in calls if c[0] == "commit"]
        assert len(commit_msgs) == 1
        assert "chore" in commit_msgs[0]


# ---------------------------------------------------------------------------
# _invoke_claude (mocked)
# ---------------------------------------------------------------------------

class TestInvokeClaude:
    def test_invokes_claude_with_correct_args(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"result": "ok"}', stderr="")
        step = {"step": 2, "name": "ui"}
        preamble = "PREAMBLE\n"

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            output = executor._invoke_claude(step, preamble)

        cmd = mock_run.call_args[0][0]
        assert cmd[0] == "claude"
        assert "-p" in cmd
        assert "--dangerously-skip-permissions" in cmd
        assert "--output-format" in cmd
        assert "--model" in cmd
        assert cmd[cmd.index("--model") + 1] == executor._model
        assert "PREAMBLE" in cmd[-1]
        assert "UI를 구현하세요" in cmd[-1]

    def test_saves_output_json(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"ok": true}', stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result):
            executor._invoke_claude(step, "preamble")

        output_file = executor._phase_dir / "step2-output.json"
        assert output_file.exists()
        data = json.loads(output_file.read_text())
        assert data["step"] == 2
        assert data["name"] == "ui"
        assert data["exitCode"] == 0

    def test_nonexistent_step_file_exits(self, executor):
        step = {"step": 99, "name": "nonexistent"}
        with pytest.raises(SystemExit) as exc_info:
            executor._invoke_claude(step, "preamble")
        assert exc_info.value.code == 1

    def test_timeout_is_1800(self, executor):
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_claude(step, "preamble")

        assert mock_run.call_args[1]["timeout"] == 1800

    def test_uses_self_timeout(self, executor):
        """timeout은 하드코딩이 아닌 self._timeout 값을 사용해야 한다."""
        executor._timeout = 3600
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_claude(step, "preamble")

        assert mock_run.call_args[1]["timeout"] == 3600

    def test_verbose_uses_popen(self, executor):
        """verbose=True 이면 subprocess.Popen을 사용하고 subprocess.run은 호출하지 않는다."""
        executor._verbose = True
        step = {"step": 2, "name": "ui"}

        mock_proc = MagicMock()
        mock_proc.stdout = iter([])
        mock_proc.stderr = iter([])
        mock_proc.returncode = 0
        mock_proc.wait.return_value = None

        with patch("subprocess.Popen", return_value=mock_proc) as mock_popen:
            with patch("subprocess.run") as mock_run:
                executor._invoke_claude(step, "preamble")

        assert mock_popen.called
        assert not mock_run.called


# ---------------------------------------------------------------------------
# progress_indicator (= 이전 Spinner)
# ---------------------------------------------------------------------------

class TestProgressIndicator:
    def test_context_manager(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.15)
        assert pi.elapsed >= 0.1

    def test_elapsed_increases(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.2)
        assert pi.elapsed > 0


# ---------------------------------------------------------------------------
# main() CLI 파싱 (mocked)
# ---------------------------------------------------------------------------

class TestMainCli:
    def test_no_args_exits(self):
        with patch("sys.argv", ["execute.py"]):
            with pytest.raises(SystemExit) as exc_info:
                ex.main()
            assert exc_info.value.code == 2  # argparse exits with 2

    def test_no_subcommand_exits(self):
        """subcommand 없이 실행 시 에러(2)로 종료."""
        with patch("sys.argv", ["execute.py"]):
            with pytest.raises(SystemExit) as exc_info:
                ex.main()
            assert exc_info.value.code == 2

    def test_help_includes_subcommands(self):
        """--help 출력에 subcommand 이름들이 포함되어야 한다."""
        import io
        captured = io.StringIO()
        with patch("sys.argv", ["execute.py", "--help"]):
            with patch("sys.stdout", captured):
                with pytest.raises(SystemExit):
                    ex.main()
        output = captured.getvalue()
        assert "run" in output
        assert "status" in output

    def test_invalid_phase_dir_exits(self):
        with patch("sys.argv", ["execute.py", "run", "nonexistent"]):
            with patch.object(ex, "ROOT", Path("/tmp/fake_nonexistent")):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1

    def test_missing_index_exits(self, tmp_project):
        (tmp_project / "phases" / "empty").mkdir()
        with patch("sys.argv", ["execute.py", "run", "empty"]):
            with patch.object(ex, "ROOT", tmp_project):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# TestRunCmd — run subcommand 파싱 및 StepExecutor 파라미터 전달 검증
# ---------------------------------------------------------------------------

class TestRunCmd:
    """run subcommand 파싱 및 StepExecutor 파라미터 전달 검증."""

    def _capture_run_args(self, cli_args):
        """main()을 실행하고 cmd_run에 전달된 args Namespace를 반환."""
        captured = {}

        def fake_cmd_run(args):
            captured["args"] = args

        with patch("sys.argv", ["execute.py", "run"] + cli_args):
            with patch.object(ex, "cmd_run", fake_cmd_run):
                ex.main()

        return captured["args"]

    def test_defaults(self):
        args = self._capture_run_args(["my-phase"])
        assert args.phase_dir == "my-phase"
        assert args.from_step == 0
        assert args.model == "claude-opus-4-5"
        assert args.timeout == 1800
        assert args.verbose is False
        assert args.push is False

    def test_from_step(self):
        args = self._capture_run_args(["my-phase", "--from-step", "2"])
        assert args.from_step == 2

    def test_model(self):
        args = self._capture_run_args(["my-phase", "--model", "claude-sonnet-4-5"])
        assert args.model == "claude-sonnet-4-5"

    def test_timeout(self):
        args = self._capture_run_args(["my-phase", "--timeout", "3600"])
        assert args.timeout == 3600

    def test_verbose(self):
        args = self._capture_run_args(["my-phase", "--verbose"])
        assert args.verbose is True

    def test_push(self):
        args = self._capture_run_args(["my-phase", "--push"])
        assert args.push is True


# ---------------------------------------------------------------------------
# _check_blockers (= 이전 main() error/blocked 체크)
# ---------------------------------------------------------------------------

class TestCheckBlockers:
    def _make_executor_with_steps(self, tmp_project, steps):
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index))

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = len(steps)
        return inst

    def test_error_step_exits_1(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "bad", "status": "error", "error_message": "fail"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 1

    def test_blocked_step_exits_2(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "stuck", "status": "blocked", "blocked_reason": "API key"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# TestStatusCmd — cmd_status 함수 테스트
# ---------------------------------------------------------------------------

class TestStatusCmd:
    """cmd_status 함수 테스트."""

    @pytest.fixture
    def phases_env(self, tmp_path):
        """여러 phase를 포함한 테스트 환경."""
        phases_dir = tmp_path / "phases"
        phases_dir.mkdir()

        top = {
            "phases": [
                {"dir": "0-mvp", "status": "completed"},
                {"dir": "1-auth", "status": "error"},
                {"dir": "2-refactor", "status": "pending"},
            ]
        }
        (phases_dir / "index.json").write_text(json.dumps(top, indent=2))

        # 0-mvp: completed (2/2)
        mvp_dir = phases_dir / "0-mvp"
        mvp_dir.mkdir()
        mvp_idx = {
            "project": "TestApp",
            "phase": "mvp",
            "steps": [
                {
                    "step": 0, "name": "setup", "status": "completed",
                    "summary": "초기화 완료",
                    "started_at": "2026-04-16T10:00:00+0900",
                    "completed_at": "2026-04-16T10:00:42+0900",
                },
                {
                    "step": 1, "name": "core", "status": "completed",
                    "summary": "핵심 로직 구현",
                    "started_at": "2026-04-16T10:01:00+0900",
                    "completed_at": "2026-04-16T10:02:27+0900",
                },
            ],
        }
        (mvp_dir / "index.json").write_text(json.dumps(mvp_idx, indent=2, ensure_ascii=False))

        # 1-auth: error (1/2)
        auth_dir = phases_dir / "1-auth"
        auth_dir.mkdir()
        auth_idx = {
            "project": "TestApp",
            "phase": "auth",
            "steps": [
                {
                    "step": 0, "name": "setup", "status": "completed",
                    "summary": "완료",
                    "started_at": "2026-04-16T10:05:00+0900",
                    "completed_at": "2026-04-16T10:05:30+0900",
                },
                {
                    "step": 1, "name": "api", "status": "error",
                    "error_message": "npm install 실패",
                    "started_at": "2026-04-16T10:06:00+0900",
                    "failed_at": "2026-04-16T10:08:14+0900",
                },
            ],
        }
        (auth_dir / "index.json").write_text(json.dumps(auth_idx, indent=2, ensure_ascii=False))

        # 2-refactor: pending (0/1)
        refactor_dir = phases_dir / "2-refactor"
        refactor_dir.mkdir()
        refactor_idx = {
            "project": "TestApp",
            "phase": "refactor",
            "steps": [
                {"step": 0, "name": "cleanup", "status": "pending"},
            ],
        }
        (refactor_dir / "index.json").write_text(json.dumps(refactor_idx, indent=2, ensure_ascii=False))

        return tmp_path

    def _run_status(self, tmp_path, phase_dir=None):
        """cmd_status를 tmp_path 컨텍스트에서 실행하고 stdout 캡처."""
        import io
        args = MagicMock()
        args.phase_dir = phase_dir

        captured = io.StringIO()
        with patch.object(ex, "ROOT", tmp_path):
            with patch("sys.stdout", captured):
                ex.cmd_status(args)

        return captured.getvalue()

    # --- No phases ---

    def test_no_phases_index(self, tmp_path):
        """phases/index.json 없으면 'No phases found.' 출력."""
        (tmp_path / "phases").mkdir()
        output = self._run_status(tmp_path)
        assert "No phases found." in output

    def test_no_phases_dir(self, tmp_path):
        """phases/ 디렉토리 자체가 없어도 'No phases found.' 출력."""
        output = self._run_status(tmp_path)
        assert "No phases found." in output

    def test_no_phases_exits_0(self, tmp_path):
        """No phases found. 시 SystemExit 없이 정상 종료."""
        (tmp_path / "phases").mkdir()
        args = MagicMock()
        args.phase_dir = None
        with patch.object(ex, "ROOT", tmp_path):
            ex.cmd_status(args)  # should not raise

    # --- All phases summary ---

    def test_all_phases_header(self, phases_env):
        output = self._run_status(phases_env)
        assert "Harness Status" in output

    def test_all_phases_lists_all_dirs(self, phases_env):
        output = self._run_status(phases_env)
        assert "0-mvp" in output
        assert "1-auth" in output
        assert "2-refactor" in output

    def test_all_phases_step_counts(self, phases_env):
        output = self._run_status(phases_env)
        assert "2/2" in output   # 0-mvp

    def test_error_phase_shows_error_message(self, phases_env):
        output = self._run_status(phases_env)
        assert "npm install 실패" in output

    def test_error_phase_shows_step_number(self, phases_env):
        output = self._run_status(phases_env)
        assert "Step 1" in output

    def test_missing_phase_index_shows_unknown(self, phases_env):
        """phase 디렉토리가 있지만 index.json이 없으면 unknown으로 표시."""
        import shutil
        shutil.rmtree(phases_env / "phases" / "2-refactor")
        (phases_env / "phases" / "2-refactor").mkdir()
        output = self._run_status(phases_env)
        assert "unknown" in output

    # --- Phase detail ---

    def test_phase_detail_header(self, phases_env):
        output = self._run_status(phases_env, phase_dir="0-mvp")
        assert "Phase: 0-mvp" in output

    def test_phase_detail_project(self, phases_env):
        output = self._run_status(phases_env, phase_dir="0-mvp")
        assert "Project: TestApp" in output

    def test_phase_detail_status(self, phases_env):
        output = self._run_status(phases_env, phase_dir="0-mvp")
        assert "completed" in output

    def test_phase_detail_step_names(self, phases_env):
        output = self._run_status(phases_env, phase_dir="0-mvp")
        assert "setup" in output
        assert "core" in output

    def test_phase_detail_elapsed_seconds(self, phases_env):
        """completed_at - started_at = 42s."""
        output = self._run_status(phases_env, phase_dir="0-mvp")
        assert "42s" in output

    def test_phase_detail_started_time(self, phases_env):
        """started_at → HH:MM:SS 형식으로 표시."""
        output = self._run_status(phases_env, phase_dir="0-mvp")
        assert "10:00:00" in output

    def test_phase_detail_summary(self, phases_env):
        output = self._run_status(phases_env, phase_dir="0-mvp")
        assert "초기화 완료" in output

    def test_phase_detail_error_step(self, phases_env):
        output = self._run_status(phases_env, phase_dir="1-auth")
        assert "error" in output
        assert "npm install 실패" in output

    def test_phase_detail_error_elapsed(self, phases_env):
        """failed_at - started_at = 134s."""
        output = self._run_status(phases_env, phase_dir="1-auth")
        assert "134s" in output

    def test_phase_detail_pending_dashes(self, phases_env):
        """pending step은 시간 필드에 '-'를 표시한다."""
        output = self._run_status(phases_env, phase_dir="2-refactor")
        assert "pending" in output
        assert "-" in output

    def test_nonexistent_phase_exits_1(self, phases_env):
        """존재하지 않는 phase_dir는 exit(1)."""
        args = MagicMock()
        args.phase_dir = "nonexistent"
        with patch.object(ex, "ROOT", phases_env):
            with pytest.raises(SystemExit) as exc_info:
                ex.cmd_status(args)
        assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# TestResetCmd — cmd_reset 함수 테스트
# ---------------------------------------------------------------------------

class TestResetCmd:
    """cmd_reset 함수 테스트."""

    @pytest.fixture
    def reset_env(self, tmp_path):
        """error/blocked step을 포함한 테스트 환경."""
        phases_dir = tmp_path / "phases"
        phases_dir.mkdir()

        phase_dir = phases_dir / "test-phase"
        phase_dir.mkdir()

        idx = {
            "project": "test",
            "phase": "test-phase",
            "steps": [
                {"step": 0, "name": "a", "status": "completed", "summary": "ok"},
                {
                    "step": 1, "name": "b", "status": "error",
                    "error_message": "fail", "failed_at": "2026-01-01T00:00:00+0900",
                },
                {
                    "step": 2, "name": "c", "status": "blocked",
                    "blocked_reason": "need key", "blocked_at": "2026-01-01T00:00:00+0900",
                },
                {"step": 3, "name": "d", "status": "pending"},
            ],
        }
        (phase_dir / "index.json").write_text(json.dumps(idx, indent=2, ensure_ascii=False))
        return tmp_path

    def _run_reset(self, tmp_path, phase_dir, step=None, all_steps=False):
        """cmd_reset을 실행하고 stdout을 캡처하여 반환. SystemExit(0)은 정상으로 처리."""
        import io
        args = MagicMock()
        args.phase_dir = phase_dir
        args.step = step
        args.all = all_steps

        captured = io.StringIO()
        with patch.object(ex, "ROOT", tmp_path):
            with patch("sys.stdout", captured):
                try:
                    ex.cmd_reset(args)
                except SystemExit as e:
                    if e.code != 0:
                        raise

        return captured.getvalue()

    def _read_index(self, tmp_path, phase_dir):
        p = tmp_path / "phases" / phase_dir / "index.json"
        return json.loads(p.read_text(encoding="utf-8"))

    # --- 기본 동작: 첫 번째 error/blocked step 리셋 ---

    def test_default_resets_first_error(self, reset_env):
        """기본 호출 시 첫 번째 error step을 pending으로 전환."""
        self._run_reset(reset_env, "test-phase")
        idx = self._read_index(reset_env, "test-phase")
        step1 = next(s for s in idx["steps"] if s["step"] == 1)
        assert step1["status"] == "pending"

    def test_default_removes_error_message(self, reset_env):
        self._run_reset(reset_env, "test-phase")
        idx = self._read_index(reset_env, "test-phase")
        step1 = next(s for s in idx["steps"] if s["step"] == 1)
        assert "error_message" not in step1
        assert "failed_at" not in step1

    def test_default_leaves_blocked_untouched(self, reset_env):
        """기본 호출은 첫 번째 error/blocked만 리셋한다."""
        self._run_reset(reset_env, "test-phase")
        idx = self._read_index(reset_env, "test-phase")
        step2 = next(s for s in idx["steps"] if s["step"] == 2)
        assert step2["status"] == "blocked"

    def test_default_does_not_touch_completed(self, reset_env):
        self._run_reset(reset_env, "test-phase")
        idx = self._read_index(reset_env, "test-phase")
        step0 = next(s for s in idx["steps"] if s["step"] == 0)
        assert step0["status"] == "completed"

    def test_default_output_shows_reset(self, reset_env):
        output = self._run_reset(reset_env, "test-phase")
        assert "Step 1" in output
        assert "error" in output
        assert "pending" in output

    def test_default_output_shows_run_hint(self, reset_env):
        output = self._run_reset(reset_env, "test-phase")
        assert "Reset 1 step(s)" in output
        assert "python3 scripts/execute.py run test-phase" in output

    # --- --all: 모든 error/blocked step 리셋 ---

    def test_all_resets_all_error_blocked(self, reset_env):
        self._run_reset(reset_env, "test-phase", all_steps=True)
        idx = self._read_index(reset_env, "test-phase")
        step1 = next(s for s in idx["steps"] if s["step"] == 1)
        step2 = next(s for s in idx["steps"] if s["step"] == 2)
        assert step1["status"] == "pending"
        assert step2["status"] == "pending"

    def test_all_removes_extra_fields(self, reset_env):
        self._run_reset(reset_env, "test-phase", all_steps=True)
        idx = self._read_index(reset_env, "test-phase")
        step1 = next(s for s in idx["steps"] if s["step"] == 1)
        step2 = next(s for s in idx["steps"] if s["step"] == 2)
        for field in ("error_message", "failed_at", "blocked_reason", "blocked_at"):
            assert field not in step1
            assert field not in step2

    def test_all_output_shows_both_steps(self, reset_env):
        output = self._run_reset(reset_env, "test-phase", all_steps=True)
        assert "Step 1" in output
        assert "Step 2" in output
        assert "Reset 2 step(s)" in output

    def test_all_does_not_touch_completed(self, reset_env):
        self._run_reset(reset_env, "test-phase", all_steps=True)
        idx = self._read_index(reset_env, "test-phase")
        step0 = next(s for s in idx["steps"] if s["step"] == 0)
        assert step0["status"] == "completed"

    def test_all_preserves_started_at(self, reset_env):
        """리셋 시 started_at은 건드리지 않는다."""
        # started_at 추가
        p = reset_env / "phases" / "test-phase" / "index.json"
        idx = json.loads(p.read_text())
        idx["steps"][1]["started_at"] = "2026-01-01T00:00:00+0900"
        p.write_text(json.dumps(idx, indent=2))

        self._run_reset(reset_env, "test-phase", all_steps=True)
        idx = self._read_index(reset_env, "test-phase")
        step1 = next(s for s in idx["steps"] if s["step"] == 1)
        assert step1.get("started_at") == "2026-01-01T00:00:00+0900"

    def test_all_no_error_blocked_exits_0(self, tmp_path):
        """리셋할 step이 없을 때 exit 없이 메시지 출력."""
        phases_dir = tmp_path / "phases"
        phases_dir.mkdir()
        pd = phases_dir / "clean-phase"
        pd.mkdir()
        idx = {
            "project": "t", "phase": "clean",
            "steps": [{"step": 0, "name": "a", "status": "completed", "summary": "ok"}],
        }
        (pd / "index.json").write_text(json.dumps(idx))

        output = self._run_reset(tmp_path, "clean-phase", all_steps=True)
        assert "No error or blocked steps found" in output

    # --- --step N: 특정 step 리셋 ---

    def test_step_resets_target(self, reset_env):
        self._run_reset(reset_env, "test-phase", step=1)
        idx = self._read_index(reset_env, "test-phase")
        step1 = next(s for s in idx["steps"] if s["step"] == 1)
        assert step1["status"] == "pending"
        assert "error_message" not in step1

    def test_step_does_not_touch_others(self, reset_env):
        self._run_reset(reset_env, "test-phase", step=1)
        idx = self._read_index(reset_env, "test-phase")
        step2 = next(s for s in idx["steps"] if s["step"] == 2)
        assert step2["status"] == "blocked"

    def test_step_output(self, reset_env):
        output = self._run_reset(reset_env, "test-phase", step=1)
        assert "Step 1" in output
        assert "error" in output
        assert "pending" in output
        assert "Reset 1 step(s)" in output

    def test_step_not_error_or_blocked_warns(self, reset_env):
        """--step N 지정 시 해당 step이 error/blocked 아니면 WARN 출력 후 exit 0."""
        import io
        args = MagicMock()
        args.phase_dir = "test-phase"
        args.step = 3
        args.all = False

        captured = io.StringIO()
        with patch.object(ex, "ROOT", reset_env):
            with patch("sys.stdout", captured):
                try:
                    ex.cmd_reset(args)
                except SystemExit as e:
                    assert e.code == 0

        output = captured.getvalue()
        assert "WARN" in output
        assert "pending" in output
        assert "Skipping" in output

    def test_step_not_error_or_blocked_no_change(self, reset_env):
        """WARN 케이스에서 index.json이 변경되지 않아야 한다."""
        p = reset_env / "phases" / "test-phase" / "index.json"
        before = p.read_text()

        import io
        args = MagicMock()
        args.phase_dir = "test-phase"
        args.step = 3
        args.all = False
        with patch.object(ex, "ROOT", reset_env):
            with patch("sys.stdout", io.StringIO()):
                try:
                    ex.cmd_reset(args)
                except SystemExit as e:
                    assert e.code == 0

        assert p.read_text() == before

    # --- 에러 케이스: 존재하지 않는 phase ---

    def test_nonexistent_phase_exits_1(self, reset_env):
        import io
        args = MagicMock()
        args.phase_dir = "nonexistent"
        args.step = None
        args.all = False
        with patch.object(ex, "ROOT", reset_env):
            with patch("sys.stdout", io.StringIO()):
                with pytest.raises(SystemExit) as exc_info:
                    ex.cmd_reset(args)
        assert exc_info.value.code == 1

    def test_nonexistent_phase_error_message(self, reset_env):
        import io
        args = MagicMock()
        args.phase_dir = "nonexistent"
        args.step = None
        args.all = False
        captured = io.StringIO()
        with patch.object(ex, "ROOT", reset_env):
            with patch("sys.stdout", captured):
                with pytest.raises(SystemExit):
                    ex.cmd_reset(args)
        assert "ERROR" in captured.getvalue()
        assert "nonexistent" in captured.getvalue()

    # --- 기본 호출: 리셋할 step 없는 경우 ---

    def test_default_no_error_blocked(self, tmp_path):
        phases_dir = tmp_path / "phases"
        phases_dir.mkdir()
        pd = phases_dir / "clean"
        pd.mkdir()
        idx = {
            "project": "t", "phase": "clean",
            "steps": [{"step": 0, "name": "a", "status": "completed", "summary": "ok"}],
        }
        (pd / "index.json").write_text(json.dumps(idx))

        output = self._run_reset(tmp_path, "clean")
        assert "No error or blocked steps found" in output


# ---------------------------------------------------------------------------
# TestInitCmd — cmd_init 함수 테스트
# ---------------------------------------------------------------------------

class TestInitCmd:
    """cmd_init 함수 테스트."""

    def _run_init(self, tmp_path, phase_name, steps, project=None):
        """cmd_init을 tmp_path 컨텍스트에서 실행하고 stdout을 캡처하여 반환."""
        import io
        args = MagicMock()
        args.phase_name = phase_name
        args.steps = steps
        args.project = project

        captured = io.StringIO()
        with patch.object(ex, "ROOT", tmp_path):
            with patch("sys.stdout", captured):
                ex.cmd_init(args)

        return captured.getvalue()

    def _read_index(self, tmp_path, phase_name):
        p = tmp_path / "phases" / phase_name / "index.json"
        return json.loads(p.read_text(encoding="utf-8"))

    def _read_top_index(self, tmp_path):
        p = tmp_path / "phases" / "index.json"
        return json.loads(p.read_text(encoding="utf-8"))

    # --- 기본 생성 ---

    def test_creates_phase_directory(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 2)
        assert (tmp_path / "phases" / "my-phase").is_dir()

    def test_creates_index_json(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 2)
        assert (tmp_path / "phases" / "my-phase" / "index.json").exists()

    def test_index_has_correct_step_count(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 3)
        idx = self._read_index(tmp_path, "my-phase")
        assert len(idx["steps"]) == 3

    def test_index_steps_all_pending(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 3)
        idx = self._read_index(tmp_path, "my-phase")
        for s in idx["steps"]:
            assert s["status"] == "pending"

    def test_index_step_numbers_sequential(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 3)
        idx = self._read_index(tmp_path, "my-phase")
        assert [s["step"] for s in idx["steps"]] == [0, 1, 2]

    def test_index_phase_matches_name(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 2)
        idx = self._read_index(tmp_path, "my-phase")
        assert idx["phase"] == "my-phase"

    def test_creates_step_md_files(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 3)
        phase_dir = tmp_path / "phases" / "my-phase"
        for i in range(3):
            assert (phase_dir / f"step{i}.md").exists()

    def test_step_md_not_empty(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 2)
        phase_dir = tmp_path / "phases" / "my-phase"
        for i in range(2):
            content = (phase_dir / f"step{i}.md").read_text(encoding="utf-8")
            assert len(content.strip()) > 0

    def test_step_md_has_title(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 2)
        content = (tmp_path / "phases" / "my-phase" / "step0.md").read_text(encoding="utf-8")
        assert "# Step 0" in content

    def test_step_md_has_ac_section(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 2)
        content = (tmp_path / "phases" / "my-phase" / "step0.md").read_text(encoding="utf-8")
        assert "Acceptance Criteria" in content

    def test_step_md_has_phase_name(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 2)
        content = (tmp_path / "phases" / "my-phase" / "step0.md").read_text(encoding="utf-8")
        assert "my-phase" in content

    # --- project 이름 ---

    def test_project_explicit(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 1, project="MyApp")
        idx = self._read_index(tmp_path, "my-phase")
        assert idx["project"] == "MyApp"

    def test_project_default_uses_root_name(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 1)
        idx = self._read_index(tmp_path, "my-phase")
        assert idx["project"] == tmp_path.name

    # --- phases/index.json 업데이트 ---

    def test_top_index_created_if_missing(self, tmp_path):
        (tmp_path / "phases").mkdir(parents=True, exist_ok=True)
        self._run_init(tmp_path, "my-phase", 1)
        assert (tmp_path / "phases" / "index.json").exists()

    def test_top_index_gets_new_entry(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 1)
        top = self._read_top_index(tmp_path)
        dirs = [p["dir"] for p in top["phases"]]
        assert "my-phase" in dirs

    def test_top_index_new_entry_is_pending(self, tmp_path):
        self._run_init(tmp_path, "my-phase", 1)
        top = self._read_top_index(tmp_path)
        entry = next(p for p in top["phases"] if p["dir"] == "my-phase")
        assert entry["status"] == "pending"

    def test_top_index_existing_phases_preserved(self, tmp_path):
        phases_dir = tmp_path / "phases"
        phases_dir.mkdir()
        top_file = phases_dir / "index.json"
        top_file.write_text(json.dumps({"phases": [{"dir": "old-phase", "status": "completed"}]}))

        self._run_init(tmp_path, "my-phase", 1)
        top = self._read_top_index(tmp_path)
        dirs = [p["dir"] for p in top["phases"]]
        assert "old-phase" in dirs
        assert "my-phase" in dirs

    # --- 출력 메시지 ---

    def test_output_shows_created_directory(self, tmp_path):
        output = self._run_init(tmp_path, "my-phase", 2)
        assert "Created phases/my-phase/" in output

    def test_output_shows_step_count(self, tmp_path):
        output = self._run_init(tmp_path, "my-phase", 3)
        assert "3 steps" in output

    def test_output_shows_step_files(self, tmp_path):
        output = self._run_init(tmp_path, "my-phase", 2)
        assert "step0.md" in output
        assert "step1.md" in output

    def test_output_shows_next_steps(self, tmp_path):
        output = self._run_init(tmp_path, "my-phase", 1)
        assert "Next steps" in output
        assert "python3 scripts/execute.py run my-phase" in output

    # --- 에러 케이스 ---

    def test_error_phase_already_exists(self, tmp_path):
        (tmp_path / "phases" / "my-phase").mkdir(parents=True)
        import io
        args = MagicMock()
        args.phase_name = "my-phase"
        args.steps = 2
        args.project = None
        captured = io.StringIO()
        with patch.object(ex, "ROOT", tmp_path):
            with patch("sys.stdout", captured):
                with pytest.raises(SystemExit) as exc_info:
                    ex.cmd_init(args)
        assert exc_info.value.code == 1
        assert "already exists" in captured.getvalue()

    def test_error_steps_less_than_1(self, tmp_path):
        import io
        args = MagicMock()
        args.phase_name = "my-phase"
        args.steps = 0
        args.project = None
        captured = io.StringIO()
        with patch.object(ex, "ROOT", tmp_path):
            with patch("sys.stdout", captured):
                with pytest.raises(SystemExit) as exc_info:
                    ex.cmd_init(args)
        assert exc_info.value.code == 1
        assert "--steps" in captured.getvalue()


# ---------------------------------------------------------------------------
# TestPreflightCheck — _preflight_check 메서드 테스트
# ---------------------------------------------------------------------------

class TestPreflightCheck:
    """_preflight_check 메서드 테스트."""

    def _make_executor(self, tmp_project, steps, from_step=0, step_files=None):
        """테스트용 StepExecutor 인스턴스.

        step_files: 생성할 step 파일 번호 목록. None이면 steps 목록의 번호 모두 생성.
        빈 리스트([])이면 파일 생성 안 함.
        """
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index))

        nums_to_create = step_files if step_files is not None else [s["step"] for s in steps]
        for n in nums_to_create:
            (d / f"step{n}.md").write_text(f"# Step {n}")

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = len(steps)
        inst._from_step = from_step
        return inst

    # --- 검증 1: step 파일 존재 여부 ---

    def test_missing_step_file_exits_1(self, tmp_project):
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        # step0.md만 생성, step1.md 누락
        inst = self._make_executor(tmp_project, steps, step_files=[0])

        with pytest.raises(SystemExit) as exc_info:
            inst._preflight_check()
        assert exc_info.value.code == 1

    def test_missing_step_file_error_message(self, tmp_project, capsys):
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        inst = self._make_executor(tmp_project, steps, step_files=[])  # 파일 없음

        with pytest.raises(SystemExit):
            inst._preflight_check()

        captured = capsys.readouterr()
        assert "Missing step file" in captured.out
        assert "step0.md" in captured.out

    def test_missing_step_file_includes_phase_path(self, tmp_project, capsys):
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        inst = self._make_executor(tmp_project, steps, step_files=[])

        with pytest.raises(SystemExit):
            inst._preflight_check()

        captured = capsys.readouterr()
        assert "phases/test-phase/step0.md" in captured.out

    def test_all_step_files_exist_passes(self, tmp_project):
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps)  # 기본: 모두 생성
        inst._preflight_check()  # SystemExit 없어야 함

    # --- 검증 2: step 번호 연속성 ---

    def test_gap_in_step_numbers_exits_1(self, tmp_project):
        # steps [0, 2] — step 1 누락(gap)
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 2, "name": "c", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, step_files=[0, 2])

        with pytest.raises(SystemExit) as exc_info:
            inst._preflight_check()
        assert exc_info.value.code == 1

    def test_gap_error_message(self, tmp_project, capsys):
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 2, "name": "c", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, step_files=[0, 2])

        with pytest.raises(SystemExit):
            inst._preflight_check()

        captured = capsys.readouterr()
        assert "consecutive" in captured.out
        assert "gap" in captured.out
        assert "step 1" in captured.out  # gap 위치

    def test_consecutive_steps_passes(self, tmp_project):
        steps = [
            {"step": 0, "name": "a", "status": "completed", "summary": "ok"},
            {"step": 1, "name": "b", "status": "completed", "summary": "ok"},
            {"step": 2, "name": "c", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps)
        inst._preflight_check()  # SystemExit 없어야 함

    # --- 검증 3: --from-step 범위 ---

    def test_from_step_out_of_range_exits_1(self, tmp_project):
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=99)

        with pytest.raises(SystemExit) as exc_info:
            inst._preflight_check()
        assert exc_info.value.code == 1

    def test_from_step_out_of_range_error_message(self, tmp_project, capsys):
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 1, "name": "b", "status": "pending"},
            {"step": 2, "name": "c", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=5)

        with pytest.raises(SystemExit):
            inst._preflight_check()

        captured = capsys.readouterr()
        assert "--from-step 5" in captured.out
        assert "out of range" in captured.out
        assert "3 steps" in captured.out

    def test_from_step_valid_last_index(self, tmp_project):
        """--from-step이 total-1이면 통과."""
        steps = [
            {"step": 0, "name": "a", "status": "completed", "summary": "ok"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=1)
        inst._preflight_check()  # SystemExit 없어야 함

    def test_from_step_zero_valid(self, tmp_project):
        steps = [{"step": 0, "name": "a", "status": "pending"}]
        inst = self._make_executor(tmp_project, steps, from_step=0)
        inst._preflight_check()  # SystemExit 없어야 함

    def test_from_step_equal_to_total_exits_1(self, tmp_project):
        """--from-step == total (범위 초과)"""
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=2)  # total=2, valid: 0~1

        with pytest.raises(SystemExit) as exc_info:
            inst._preflight_check()
        assert exc_info.value.code == 1

    # --- 검증 4: --from-step 이전 pending step 경고 ---

    def test_skipping_pending_step_warns(self, tmp_project, capsys):
        steps = [
            {"step": 0, "name": "setup", "status": "pending"},
            {"step": 1, "name": "core", "status": "pending"},
            {"step": 2, "name": "ui", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=2)
        inst._preflight_check()  # exit 없어야 함

        captured = capsys.readouterr()
        assert "WARN" in captured.out
        assert "step 0" in captured.out.lower() or "Step 0" in captured.out

    def test_skipping_pending_does_not_exit(self, tmp_project):
        """경고는 출력하지만 sys.exit()을 호출하지 않는다."""
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=1)
        inst._preflight_check()  # SystemExit 없어야 함

    def test_skipping_completed_no_warning(self, tmp_project, capsys):
        """completed step을 건너뛰는 것은 경고 없음."""
        steps = [
            {"step": 0, "name": "a", "status": "completed", "summary": "ok"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=1)
        inst._preflight_check()

        captured = capsys.readouterr()
        assert "WARN" not in captured.out

    def test_from_step_zero_no_warning(self, tmp_project, capsys):
        """--from-step 0이면 경고 없음."""
        steps = [
            {"step": 0, "name": "a", "status": "pending"},
            {"step": 1, "name": "b", "status": "pending"},
        ]
        inst = self._make_executor(tmp_project, steps, from_step=0)
        inst._preflight_check()

        captured = capsys.readouterr()
        assert "WARN" not in captured.out


# ---------------------------------------------------------------------------
# TestPhaseSummary — _print_phase_summary 메서드 테스트
# ---------------------------------------------------------------------------

class TestPhaseSummary:
    """_print_phase_summary 메서드 테스트."""

    def _make_executor_with_index(self, tmp_project, index):
        """index dict를 받아 테스트용 StepExecutor를 반환."""
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        (d / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._phase_name = index.get("phase", "test-phase")
        return inst

    def _capture_summary(self, inst, index):
        import io
        captured = io.StringIO()
        with patch("sys.stdout", captured):
            inst._print_phase_summary(index)
        return captured.getvalue()

    @pytest.fixture
    def summary_index(self):
        return {
            "project": "TestApp",
            "phase": "my-phase",
            "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {
                    "step": 0, "name": "setup", "status": "completed",
                    "summary": "초기화 완료",
                    "started_at": "2026-04-16T10:00:00+0900",
                    "completed_at": "2026-04-16T10:00:42+0900",
                },
                {
                    "step": 1, "name": "core", "status": "completed",
                    "summary": "핵심 로직 구현",
                    "started_at": "2026-04-16T10:01:00+0900",
                    "completed_at": "2026-04-16T10:02:27+0900",
                },
                {
                    "step": 2, "name": "pending-step", "status": "pending",
                },
            ],
        }

    # --- 헤더 출력 ---

    def test_header_contains_phase_name(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "my-phase" in output
        assert "Summary" in output

    def test_header_has_separator_lines(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "=" * 60 in output

    # --- completed step만 표시 ---

    def test_shows_completed_steps(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "setup" in output
        assert "core" in output

    def test_excludes_pending_steps(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "pending-step" not in output

    def test_excludes_error_steps(self, tmp_project):
        index = {
            "phase": "test", "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {"step": 0, "name": "ok", "status": "completed", "summary": "done",
                 "started_at": "2026-04-16T10:00:00+0900", "completed_at": "2026-04-16T10:00:10+0900"},
                {"step": 1, "name": "broken", "status": "error", "error_message": "fail"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        output = self._capture_summary(inst, index)
        assert "broken" not in output

    # --- elapsed 계산 ---

    def test_elapsed_seconds_shown(self, tmp_project, summary_index):
        """step 0: 42s elapsed."""
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "42s" in output

    def test_elapsed_dash_when_no_timestamps(self, tmp_project):
        """started_at/completed_at 모두 없으면 '-'."""
        index = {
            "phase": "test", "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {"step": 0, "name": "a", "status": "completed", "summary": "done"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        output = self._capture_summary(inst, index)
        assert "-" in output

    def test_elapsed_dash_when_invalid_timestamp(self, tmp_project):
        """타임스탬프가 파싱 불가면 '-'로 표시하고 예외 없음."""
        index = {
            "phase": "test", "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {"step": 0, "name": "a", "status": "completed", "summary": "done",
                 "started_at": "not-a-timestamp", "completed_at": "also-invalid"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        output = self._capture_summary(inst, index)  # 예외 없어야 함
        assert "-" in output

    # --- summary 필드 ---

    def test_summary_shown(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "초기화 완료" in output
        assert "핵심 로직 구현" in output

    def test_no_summary_shows_placeholder(self, tmp_project):
        """summary 필드 없으면 '(no summary)' 표시."""
        index = {
            "phase": "test", "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {"step": 0, "name": "a", "status": "completed"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        output = self._capture_summary(inst, index)
        assert "(no summary)" in output

    # --- Total 라인 ---

    def test_total_shows_step_count(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "Total: 2 steps" in output

    def test_total_shows_elapsed_time(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        # Total 라인에 시간이 있어야 함 (정확한 값은 현재 시간에 따라 다름)
        assert "Total:" in output
        assert "|" in output

    def test_total_elapsed_dash_when_no_created_at(self, tmp_project):
        """created_at 없으면 total elapsed = '-'."""
        index = {
            "phase": "test",
            "steps": [
                {"step": 0, "name": "a", "status": "completed", "summary": "ok",
                 "started_at": "2026-04-16T10:00:00+0900", "completed_at": "2026-04-16T10:00:10+0900"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        output = self._capture_summary(inst, index)
        assert "Total: 1 steps | -" in output

    def test_total_minutes_format(self, tmp_project):
        """1분 이상이면 'Xm Ys' 형식."""
        index = {
            "phase": "test",
            "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {"step": 0, "name": "a", "status": "completed", "summary": "ok",
                 "started_at": "2026-04-16T10:00:00+0900", "completed_at": "2026-04-16T10:00:10+0900"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        # _stamp() 를 mock해서 created_at으로부터 90초 후로 설정
        with patch.object(inst, "_stamp", return_value="2026-04-16T10:01:30+0900"):
            output = self._capture_summary(inst, index)
        assert "1m 30s" in output

    def test_total_seconds_only_format(self, tmp_project):
        """1분 미만이면 'Xs' 형식."""
        index = {
            "phase": "test",
            "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {"step": 0, "name": "a", "status": "completed", "summary": "ok",
                 "started_at": "2026-04-16T10:00:00+0900", "completed_at": "2026-04-16T10:00:10+0900"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        with patch.object(inst, "_stamp", return_value="2026-04-16T10:00:45+0900"):
            output = self._capture_summary(inst, index)
        assert "45s" in output
        assert "m " not in output  # 분 단위 없어야 함

    # --- 빈 completed steps ---

    def test_empty_completed_steps(self, tmp_project):
        """completed step이 없어도 예외 없이 출력."""
        index = {
            "phase": "test", "created_at": "2026-04-16T10:00:00+0900",
            "steps": [
                {"step": 0, "name": "pending-only", "status": "pending"},
            ],
        }
        inst = self._make_executor_with_index(tmp_project, index)
        output = self._capture_summary(inst, index)
        assert "Total: 0 steps" in output

    # --- 출력 구조 ---

    def test_column_headers_present(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "Step" in output
        assert "Name" in output
        assert "Elapsed" in output
        assert "Summary" in output

    def test_separator_lines_present(self, tmp_project, summary_index):
        inst = self._make_executor_with_index(tmp_project, summary_index)
        output = self._capture_summary(inst, summary_index)
        assert "─" in output
