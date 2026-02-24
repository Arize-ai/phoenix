import {
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  Text,
  Video,
  View,
} from "@phoenix/components";

export function DatasetsEmpty() {
  return (
    <View width="100%" paddingY="size-400">
      <Flex
        direction="column"
        width="100%"
        alignItems="center"
        justifyContent="center"
      >
        <View width="100%" maxWidth="780px">
          <Flex direction="column" gap="size-400" alignItems="center">
            <Text size="XL">
              Create datasets for testing prompts, experimentation, and
              fine-tuning.
            </Text>
            <Video
              src="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/datasets.mp4"
              autoPlay
              muted
              loop
            />
            <Flex direction="row" gap="size-200">
              <ExternalLinkButton
                href="https://arize.com/docs/phoenix/datasets-and-experiments/how-to-datasets"
                target="_blank"
                leadingVisual={<Icon svg={<Icons.BookOutline />} />}
              >
                Documentation
              </ExternalLinkButton>
              <ExternalLinkButton
                href="https://arize.com/docs/phoenix/get-started/get-started-datasets-and-experiments"
                target="_blank"
                leadingVisual={<Icon svg={<Icons.Rocket />} />}
              >
                Quickstart
              </ExternalLinkButton>
            </Flex>
          </Flex>
        </View>
      </Flex>
    </View>
  );
}
