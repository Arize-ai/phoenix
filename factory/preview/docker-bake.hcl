// Builds one PR's preview image. The PR's own Dockerfile stages that the preview needs,
// its frontend and, when no published image matches its dependencies, the whole image,
// are bake targets passed to the preview as `target:` contexts, so they stay on the
// builder instead of round-tripping through a registry. Every path is absolute because
// the workflow runs this from a directory that holds both checkouts.

variable "HEAD_DIR" {}      // the PR's checkout
variable "PREVIEW_DIR" {}   // factory/preview from the base branch
variable "SEED_DIR" {}      // holds seed.py
variable "BASE_CONTEXT" {}  // docker-image://<published image> or target:base
variable "FRONTEND_CONTEXT" {} // target:frontend, or any image when STATIC_SOURCE is base
variable "STATIC_SOURCE" { default = "base" }
variable "TAGS" { default = "" } // comma-separated
variable "SOURCE_URL" { default = "" }
variable "REVISION" { default = "" }

// The published commit images are the root variant, so the full build is too: a preview
// should not change user and HOME with an unrelated dependency bump.
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
