import { Suspense } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router";

import { PROJECT_EVALUATOR_GALLERY_CATEGORY_PARAM } from "@phoenix/constants/searchParams";
import { ProjectEvaluatorGalleryModal } from "@phoenix/pages/project/evaluators/ProjectEvaluatorGalleryModal";
import { useProjectEvaluatorPaths } from "@phoenix/pages/project/evaluators/projectEvaluatorPaths";
import { parseProjectEvaluatorCategory } from "@phoenix/pages/project/evaluators/projectEvaluatorTemplates";

/**
 * The evaluator gallery, as a modal route over the list. The creation
 * slideovers nest under it, so one opened from a gallery card renders through
 * the outlet below -- after the modal, so it takes the top overlay layer.
 */
export function ProjectEvaluatorGalleryPage() {
  const navigate = useNavigate();
  const paths = useProjectEvaluatorPaths();
  const [searchParams] = useSearchParams();
  const initialCategory = parseProjectEvaluatorCategory(
    searchParams.get(PROJECT_EVALUATOR_GALLERY_CATEGORY_PARAM)
  );
  return (
    <>
      <ProjectEvaluatorGalleryModal
        initialCategory={initialCategory}
        onClose={() => navigate(paths.list, { replace: true })}
      />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </>
  );
}
