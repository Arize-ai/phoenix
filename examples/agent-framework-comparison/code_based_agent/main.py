from router import router
import gradio as gr
from utils.instrument import instrument, Framework
from opentelemetry import trace
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from openinference.semconv.trace import SpanAttributes

def gradio_interface(message, history):
    tracer = trace.get_tracer(__name__)
    with tracer.start_as_current_span("code_based_agent") as span:
        span.set_attribute(SpanAttributes.INPUT_VALUE, message)
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "AGENT")

        message = [{"role": "user", "content": message}]
        context = {}
        TraceContextTextMapPropagator().inject(context)
        agent_response = router(message, context)
        span.set_attribute(SpanAttributes.OUTPUT_VALUE, agent_response)
        span.set_status(trace.Status(trace.StatusCode.OK))
        return agent_response

def launch_app():
    iface = gr.ChatInterface(fn=gradio_interface, title="Data Analyst Agent")
    iface.launch()

if __name__ == "__main__":
    instrument(project_name="code-based-agent", framework=Framework.CODE_BASED)
    launch_app()