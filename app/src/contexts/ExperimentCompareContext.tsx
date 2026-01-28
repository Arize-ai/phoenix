import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { orderBy, range } from "lodash";

import { type AnnotationConfig } from "@phoenix/components/annotation";
import { ExperimentCompareDetailsQuery$data } from "@phoenix/components/experiment/__generated__/ExperimentCompareDetailsQuery.graphql";

type Experiment = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experiments"]
>["edges"][number]["experiment"];

type ExperimentRun = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["experimentRuns"]
>["edges"][number]["run"];

// ExperimentRepetition is a repetition that may or may not have an associated experiment run
type ExperimentRepetition = {
  experimentId: string;
  repetitionNumber: number;
  experimentRun?: ExperimentRun;
};

type AnnotationSummaries = NonNullable<
  ExperimentCompareDetailsQuery$data["dataset"]["experimentAnnotationSummaries"]
>;

type ReferenceOutput = NonNullable<
  ExperimentCompareDetailsQuery$data["example"]["revision"]
>["referenceOutput"];

type ExperimentRepetitionSelectionState = {
  experimentId: string;
  repetitionNumber: number;
  selected: boolean;
};

interface ExperimentCompareContextType {
  baseExperimentId: string;
  compareExperimentIds: string[];
  experimentsById: Record<string, Experiment>;
  experimentRepetitionsByExperimentId: Record<string, ExperimentRepetition[]>;
  annotationSummaries: AnnotationSummaries;
  annotationConfigs: readonly AnnotationConfig[];
  referenceOutput: ReferenceOutput;
  includeRepetitions: boolean;
  openTraceDialog: (traceId: string, projectId: string, title: string) => void;
  // Selection state
  selectedExperimentRepetitions: ExperimentRepetitionSelectionState[];
  referenceOutputSelected: boolean;
  toggleReferenceOutputSelected: () => void;
  updateExperimentSelection: (experimentId: string, checked: boolean) => void;
  updateRepetitionSelection: (
    experimentId: string,
    repetitionNumber: number,
    checked: boolean
  ) => void;
  toggleAllRepetitionsSelection: (checked: boolean) => void;
  // Sorting state
  selectedAnnotation: string | null;
  setSelectedAnnotation: (annotation: string | null) => void;
  sortDirection: "asc" | "desc";
  toggleSortDirection: () => void;
  // Computed state
  sortedExperimentRepetitions: {
    experimentId: string;
    experimentRepetitions: ExperimentRepetition[];
  }[];
  noRunsSelected: boolean;
}

const ExperimentCompareContext =
  createContext<ExperimentCompareContextType | null>(null);

export function ExperimentCompareDetailsProvider({
  children,
  baseExperimentId,
  compareExperimentIds,
  experimentsById,
  experimentRepetitionsByExperimentId,
  annotationSummaries,
  annotationConfigs,
  referenceOutput,
  includeRepetitions,
  openTraceDialog,
  defaultSelectedRepetitionNumber,
}: {
  children: ReactNode;
  baseExperimentId: string;
  compareExperimentIds: string[];
  experimentsById: Record<string, Experiment>;
  experimentRepetitionsByExperimentId: Record<string, ExperimentRepetition[]>;
  annotationSummaries: AnnotationSummaries;
  annotationConfigs: readonly AnnotationConfig[];
  referenceOutput: ReferenceOutput;
  includeRepetitions: boolean;
  openTraceDialog: (traceId: string, projectId: string, title: string) => void;
  defaultSelectedRepetitionNumber?: number;
}) {
  const experimentIds = useMemo(
    () => [baseExperimentId, ...compareExperimentIds],
    [baseExperimentId, compareExperimentIds]
  );

  // Selection state
  const [selectedExperimentRepetitions, setSelectedExperimentRepetitions] =
    useState<ExperimentRepetitionSelectionState[]>(() =>
      initializeSelectionState(
        experimentIds,
        baseExperimentId,
        experimentsById,
        defaultSelectedRepetitionNumber
      )
    );

  const [referenceOutputSelected, setReferenceOutputSelected] =
    useState<boolean>(true);
  const toggleReferenceOutputSelected = useCallback(() => {
    setReferenceOutputSelected((prev) => !prev);
  }, []);

  const updateExperimentSelection = useCallback(
    (experimentId: string, checked: boolean) => {
      setSelectedExperimentRepetitions((prev) =>
        prev.map((run) =>
          run.experimentId === experimentId
            ? { ...run, selected: checked }
            : run
        )
      );
    },
    []
  );

  const updateRepetitionSelection = useCallback(
    (experimentId: string, repetitionNumber: number, checked: boolean) => {
      setSelectedExperimentRepetitions((prev) =>
        prev.map((run) =>
          run.experimentId === experimentId &&
          run.repetitionNumber === repetitionNumber
            ? { ...run, selected: checked }
            : run
        )
      );
    },
    []
  );

  const toggleAllRepetitionsSelection = useCallback((checked: boolean) => {
    setSelectedExperimentRepetitions((prev) =>
      prev.map((run) => ({ ...run, selected: checked }))
    );
    setReferenceOutputSelected(checked);
  }, []);

  // Sorting state
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(
    null
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const toggleSortDirection = useCallback(() => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  // Computed state
  const sortedExperimentRepetitions = useMemo(() => {
    // when all experiments have a single repetition, we sort across experiments
    // otherwise, we sort within each experiment
    if (!includeRepetitions) {
      const allRepetitions = Object.values(
        experimentRepetitionsByExperimentId
      ).flat();
      const allRepetitionsSorted = selectedAnnotation
        ? sortRepetitionsByAnnotation(
            allRepetitions,
            selectedAnnotation,
            sortDirection
          )
        : allRepetitions;
      return allRepetitionsSorted.map((repetition) => ({
        experimentId: repetition.experimentId,
        experimentRepetitions: [repetition],
      }));
    }
    return experimentIds.map((experimentId) => {
      const experimentRepetitions =
        experimentRepetitionsByExperimentId[experimentId];
      const experimentRepetitionsSorted = selectedAnnotation
        ? sortRepetitionsByAnnotation(
            experimentRepetitions,
            selectedAnnotation,
            sortDirection
          )
        : experimentRepetitions;
      return {
        experimentId,
        experimentRepetitions: experimentRepetitionsSorted,
      };
    });
  }, [
    experimentIds,
    experimentRepetitionsByExperimentId,
    selectedAnnotation,
    includeRepetitions,
    sortDirection,
  ]);

  const noRunsSelected = useMemo(() => {
    const noExperimentRunsSelected = selectedExperimentRepetitions.every(
      (run) => !run.selected
    );
    const noReferenceOutputSelected =
      !referenceOutput || !referenceOutputSelected;
    return noExperimentRunsSelected && noReferenceOutputSelected;
  }, [selectedExperimentRepetitions, referenceOutput, referenceOutputSelected]);

  const contextValue: ExperimentCompareContextType = {
    baseExperimentId,
    compareExperimentIds,
    experimentsById,
    experimentRepetitionsByExperimentId,
    annotationSummaries,
    annotationConfigs,
    referenceOutput,
    includeRepetitions,
    openTraceDialog,
    selectedExperimentRepetitions,
    referenceOutputSelected,
    toggleReferenceOutputSelected,
    updateExperimentSelection,
    updateRepetitionSelection,
    toggleAllRepetitionsSelection,
    selectedAnnotation,
    setSelectedAnnotation,
    sortDirection,
    toggleSortDirection,
    sortedExperimentRepetitions,
    noRunsSelected,
  };

  return (
    <ExperimentCompareContext.Provider value={contextValue}>
      {children}
    </ExperimentCompareContext.Provider>
  );
}

export function useExperimentCompareDetailsContext() {
  const context = useContext(ExperimentCompareContext);
  if (!context) {
    throw new Error(
      "useExperimentCompareDetailsContext must be used within ExperimentCompareDetailsProvider"
    );
  }
  return context;
}

export type {
  Experiment,
  ExperimentRun,
  ExperimentRepetition,
  AnnotationSummaries,
  ExperimentRepetitionSelectionState,
};

// Helper functions
function initializeSelectionState(
  experimentIds: string[],
  baseExperimentId: string,
  experimentsById: Record<string, Experiment>,
  defaultSelectedRepetitionNumber?: number
): ExperimentRepetitionSelectionState[] {
  return experimentIds.flatMap((experimentId) => {
    const experiment = experimentsById[experimentId];
    return range(experiment.repetitions).map((repetitionIndex) => {
      const repetitionNumber = repetitionIndex + 1;
      return {
        experimentId,
        repetitionNumber,
        selected:
          experimentId === baseExperimentId &&
          defaultSelectedRepetitionNumber !== undefined
            ? repetitionNumber === defaultSelectedRepetitionNumber
            : true,
      };
    });
  });
}

export function getAnnotationValue(
  experimentRepetition: ExperimentRepetition,
  annotationName: string
): ExperimentRun["annotations"]["edges"][number]["annotation"] | null {
  return (
    experimentRepetition.experimentRun?.annotations.edges.find(
      (edge) => edge.annotation.name === annotationName
    )?.annotation ?? null
  );
}

function sortRepetitionsByAnnotation(
  experimentRepetitions: ExperimentRepetition[],
  annotation: string,
  sortDirection: "asc" | "desc"
): ExperimentRepetition[] {
  return orderBy(
    experimentRepetitions,
    (rep) => {
      const annotationValue = getAnnotationValue(rep, annotation);
      return [
        annotationValue?.score,
        annotationValue?.label,
        rep.repetitionNumber,
      ];
    },
    sortDirection
  );
}

export function areAllExperimentRunsSelected(
  experimentId: string,
  selectedExperimentRepetitions: ExperimentRepetitionSelectionState[]
): boolean {
  return selectedExperimentRepetitions
    .filter((run) => run.experimentId === experimentId)
    .every((run) => run.selected);
}

export function areSomeExperimentRunsSelected(
  experimentId: string,
  selectedExperimentRepetitions: ExperimentRepetitionSelectionState[]
): boolean {
  return selectedExperimentRepetitions
    .filter((run) => run.experimentId === experimentId)
    .some((run) => run.selected);
}
