from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.trace import ReadableSpan
from phoenix.trace import enable_tracing


def test_enable_tracing_can_dynamically_modify_resource_project():
    # all spans created while managed by `enable_tracing` will have their project name
    # dynamically overridden
    pre_override = ReadableSpan(name="pre-override")
    with enable_tracing(project_name="override-project"):
        with_override = ReadableSpan(name="override")
    post_override = ReadableSpan(name="post-override")
    assert ResourceAttributes.PROJECT_NAME not in pre_override.resource.attributes
    assert with_override.resource.attributes[ResourceAttributes.PROJECT_NAME] == "override-project"
    assert ResourceAttributes.PROJECT_NAME not in post_override.resource.attributes
