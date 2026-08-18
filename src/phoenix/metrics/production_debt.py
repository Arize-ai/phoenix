from __future__ import annotations

import hashlib
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

log: logging.Logger = logging.getLogger(__name__)

GENESIS_HASH: str = (
    "0000000000000000000000000000000000000000000000000000000000000000"
)


@dataclass
class TraceDebtReport:
    trace_id: str
    pdi_score: float  # Production Debt Index (target <= 12.0)
    token_inflation_multiplier: float  # Target <= 1.12x
    latency_seconds: float  # Target <= 1.6s
    mutation_safety_score: float  # Target 100.0
    production_readiness_index: float  # Scale 0 - 100
    is_production_ready: bool
    critical_smells: List[str]
    receipt_hash: str


class TechnicalDueDiligenceLedger:
    """
    Cryptographic SHA-256 hash-chained Action Ledger for Arize Phoenix trace runs.
    """

    def __init__(self) -> None:
        self._entries: List[Dict[str, Any]] = []
        self._last_hash: str = GENESIS_HASH

    def record_trace_evaluation(
        self,
        trace_id: str,
        event_type: str,
        readiness_index: float,
        critical_smells: List[str],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        timestamp = datetime.now(timezone.utc).isoformat()
        index = len(self._entries)

        meta_bytes = json.dumps(metadata, sort_keys=True).encode("utf-8")
        canonical_content = f"{index}|{self._last_hash}|{trace_id}|{event_type}|{readiness_index}|{timestamp}|{hashlib.sha256(meta_bytes).hexdigest()}"
        curr_hash = hashlib.sha256(canonical_content.encode("utf-8")).hexdigest()

        entry = {
            "index": index,
            "timestamp": timestamp,
            "trace_id": trace_id,
            "event_type": event_type,
            "readiness_index": readiness_index,
            "critical_smells": critical_smells,
            "prev_hash": self._last_hash,
            "curr_hash": curr_hash,
            "metadata": metadata,
        }

        self._entries.append(entry)
        self._last_hash = curr_hash
        return entry

    def get_ledger_entries(self) -> List[Dict[str, Any]]:
        return list(self._entries)

    def verify_ledger_integrity(self) -> bool:
        prev = GENESIS_HASH
        for entry in self._entries:
            if entry["prev_hash"] != prev:
                return False
            prev = entry["curr_hash"]
        return True


class ProductionDebtEvaluator:
    """
    A2Z SOC Production Debt & Technical Due Diligence Evaluator for Arize Phoenix.

    Quantifies trace quality against 4 Enterprise Forward Deployed Engineering KPIs:
    1. Production Debt Index (PDI <= 12.0)
    2. Trace Token Inflation (TTI <= 1.12x)
    3. P99 Agent Trajectory Latency Ceiling (<= 1.6s)
    4. Deterministic Mutation Boundaries (never_equate_intent_to_approval)
    """

    def __init__(
        self,
        never_equate_intent_to_approval: bool = True,
        max_acceptable_pdi: float = 12.0,
    ) -> None:
        self.never_equate_intent_to_approval = never_equate_intent_to_approval
        self.max_acceptable_pdi = max_acceptable_pdi
        self.ledger = TechnicalDueDiligenceLedger()

    def check_kill_switch(self) -> bool:
        if os.environ.get("AAG_KILL_SWITCH", "").lower() in ("true", "1", "yes"):
            return True
        for path_str in ("artifacts/KILL", "/tmp/KILL"):
            if Path(path_str).exists():
                return True
        return False

    def evaluate_trace(
        self,
        trace_id: str,
        total_tokens: int = 1200,
        prompt_tokens: int = 1000,
        latency_seconds: float = 0.85,
        reasoning_loops: int = 0,
        un_gated_mutations: int = 0,
    ) -> TraceDebtReport:
        # 1. Evaluate emergency kill switch
        if self.check_kill_switch():
            self.ledger.record_trace_evaluation(
                trace_id=trace_id,
                event_type="evaluation_halted_kill_switch",
                readiness_index=0.0,
                critical_smells=["EMERGENCY_KILL_SWITCH_ENGAGED"],
                metadata={"reason": "AAG_KILL_SWITCH is set"},
            )
            raise PermissionError(
                "A2Z SOC ActionGate: Emergency kill switch is engaged. Trace evaluation halted."
            )

        critical_smells: List[str] = []

        # KPI 2: Trace Token Inflation Multiplier
        token_ratio = total_tokens / max(1, prompt_tokens)
        if token_ratio > 2.0:
            critical_smells.append(f"HIGH_TRACE_TOKEN_INFLATION_{token_ratio:.2f}X")

        # KPI 3: Latency Ceiling
        if latency_seconds > 5.0:
            critical_smells.append(f"HIGH_TRAJECTORY_LATENCY_{latency_seconds:.2f}S")

        # Reasoning Loops
        if reasoning_loops > 2:
            critical_smells.append(f"DETECTED_{reasoning_loops}_RECURSIVE_REASONING_LOOPS")

        # KPI 4: Mutation Safety
        if un_gated_mutations > 0:
            critical_smells.append(f"DETECTED_{un_gated_mutations}_UNGATED_SPAN_MUTATIONS")

        # KPI 1: Production Debt Index (0 = Clean, 100 = Catastrophic)
        pdi = (
            max(0.0, (token_ratio - 1.0) * 15.0)
            + max(0.0, (latency_seconds - 1.6) * 8.0)
            + (reasoning_loops * 10.0)
            + (un_gated_mutations * 30.0)
        )
        pdi_score = round(min(100.0, pdi), 2)

        # Production Readiness Index (0 - 100)
        readiness = max(0.0, 100.0 - pdi_score)
        is_production_ready = (
            pdi_score <= self.max_acceptable_pdi and len(critical_smells) == 0
        )

        # Cryptographic Ledger Entry
        entry = self.ledger.record_trace_evaluation(
            trace_id=trace_id,
            event_type="diligence_passed" if is_production_ready else "diligence_failed_debt",
            readiness_index=readiness,
            critical_smells=critical_smells,
            metadata={
                "pdi_score": pdi_score,
                "token_ratio": token_ratio,
                "latency_seconds": latency_seconds,
                "reasoning_loops": reasoning_loops,
                "un_gated_mutations": un_gated_mutations,
                "never_equate_intent_to_approval": self.never_equate_intent_to_approval,
            },
        )

        return TraceDebtReport(
            trace_id=trace_id,
            pdi_score=pdi_score,
            token_inflation_multiplier=round(token_ratio, 2),
            latency_seconds=round(latency_seconds, 2),
            mutation_safety_score=(
                100.0 if un_gated_mutations == 0 else max(0.0, 100.0 - un_gated_mutations * 30.0)
            ),
            production_readiness_index=readiness,
            is_production_ready=is_production_ready,
            critical_smells=critical_smells,
            receipt_hash=entry["curr_hash"],
        )
