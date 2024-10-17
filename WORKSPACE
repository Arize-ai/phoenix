workspace(name = "phoenix")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
http_archive(
    name = "rules_python",
    sha256 = "ca77768989a7f311186a29747e3e95c936a41dffac779aff6b443db22290d913",
    strip_prefix = "rules_python-0.36.0",
    url = "https://github.com/bazelbuild/rules_python/releases/download/0.36.0/rules_python-0.36.0.tar.gz",
)
http_archive(
    name = "aspect_rules_py",
    sha256 = "a032348de4508b94d30a13bce39d24e9170036ad2a16911127409b9dae7d453c",
    strip_prefix = "rules_py-0.9.1",
    url = "https://github.com/aspect-build/rules_py/releases/download/v0.9.1/rules_py-v0.9.1.tar.gz",
)
http_archive(
    name = "aspect_bazel_lib",
    sha256 = "0e31778f1fd574d2c05d238bfc4c785fa4b7e50a5ef38b506e01cfd8ec2fccb3",
    strip_prefix = "bazel-lib-2.9.2",
    url = "https://github.com/bazel-contrib/bazel-lib/releases/download/v2.9.2/bazel-lib-v2.9.2.tar.gz",
)

load("@aspect_bazel_lib//lib:repositories.bzl", "aspect_bazel_lib_dependencies", "aspect_bazel_lib_register_toolchains")

# Required bazel-lib dependencies

aspect_bazel_lib_dependencies()

# Register bazel-lib toolchains

aspect_bazel_lib_register_toolchains()

# "Installation" for rules_python
load("@rules_python//python:repositories.bzl", "py_repositories", "python_register_toolchains")
# Fetches the rules_py dependencies.
# If you want to have a different version of some dependency,
# you should fetch it *before* calling this.
# Alternatively, you can skip calling this function, so long as you've
# already fetched all the dependencies.
load("@aspect_rules_py//py:repositories.bzl", "rules_py_dependencies")
load("@aspect_rules_py//py:toolchains.bzl", "rules_py_toolchains")


rules_py_dependencies()

rules_py_toolchains()

python_register_toolchains(
    name = "python_toolchain",
    python_version = "3.9",
)

py_repositories()
