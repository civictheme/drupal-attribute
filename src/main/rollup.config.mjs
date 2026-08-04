import {createTypeScriptPlugin} from "@vitrail/rollup-plugin-typescript";
import {createPackageManifestPlugin} from "@nightlycommit/rollup-plugin-package-manifest";
import {rmSync} from "node:fs";
import {dirname, join} from "node:path";

const commonjsTargetName = 'index.cjs';
const moduleTargetName = 'index.mjs';

/**
 * @var {import("rollup").RollupOptionsFunction}
 */
const program = (commandLineArgs) => {
  const version = process.env.VERSION || '1.0.0-SNAPSHOT';

  console.log(`Building main artifact under version ${version}...`);

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
      createTypeScriptPlugin({
        compilerOptions: {
          declaration: true
        }
      })
    ],
    output: [
      {
        format: "module",
        file: join('target', moduleTargetName),
        plugins: [
          createPackageManifestPlugin({
            name: 'drupal-attribute',
            version,
            description: "Emulate Drupal Attribute in JavaScript.",
            main: "index.cjs",
            types: "index.d.mts",
            keywords: [
              "drupal"
            ],
            author: "Eric MORAND <eric.morand@gmail.com>",
            license: "Apache-2.0",
            repository: "https://github.com/civictheme/drupal-attribute",
            exports: {
              import: "./index.mjs",
              require: "./index.cjs",
              types: "./index.d.mts"
            }
          })
        ]
      },
      {
        format: "commonjs",
        file: join('target', commonjsTargetName)
      }
    ]
  }];

  return options;
};

export default program;