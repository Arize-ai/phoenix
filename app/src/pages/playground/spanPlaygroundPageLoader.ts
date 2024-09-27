// import { fetchQuery, graphql } from "react-relay";
import { LoaderFunctionArgs } from "react-router";

// import RelayEnvironment from "@phoenix/RelayEnvironment";
/**
 *
 */
export async function spanPlaygroundPageLoader(args: LoaderFunctionArgs) {
  const { spanId } = args.params;
  alert(spanId);
  //   const loaderData = await fetchQuery(
  //     RelayEnvironment,
  //     graphql`
  //       query spanPlaygroundPageLoader {
  //         ...ViewerContext_viewer
  //         viewer {
  //           passwordNeedsReset
  //         }
  //       }
  //     `,
  //     {}
  //   ).toPromise();
  return null;
}
