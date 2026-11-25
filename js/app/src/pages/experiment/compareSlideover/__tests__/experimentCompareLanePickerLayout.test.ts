import { partitionPickerExperiments } from "../experimentCompareLanePickerLayout";

const experimentIds = ["b", "c", "d", "e", "f"];

describe("partitionPickerExperiments", () => {
  it("keeps every experiment a chip when they fit", () => {
    expect(
      partitionPickerExperiments({
        experimentIds,
        selectedExperimentId: "b",
        availableWidth: 540,
      })
    ).toEqual({ chipExperimentIds: experimentIds, overflowExperimentIds: [] });
  });

  it("moves the experiments that do not fit into the overflow menu", () => {
    expect(
      partitionPickerExperiments({
        experimentIds,
        selectedExperimentId: "b",
        availableWidth: 420,
      })
    ).toEqual({
      chipExperimentIds: ["b", "c", "d"],
      overflowExperimentIds: ["e", "f"],
    });
  });

  it("keeps a selected experiment that would overflow as the last chip", () => {
    expect(
      partitionPickerExperiments({
        experimentIds,
        selectedExperimentId: "f",
        availableWidth: 420,
      })
    ).toEqual({
      chipExperimentIds: ["b", "c", "f"],
      overflowExperimentIds: ["d", "e"],
    });
  });

  it("shows only the selected chip when nothing else fits", () => {
    expect(
      partitionPickerExperiments({
        experimentIds,
        selectedExperimentId: "d",
        availableWidth: 200,
      })
    ).toEqual({
      chipExperimentIds: ["d"],
      overflowExperimentIds: ["b", "c", "e", "f"],
    });
  });

  it("shows every chip before the picker is measured", () => {
    expect(
      partitionPickerExperiments({
        experimentIds,
        selectedExperimentId: "b",
        availableWidth: null,
      })
    ).toEqual({ chipExperimentIds: experimentIds, overflowExperimentIds: [] });
  });
});
