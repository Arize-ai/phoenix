from openinference.semconv.resource import ResourceAttributes
from opentelemetry.sdk.trace import ReadableSpan
from phoenix.trace import using_project


def test_enable_tracing_can_dynamically_modify_resource_project():
    # all spans created while managed by `using_project` will have their project name
    # dynamically overridden
    pre_override = ReadableSpan(name="pre-override")
    with using_project(project_name="override-project"):
        with_override = ReadableSpan(name="override")
    post_override = ReadableSpan(name="post-override")
    assert ResourceAttributes.PROJECT_NAME not in pre_override.resource.attributes
    assert with_override.resource.attributes[ResourceAttributes.PROJECT_NAME] == "override-project"
    assert ResourceAttributes.PROJECT_NAME not in post_override.resource.attributes


def test_nested_project_overrides():
    with using_project(project_name="project1"):
        with_override = ReadableSpan(name="override")
        with using_project(project_name="project2"):
            nested_override = ReadableSpan(name="nested-override")
        post_nested_override = ReadableSpan(name="post-nested-override")
    assert with_override.resource.attributes[ResourceAttributes.PROJECT_NAME] == "project1"
    assert nested_override.resource.attributes[ResourceAttributes.PROJECT_NAME] == "project2"
    assert post_nested_override.resource.attributes[ResourceAttributes.PROJECT_NAME] == "project1"
