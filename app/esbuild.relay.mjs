import { promises } from "fs";
import crypto from "crypto";
import path from "path";
import { print, parse } from "graphql";

/**
 * A relay plugin for esbuild.
 */
export const relay = {
  name: "relay",
  setup: (build) => {
    build.onLoad({ filter: /\.tsx?$/, namespace: "" }, async (args) => {
      let contents = await promises.readFile(args.path, "utf8");

      if (contents.includes("graphql`")) {
        let imports = [];

        contents = contents.replaceAll(
          /graphql`([\s\S]*?)`/gm,
          (match, query) => {
            const formatted = print(parse(query));
            const name = /(fragment|mutation|query) (\w+)/.exec(formatted)[2];
            let id = `graphql__${crypto.randomBytes(10).toString("hex")}`;
            imports.push(
              `import ${id} from "./__generated__/${name}.graphql.ts";`
            );
            return id;
          }
        );

        contents = imports.join("\n") + contents;
      }

      return {
        contents: contents,
        loader: "tsx",
      };
    });
  },
};
