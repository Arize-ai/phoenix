import importlib.util
import os
import sys
import unittest

# Load module directly
file_path = os.path.join(
    os.path.dirname(__file__),
    "../metrics/production_debt.py",
)
spec = importlib.util.spec_from_file_location("phoenix_production_debt", file_path)
production_debt_mod = importlib.util.module_from_spec(spec)
sys.modules["phoenix_production_debt"] = production_debt_mod
spec.loader.exec_module(production_debt_mod)

ProductionDebtEvaluator = production_debt_mod.ProductionDebtEvaluator
TechnicalDueDiligenceLedger = production_debt_mod.TechnicalDueDiligenceLedger
GENESIS_HASH = production_debt_mod.GENESIS_HASH


class TestProductionDebtEvaluator(unittest.TestCase):
    def setUp(self) -> None:
        self.evaluator = ProductionDebtEvaluator(
            never_equate_intent_to_approval=True,
            max_acceptable_pdi=12.0,
        )

    def test_clean_trace_passes_production_readiness(self) -> None:
        report = self.evaluator.evaluate_trace(
            trace_id="tr_live_12345",
            total_tokens=1100,
            prompt_tokens=1000,
            latency_seconds=0.75,
            reasoning_loops=0,
            un_gated_mutations=0,
        )
        self.assertTrue(report.is_production_ready)
        self.assertLessEqual(report.pdi_score, 12.0)
        self.assertEqual(len(report.critical_smells), 0)
        self.assertTrue(bool(report.receipt_hash))

    def test_degraded_trace_fails_due_diligence_pdi(self) -> None:
        report = self.evaluator.evaluate_trace(
            trace_id="tr_degraded_67890",
            total_tokens=3500,  # High token inflation
            prompt_tokens=1000,
            latency_seconds=8.5,  # High latency
            reasoning_loops=4,  # Stuck in recursive reasoning loops
            un_gated_mutations=2,  # Un-gated database / tool mutations
        )
        self.assertFalse(report.is_production_ready)
        self.assertGreater(report.pdi_score, 50.0)
        self.assertIn("HIGH_TRACE_TOKEN_INFLATION_3.50X", report.critical_smells)
        self.assertIn("HIGH_TRAJECTORY_LATENCY_8.50S", report.critical_smells)
        self.assertIn("DETECTED_4_RECURSIVE_REASONING_LOOPS", report.critical_smells)
        self.assertIn("DETECTED_2_UNGATED_SPAN_MUTATIONS", report.critical_smells)

    def test_cryptographic_ledger_integrity(self) -> None:
        self.evaluator.evaluate_trace("trace-1")
        self.evaluator.evaluate_trace("trace-2")
        self.evaluator.evaluate_trace("trace-3")

        entries = self.evaluator.ledger.get_ledger_entries()
        self.assertEqual(len(entries), 3)
        self.assertEqual(entries[0]["prev_hash"], GENESIS_HASH)
        self.assertEqual(entries[1]["prev_hash"], entries[0]["curr_hash"])
        self.assertEqual(entries[2]["prev_hash"], entries[1]["curr_hash"])
        self.assertTrue(self.evaluator.ledger.verify_ledger_integrity())


if __name__ == "__main__":
    unittest.main()
