variable "BUILD_CONTEXT" { default = "." }
variable "PREVIEW_CONTEXT" { default = "" }
variable "SEED_CONTEXT" { default = "" }
variable "PLATFORM" {}
variable "BASE_IMAGE" {}
variable "ARCHIVE_PATH" {}

target "application" {
  context    = BUILD_CONTEXT
  dockerfile = "Dockerfile"
  args       = { BASE_IMAGE = BASE_IMAGE }
  platforms  = [PLATFORM]
  output     = ["type=oci,dest=${ARCHIVE_PATH}"]
}

target "preview" {
  context    = PREVIEW_CONTEXT
  dockerfile = "Dockerfile"
  contexts = {
    application = "target:application"
    seed        = SEED_CONTEXT
  }
  platforms = [PLATFORM]
  output    = ["type=oci,dest=${ARCHIVE_PATH}"]
}
