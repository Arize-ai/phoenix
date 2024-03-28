# This Dockerfile is provided for convenience if you wish to run Phoenix in a
# container or sidecar. To use this Dockerfile, you must first build the Phoenix
# image using the following command:
# 
# > docker build -t phoenix
#
# You can then run the image with the following command:
#
# > docker run -d --name phoenix -p 6006:6006 phoenix
# 
# If you have a production use-case for phoenix, please get in touch!


# This Dockerfile is a multi-stage build. The first stage builds the frontend.
FROM node:20-slim AS frontend-builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY ./ /phoenix/
WORKDIR /phoenix/app/
RUN pnpm install
RUN pnpm run build

# The second stage builds the backend.
FROM python:3.11-bullseye as backend-builder
WORKDIR /phoenix
COPY ./ /phoenix/
COPY --from=frontend-builder /phoenix/ /phoenix/
# Delete symbolic links used during development.
RUN find src/ -xtype l -delete  
RUN pip install --target ./env .[container]

# The production image is distroless, meaning that it is a minimal image that
# contains only the necessary dependencies to run the application. This is
# useful for security and performance reasons. If you need to debug the
# container, you can build from the debug image instead and run
#
# > docker run --entrypoint=sh -it phoenix
#
# For more information, see:
#
# https://github.com/GoogleContainerTools/distroless?tab=readme-ov-file#debug-images
#
# Append :debug to the following line to use the debug image.
FROM python:3.11-bullseye
WORKDIR /phoenix
COPY --from=backend-builder /phoenix/env/ ./
# Export the Phoenix port.
EXPOSE 6006
# Export the Prometheus port.
EXPOSE 9090
# Run the Phoenix server.
CMD ["python", "-m", "phoenix.server.main", "--host", "0.0.0.0", "--port", "6006", "--enable-prometheus", "True", "serve"]
