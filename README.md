# drupal-attribute

[![NPM version][npm-image]][npm-url]

**This is a fork of [drupal-attribute](https://gitlab.com/nightlycommit/drupal-attribute) by [Eric MORAND](https://gitlab.com/nightlycommit), maintained by [CivicTheme](https://github.com/civictheme). All credit for the original implementation belongs to the upstream authors.**

This is not [drupal-attribute](https://npmjs.org/package/drupal-attribute). This is the _project_ behind [drupal-attribute](https://npmjs.org/package/drupal-attribute).

## Prerequisites

* Node.js 20 and above
* [Rollup](https://www.npmjs.com/package/rollup) installed globally

It is also recommended to have the following tools installed globally to ease the writing of tests and the tracking of the code coverage:

* [odz](https://www.npmjs.com/package/one-double-zero)
* [tsx](https://www.npmjs.com/package/tsx)

## Installation

The project can be installed by running the following command:

```shell
npm install
```

## Usage

### Build the test suite

```shell
npm run build:test
```

This command outputs the test suite to the directory `src/test/target`.

### Execute the test suite

The test suite can be executed by running the following command:

```shell
node src/test/target/index.mjs
```

Or, for convenience:

```shell
npm t
```

### Build the main artifact

The main artifact can be built by running the following command:

```shell
npm run build:main
```

This command outputs the main artifact to the directory `src/main/target`, under version `SNAPSHOT`.

The version can be provided by populating the `VERSION` environment variable accordingly:

```shell
VERSION=1.2.3 npm run build:main
```

### Writing and executing tests

Assuming one want to execute the test located in `src/test/foo/bar.ts`, one would run:

```shell
tsx src/test/foo/bar.ts
```

It is even possible - and recommended - to track the coverage while writing tests:

```shell
odz tsx src/test/foo/bar.ts
```

Of course, it is also perfectly possible to pipe the result of the test to your favorite tap formatter:

```shell
src/test/foo$ tsx bar.ts | tap-nyan
 9   -_-_-_-_-_,------,
 0   -_-_-_-_-_|   /\_/\ 
 0   -_-_-_-_-^|__( ^ .^) 
     -_-_-_-_-  ""  "" 
  Pass!
```

## Contributing

* Fork [this repository](https://github.com/civictheme/drupal-attribute)
* Code
* Implement tests using [tape](https://github.com/substack/tape)
* Issue a pull request keeping in mind that all pull requests must reference an issue in the issue queue

## License

Apache-2.0 © [Eric MORAND](https://gitlab.com/nightlycommit)

Files from the original project have been modified by CivicTheme contributors
since 2025. See the commit history for the full list of changes.

[npm-image]: https://badge.fury.io/js/@civictheme%2Fdrupal-attribute.svg
[npm-url]: https://npmjs.org/package/@civictheme/drupal-attribute