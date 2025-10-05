import {createTypeScriptPlugin} from "@vitrail/rollup-plugin-typescript";
import {rmSync} from "node:fs";
import {dirname, join} from "path";

const moduleTargetName = 'index.mjs';

/**
 * @var {import("rollup").RollupOptionsFunction}
 */
const program = (commandLineArgs) => {
  console.log(`Building test artifact...`);

  /**
   * @var {Array<import("rollup").RollupOptions>}
   */
  const options = [{
    input: [
      'index.mts'
    ],
    plugins: [
      {
        generateBundle: (options) => {
          const destination = dirname(options.file);

          rmSync(destination, {
            force: true,
            recursive: true
          });
        }
      },
      createTypeScriptPlugin()
    ],
    treeshake: false, // it is important to not treeshake to preserve all the uncovered branches
    output: [
      {
        format: "module",
        file: join('target', moduleTargetName),
        sourcemap: true
      }
    ]
  }];

  return options;
};

export default program;