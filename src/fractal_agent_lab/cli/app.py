from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.agents import build_h1_prompt_tags
from fractal_agent_lab.cli.config_loader import (
    build_runtime_limits,
    load_run_configs,
    resolve_data_dir,
)
from fractal_agent_lab.cli.formatting import (
    build_json_output,
    build_trace_artifact_json_output,
    format_run_summary_text,
    format_trace_artifact_timeline_text,
    format_trace_summary_text,
)
from fractal_agent_lab.cli.trace_reader import load_trace_view_artifacts
from fractal_agent_lab.cli.workflow_registry import (
    get_workflow_agent_specs,
    get_workflow_spec,
    list_workflow_ids,
)
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.identity import run_post_run_identity_update
from fractal_agent_lab.memory import (
    load_session_memory_context,
    write_memory_candidates_artifact,
    write_session_memory_snapshot_artifact,
)
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.state import InMemoryRunStateStore
from fractal_agent_lab.tracing import (
    InMemoryTraceEmitter,
    write_run_artifact,
    write_trace_artifact,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="fal", description="Fractal Agent Lab CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Run a workflow")
    run_parser.add_argument("workflow_id", help="Workflow identifier to execute")
    run_parser.add_argument(
        "--input-json",
        default="{}",
        help="Input payload as a JSON object string",
    )
    run_parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format",
    )
    run_parser.add_argument(
        "--show-trace",
        action="store_true",
        help="Include trace timeline summary in output",
    )
    run_parser.add_argument(
        "--runtime-config",
        default="configs/runtime.example.yaml",
        help="Runtime config path",
    )
    run_parser.add_argument(
        "--providers-config",
        default="configs/providers.example.yaml",
        help="Providers config path",
    )
    run_parser.add_argument(
        "--model-policy-config",
        default="configs/model_policy.example.yaml",
        help="Model policy config path",
    )
    run_parser.add_argument(
        "--provider",
        default=None,
        help="Optional provider override (e.g. mock, openai, openrouter)",
    )

    trace_parser = subparsers.add_parser("trace", help="Inspect stored run traces")
    trace_subparsers = trace_parser.add_subparsers(dest="trace_command", required=True)
    trace_show_parser = trace_subparsers.add_parser("show", help="Show trace timeline for a run")
    trace_show_parser.add_argument("--run-id", required=True, help="Run identifier")
    trace_show_parser.add_argument(
        "--data-dir",
        default="data",
        help="Data directory that contains runs/ and traces/",
    )
    trace_show_parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Trace viewer output format",
    )

    subparsers.add_parser("list-workflows", help="List available workflows")
    return parser


def run_cli(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "list-workflows":
        for workflow_id in list_workflow_ids():
            print(workflow_id)
        return 0

    if args.command == "run":
        return _handle_run(args)

    if args.command == "trace":
        return _handle_trace(args)

    parser.error(f"Unsupported command: {args.command}")
    return 2


def main() -> int:
    return run_cli()


def _handle_run(args: argparse.Namespace) -> int:
    try:
        workflow = get_workflow_spec(args.workflow_id)
        workflow_agent_specs = get_workflow_agent_specs(args.workflow_id)
    except ValueError as error:
        print(f"Error: {error}")
        return 2

    try:
        input_payload = _parse_input_payload(args.input_json)
    except ValueError as error:
        print(f"Error: {error}")
        return 2

    try:
        runtime_config, providers_config, model_policy_config = load_run_configs(
            runtime_config_path=args.runtime_config,
            providers_config_path=args.providers_config,
            model_policy_config_path=args.model_policy_config,
        )
        _apply_provider_override(providers_config, args.provider)
        limits = build_runtime_limits(runtime_config)
    except ValueError as error:
        print(f"Error: {error}")
        return 2

    data_dir = resolve_data_dir(runtime_config)
    run_context = load_session_memory_context(input_payload=input_payload, data_dir=data_dir)

    emitter = InMemoryTraceEmitter()
    state_store = InMemoryRunStateStore()
    executor = WorkflowExecutor(
        step_runner=build_step_runner(
            agent_specs_by_id=workflow_agent_specs,
            providers_config=providers_config,
            model_policy_config=model_policy_config,
        ),
        emitter=emitter,
        state_store=state_store,
        limits=limits,
    )

    run_state = executor.execute(
        workflow=workflow,
        input_payload=input_payload,
        context=run_context,
    )
    _inject_h1_prompt_tags(
        run_state=run_state,
        workflow=workflow,
        workflow_agent_specs=workflow_agent_specs,
    )

    run_artifact_path = None
    trace_artifact_path = None
    try:
        run_artifact_path = write_run_artifact(run_state, data_dir=data_dir)
        trace_artifact_path = write_trace_artifact(
            emitter.events,
            run_id=run_state.run_id,
            data_dir=data_dir,
        )
        _ = write_session_memory_snapshot_artifact(
            run_id=run_state.run_id,
            workflow_id=run_state.workflow_id,
            run_context=run_state.context,
            data_dir=data_dir,
        )
        _ = write_memory_candidates_artifact(
            run_state=run_state,
            data_dir=data_dir,
        )
    except OSError as error:
        print(f"Warning: failed to write run/trace artifacts: {error}", file=sys.stderr)

    try:
        _ = run_post_run_identity_update(
            run_state=run_state,
            trace_events=emitter.events,
            runtime_config=runtime_config,
            data_dir=data_dir,
        )
    except Exception as error:
        print(f"Warning: identity updater failed (non-fatal): {error}", file=sys.stderr)

    steps_total = len(workflow.steps)
    include_trace = bool(args.show_trace)
    if args.format == "json":
        output = build_json_output(
            run_state,
            emitter.events,
            steps_total=steps_total,
            include_trace=include_trace,
        )
        print(json.dumps(output, indent=2, ensure_ascii=True))
    else:
        print(
            format_run_summary_text(
                run_state,
                steps_total=steps_total,
                trace_events_count=len(emitter.events),
                run_artifact_path=run_artifact_path,
                trace_artifact_path=trace_artifact_path,
            ),
        )
        if include_trace:
            print()
            print(format_trace_summary_text(emitter.events))

    return 0 if run_state.status == RunStatus.SUCCEEDED else 1


def _parse_input_payload(raw_input: str) -> dict[str, Any]:
    try:
        value = json.loads(raw_input)
    except json.JSONDecodeError as error:
        raise ValueError(f"--input-json must be valid JSON: {error.msg}.") from error

    if not isinstance(value, dict):
        raise ValueError("--input-json must decode to a JSON object.")
    return value


def _apply_provider_override(providers_config: dict[str, Any], provider: str | None) -> None:
    if not provider:
        return

    providers_config["default_provider"] = provider

    providers_block = providers_config.get("providers")
    if not isinstance(providers_block, dict):
        providers_block = {}
        providers_config["providers"] = providers_block

    provider_block = providers_block.get(provider)
    if not isinstance(provider_block, dict):
        provider_block = {}
        providers_block[provider] = provider_block
    provider_block["enabled"] = True


def _inject_h1_prompt_tags(
    *,
    run_state,
    workflow,
    workflow_agent_specs,
) -> None:
    prompt_tags = build_h1_prompt_tags(
        workflow=workflow,
        agent_specs_by_id=workflow_agent_specs,
        step_results=run_state.step_results,
    )
    if prompt_tags is None:
        return

    payload = dict(run_state.output_payload or {})
    payload["prompt_tags"] = prompt_tags
    run_state.output_payload = payload


def _handle_trace(args: argparse.Namespace) -> int:
    if args.trace_command != "show":
        print(f"Error: unsupported trace command '{args.trace_command}'.")
        return 2

    try:
        run_payload, trace_events, run_artifact_path, trace_artifact_path = load_trace_view_artifacts(
            run_id=args.run_id,
            data_dir=args.data_dir,
        )
    except ValueError as error:
        print(f"Error: {error}")
        return 2

    if args.format == "json":
        output = build_trace_artifact_json_output(
            run_id=args.run_id,
            run_payload=run_payload,
            trace_events=trace_events,
            run_artifact_path=run_artifact_path,
            trace_artifact_path=trace_artifact_path,
        )
        print(json.dumps(output, indent=2, ensure_ascii=True))
        return 0

    print(
        format_trace_artifact_timeline_text(
            run_id=args.run_id,
            run_payload=run_payload,
            trace_events=trace_events,
            run_artifact_path=run_artifact_path,
            trace_artifact_path=trace_artifact_path,
        ),
    )
    return 0
