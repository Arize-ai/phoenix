# This Dockerfile is provided for convenience if you wish to run Phoenix in a
# container or sidecar. To build the image, run the following commmand:
# 
# > docker build -t phoenix
#
# You can then run the image in the background with:
#
# > docker run -d --name phoenix -p 6006:6006 phoenix
#
# or in the foreground with:
#
# > docker run -it -p 6006:6006 phoenix
# 
# How are you using Phoenix in production? Let us know!
#
# To get support or provide feedback, contact the team in the #phoenix-support
# channel in the Arize AI Slack community or file an issue on GitHub:
#
# - https://join.slack.com/t/arize-ai/shared_invite/zt-1px8dcmlf-fmThhDFD_V_48oU7ALan4Q
# - https://github.com/Arize-ai/phoenix/issues

# This Dockerfile is a multi-stage build. The first stage builds the frontend.
FROM node:20-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /phoenix/app/
COPY ./app /phoenix/app
RUN pnpm install
RUN pnpm run build

# The second stage builds the backend.
FROM python:3.11-bullseye as backend-builder
WORKDIR /phoenix
COPY ./ /phoenix/
COPY --from=frontend-builder /phoenix/src/phoenix/server/static/ /phoenix/src/phoenix/server/static/
# Delete symbolic links used during development.
RUN find src/ -xtype l -delete  
RUN pip install --target ./env .[container, pg]

# The production image is distroless, meaning that it is a minimal image that
# contains only the necessary dependencies to run the application. This is
# useful for security and performance reasons. If you need to debug the
# container, you can build from the debug image instead and run
#
# > docker run --entrypoint=sh -it phoenix
#
# to enter a shell. For more information, see:
#
# https://github.com/GoogleContainerTools/distroless?tab=readme-ov-file#debug-images
#
# Append :debug to the following line to build the debug image.
FROM gcr.io/distroless/python3-debian12
WORKDIR /phoenix
COPY --from=backend-builder /phoenix/env/ ./env
ENV PYTHONPATH="/phoenix/env:$PYTHONPATH"
# Export the Phoenix port.
EXPOSE 6006
# Export the Prometheus port.
EXPOSE 9090
# Run the Phoenix server. Note that the ENTRYPOINT of the base image invokes
# Python, so no explicit invocation of Python is needed here. See
# https://github.com/GoogleContainerTools/distroless/blob/16dc4a6a33838006fe956e4c19f049ece9c18a8d/python3/BUILD#L55
CMD ["-m", "phoenix.server.main", "--host", "0.0.0.0", "--port", "6006", "--enable-prometheus", "True", "serve"]
