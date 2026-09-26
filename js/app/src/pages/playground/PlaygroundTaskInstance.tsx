import { Suspense } from "react";

import { Flex, Loading, View } from "@phoenix/components";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";

import { EvaluatorTaskEditor } from "./evaluators";
import { PlaygroundTemplate } from "./PlaygroundTemplate";
import { TaskMenu } from "./TaskMenu";
import { usePlaygroundInstanceSourceLoader } from "./usePlaygroundInstanceSourceLoader";

/**
 * One column of the task panel: the prompt editor or the evaluator editor,
 * by the instance's kind, or a placeholder while a saved task is fetched.
 */
export function PlaygroundTaskInstance({
  instanceId,
  datasetId,
  splitIds,
  appendedMessagesPath,
  availablePaths,
}: {
  instanceId: number;
  datasetId: string | null;
  splitIds?: string[];
  appendedMessagesPath?: string | null;
  availablePaths: string[] | undefined;
}) {
  usePlaygroundInstanceSourceLoader(instanceId);

  const taskKind = usePlaygroundContext(
    (state) => selectPlaygroundInstance(instanceId)(state)?.task.kind
  );

  const isLoading = usePlaygroundContext(
    (state) =>
      selectPlaygroundInstance(instanceId)(state)?.loadingSource != null
  );

  if (taskKind == null) {
    return null;
  }

  if (isLoading) {
    return <PlaygroundInstanceLoading instanceId={instanceId} />;
  }

  if (taskKind === "evaluator") {
    return (
      <Suspense fallback={<Loading size="S" />}>
        <EvaluatorTaskEditor
          instanceId={instanceId}
          datasetId={datasetId}
          splitIds={splitIds}
        />
      </Suspense>
    );
  }

  return (
    <PlaygroundTemplate
      playgroundInstanceId={instanceId}
      appendedMessagesPath={appendedMessagesPath}
      availablePaths={availablePaths}
      taskMenu
    />
  );
}

/** Keeps the task's header in place while its content is fetched. */
function PlaygroundInstanceLoading({ instanceId }: { instanceId: number }) {
  const index = usePlaygroundContext((state) =>
    state.instances.findIndex((instance) => instance.id === instanceId)
  );

  return (
    <Flex direction="column" gap="size-100">
      <Flex direction="row" gap="size-100" alignItems="center">
        <View flex="none">
          <AlphabeticIndexIcon index={index} />
        </View>
        <TaskMenu instanceId={instanceId} />
      </Flex>
      <View paddingY="size-400">
        <Loading size="S" />
      </View>
    </Flex>
  );
}
