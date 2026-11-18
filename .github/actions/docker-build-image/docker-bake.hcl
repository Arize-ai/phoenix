variable "SOURCE_DIR" { default = "." }
variable "STARTUP_AND_DATA_DIR" { default = "" }
variable "PLATFORM" {}
variable "BASE_IMAGE" {}
variable "ARCHIVE_PATH" {}

target "application" {
  context    = SOURCE_DIR
  dockerfile = "Dockerfile"
  args       = { BASE_IMAGE = BASE_IMAGE }
  platforms  = [PLATFORM]
  output     = ["type=oci,dest=${ARCHIVE_PATH}"]
}

target "preview" {
  context    = STARTUP_AND_DATA_DIR
  dockerfile = "Dockerfile"
  contexts = {
    application = "target:application"
  }
  platforms = [PLATFORM]
  output    = ["type=oci,dest=${ARCHIVE_PATH}"]
}
