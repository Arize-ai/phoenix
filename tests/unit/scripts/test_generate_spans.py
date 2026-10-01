import subprocess
import sys
import unittest
from unittest.mock import patch

from scripts.generate_data_via_plpgsql import generate_spans


class TestGenerateSpans(unittest.TestCase):
    def test_parse_arguments_rejects_nonpositive_project_count(self) -> None:
        with patch.object(sys, "argv", ["generate_spans.py", "--num-projects", "0"]):
            with self.assertRaises(SystemExit) as error:
                generate_spans.parse_arguments()
        self.assertEqual(error.exception.code, 2)

    def test_sql_script_passes_project_settings_to_postgres(self) -> None:
        with (
            patch.dict("os.environ", {"PGOPTIONS": "-c statement_timeout=1000"}),
            patch.object(
                generate_spans.subprocess,
                "run",
                return_value=subprocess.CompletedProcess([], 0),
            ) as run,
        ):
            self.assertTrue(
                generate_spans.run_sql_script(
                    "postgres",
                    "postgres",
                    "localhost",
                    5432,
                    "phoenix",
                    "generate_spans.sql",
                    3,
                    5,
                    6,
                )
            )

        command = run.call_args.args[0]
        env = run.call_args.kwargs["env"]
        self.assertEqual(command[-4:], ["-v", "ON_ERROR_STOP=1", "-f", "generate_spans.sql"])
        self.assertEqual(
            env["PGOPTIONS"],
            "-c statement_timeout=1000 -c phoenix_generate.num_traces=3 "
            "-c phoenix_generate.num_projects=5 -c phoenix_generate.trace_offset=6",
        )

    def test_batches_continue_project_rotation(self) -> None:
        with (
            patch.object(
                sys, "argv", ["generate_spans.py", "--num-batches", "3", "--traces-per-batch", "2"]
            ),
            patch.object(generate_spans, "run_sql_script", return_value=True) as run,
        ):
            generate_spans.main()

        batches = run.call_args_list[:-1]
        self.assertEqual([call.kwargs["trace_offset"] for call in batches], [0, 2, 4])
        self.assertTrue(all(call.kwargs["num_projects"] == 5 for call in batches))
        self.assertTrue(all(call.args[-1] == 2 for call in batches))
        self.assertEqual(run.call_args_list[-1].kwargs, {"print_output": True})
