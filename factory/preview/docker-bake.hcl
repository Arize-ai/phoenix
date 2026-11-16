variable "HEAD_DIR" {}
variable "PREVIEW_DIR" {}
variable "SEED_DIR" {}
variable "BASE_CONTEXT" {}  // docker-image://<published image> or target:base
variable "FRONTEND_CONTEXT" {} // target:frontend, or any image when STATIC_SOURCE is base
variable "STATIC_SOURCE" { default = "base" }
variable "TAGS" { default = "" }
variable "SOURCE_URL" { default = "" }
variable "REVISION" { default = "" }

// The root variant, like the published commit images, so user and HOME never depend on
// whether a dependency bump forced a full build.
target "base" {
  context    = HEAD_DIR
  dockerfile = "Dockerfile"
  args       = { BASE_IMAGE = "gcr.io/distroless/python3-debian13" }
  platforms  = ["linux/amd64"]
}

target "frontend" {
  context    = HEAD_DIR
  dockerfile = "Dockerfile"
  target     = "frontend-builder"
  platforms  = ["linux/amd64"]
}

target "preview" {
  context    = HEAD_DIR
  dockerfile = "${PREVIEW_DIR}/Dockerfile"
  contexts = {
    base-image = BASE_CONTEXT
    frontend   = FRONTEND_CONTEXT
    preview    = PREVIEW_DIR
    seed       = SEED_DIR
  }
  args = {
    STATIC_SOURCE = STATIC_SOURCE
  }
  tags      = compact(split(",", TAGS))
  labels = {
    "org.opencontainers.image.source"   = SOURCE_URL
    "org.opencontainers.image.revision" = REVISION
  }
  platforms = ["linux/amd64"]
  attest    = ["type=provenance,disabled=true"]
}
