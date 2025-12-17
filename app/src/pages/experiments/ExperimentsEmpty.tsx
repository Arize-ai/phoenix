import {
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  Text,
  Video,
  View,
} from "@phoenix/components";

import { RunDatasetExperimentButton } from "../dataset/RunDatasetExperimentButton";

export function ExperimentsEmpty() {
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
              Run experiments to evaluate and improve your AI applications.
            </Text>
            <Video
              src="https://storage.googleapis.com/arize-phoenix-assets/assets/videos/experiments.mp4"
              autoPlay
              muted
              loop
            />
            <Flex direction="row" gap="size-200">
              <ExternalLinkButton
                href="https://docs.arize.com/phoenix/datasets-and-experiments/how-to-experiments/run-experiments"
                target="_blank"
                leadingVisual={<Icon svg={<Icons.BookOutline />} />}
              >
                Documentation
              </ExternalLinkButton>
              <ExternalLinkButton
                href="https://docs.arize.com/phoenix/cookbook/datasets-and-experiments/summarization"
                target="_blank"
                leadingVisual={<Icon svg={<Icons.BulbOutline />} />}
              >
                Example
              </ExternalLinkButton>
              <RunDatasetExperimentButton variant="primary" size="M" />
            </Flex>
          </Flex>
        </View>
      </Flex>
    </View>
  );
}
