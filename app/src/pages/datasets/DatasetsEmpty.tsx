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
        <View width="780px">
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
                href="https://docs.arize.com/phoenix/datasets-and-experiments/overview-datasets"
                target="_blank"
                leadingVisual={<Icon svg={<Icons.BookOutline />} />}
              >
                Documentation
              </ExternalLinkButton>
              <ExternalLinkButton
                href="https://colab.research.google.com/github/arize-ai/phoenix/blob/main/tutorials/experiments/datasets_and_experiments_quickstart.ipynb"
                target="_blank"
                leadingVisual={<Icon svg={<Icons.Rocket />} />}
              >
                Quckstart
              </ExternalLinkButton>
            </Flex>
          </Flex>
        </View>
      </Flex>
    </View>
  );
}
