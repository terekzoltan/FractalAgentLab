from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.cli.config_loader import (
    build_runtime_limits,
    load_run_configs,
    resolve_data_dir,
)
from fractal_agent_lab.cli.formatting import (
    build_json_output,
    format_run_summary_text,
    format_trace_summary_text,
)
from fractal_agent_lab.cli.workflow_registry import (
    get_workflow_agent_specs,
    get_workflow_spec,
    list_workflow_ids,
)
from fractal_agent_lab.core.models import RunStatus
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

    run_state = executor.execute(workflow=workflow, input_payload=input_payload)

    data_dir = resolve_data_dir(runtime_config)
    try:
        write_run_artifact(run_state, data_dir=data_dir)
        write_trace_artifact(emitter.events, run_id=run_state.run_id, data_dir=data_dir)
    except OSError as error:
        print(f"Warning: failed to write run/trace artifacts: {error}", file=sys.stderr)

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
