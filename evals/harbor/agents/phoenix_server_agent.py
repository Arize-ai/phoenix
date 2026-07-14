"""Harbor adapter for Phoenix's in-process ServerAgent."""

import shlex

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


class PhoenixServerAgent(BaseAgent):
    SUPPORTS_ATIF: bool = True

    @staticmethod
    def name() -> str:
        return "phoenix-server-agent"

    def version(self) -> str | None:
        return "8"

    async def setup(self, environment: BaseEnvironment) -> None:
        return None

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        encoded = shlex.quote(instruction)
        model = str(
            getattr(self, "model_name", None)
            or getattr(self, "model", "anthropic/claude-sonnet-4-5")
        ).replace("anthropic/", "anthropic:", 1)
        # Harbor archives /logs/agent into a per-step directory after every
        # step, so trial-wide state (step counter, conversation history) must
        # live on the container filesystem instead. step-config.json is
        # uploaded from the step's workdir into the exec working directory.
        command = f"""sh /opt/phoenix-eval/bootstrap_data.sh
printf %s {encoded} > /tmp/instruction.md
config=$(cat step-config.json 2>/dev/null || printf '%s' '{{\"allow_mutations\": false}}')
state=/var/lib/phoenix-eval
mkdir -p "$state" /logs/agent/steps
n=$(($(cat "$state/step_counter" 2>/dev/null || printf 0) + 1))
printf %s "$n" > "$state/step_counter"
mutation_flag=""
if printf %s "$config" | grep -q '"allow_mutations"[[:space:]]*:[[:space:]]*true'; then mutation_flag="--allow-mutations"; fi
python /opt/phoenix-eval/run_server_agent.py --db-path /data/phoenix.db --instruction-file /tmp/instruction.md --model {shlex.quote(model)} --out-dir "/logs/agent/steps/$n" --history-file "$state/messages.json" --trajectory-file /logs/agent/trajectory.json $mutation_flag
ln -sfn "/logs/agent/steps/$n" /logs/agent/latest
cp "/logs/agent/steps/$n/messages.json" "$state/messages.json"
cat /logs/agent/latest/answer.md"""
        result = await environment.exec(command)
        if result.return_code != 0:
            raise RuntimeError(
                result.stderr
                or result.stdout
                or f"Phoenix ServerAgent runner failed with code {result.return_code}"
            )
        context.metadata = {"answer": result.stdout or ""}
