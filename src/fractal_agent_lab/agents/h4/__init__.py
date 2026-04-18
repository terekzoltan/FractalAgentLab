from fractal_agent_lab.agents.h4.pack import (
    build_h4_seq_next_agent_pack,
    build_h4_seq_next_agent_specs,
    build_h4_wave_start_agent_pack,
    build_h4_wave_start_agent_specs,
    validate_h4_seq_next_agent_specs,
    validate_h4_wave_start_agent_specs,
)
from fractal_agent_lab.agents.h4.prompts import H4_SEQ_NEXT_PROMPT_VERSION, H4_WAVE_START_PROMPT_VERSION
from fractal_agent_lab.agents.h4.roles import (
    H4_SEQ_NEXT_AGENT_IDS,
    H4_WAVE_START_AGENT_IDS,
    H4SeqNextRole,
    H4WaveStartRole,
)

H4_WAVE_START_AGENT_IDS_LIST = tuple(H4_WAVE_START_AGENT_IDS.values())
H4_SEQ_NEXT_AGENT_IDS_LIST = tuple(H4_SEQ_NEXT_AGENT_IDS.values())

__all__ = [
    "H4_SEQ_NEXT_AGENT_IDS",
    "H4_SEQ_NEXT_AGENT_IDS_LIST",
    "H4_SEQ_NEXT_PROMPT_VERSION",
    "H4_WAVE_START_AGENT_IDS",
    "H4_WAVE_START_AGENT_IDS_LIST",
    "H4_WAVE_START_PROMPT_VERSION",
    "H4SeqNextRole",
    "H4WaveStartRole",
    "build_h4_seq_next_agent_pack",
    "build_h4_seq_next_agent_specs",
    "build_h4_wave_start_agent_pack",
    "build_h4_wave_start_agent_specs",
    "validate_h4_seq_next_agent_specs",
    "validate_h4_wave_start_agent_specs",
]
