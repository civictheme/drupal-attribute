# drupal-attribute

[![NPM version][npm-image]][npm-url]

**This is a fork of [drupal-attribute](https://gitlab.com/nightlycommit/drupal-attribute) by [Eric MORAND](https://gitlab.com/nightlycommit), maintained by [CivicTheme](https://github.com/civictheme). All credit for the original implementation belongs to the upstream authors.**

This is not [drupal-attribute](https://npmjs.org/package/drupal-attribute). This is the _project_ behind [drupal-attribute](https://npmjs.org/package/drupal-attribute).

## Using with twig.js

`createAttribute()` is the Twig-facing entry point, equivalent to Drupal's
`create_attribute()`. Register it with twig.js:

```js
import Twig from 'twig';
import { createAttribute } from 'drupal-attribute';

Twig.extendFunction('create_attribute', createAttribute);
```

Use it in preference to the `create_attribute` shipped by
[`drupal-twig-extensions`](https://github.com/JohnAlbin/drupal-twig-extensions),
which builds its collection with `Object.keys()`. twig.js stamps every object
literal compiled from a template with an own, enumerable `_keys` array recording
the authored key order, so `Object.keys()` both picks up `_keys` as though it
were an attribute and returns the remaining keys in the wrong order:

```twig
<button{{ create_attribute({'data-slider-previous': '', 'class': 'btn'}) }}></button>
```

```html
<!-- drupal-twig-extensions -->
<button class="btn" _keys="data-slider-previous class" data-slider-previous=""></button>

<!-- createAttribute -->
<button data-slider-previous="" class="btn"></button>
```

`createAttribute()` reads `_keys` for its ordering and never renders it, so
output matches what Drupal's PHP `Attribute` produces for the same template.
Objects that carry no `_keys` — anything reaching the function from the render
context rather than from a template literal — keep their own enumeration order.

Upstream tracks the same defect as
[drupal-twig-extensions#1](https://github.com/JohnAlbin/drupal-twig-extensions/issues/1).
Note that `addDrupalExtensions(Twig)` runs on every compiled Twig module import
and re-registers its own implementation, so depending on module evaluation order
you may need to register through a wrapper rather than once at startup:

```js
const extendFunction = Twig.extendFunction.bind(Twig);

Twig.extendFunction = (name, definition) =>
  extendFunction(name, name === 'create_attribute' ? createAttribute : definition);

Twig.extendFunction('create_attribute', createAttribute);
```

## Prerequisites

* Node.js 16 and above
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

[npm-image]: https://badge.fury.io/js/drupal-attribute.svg
[npm-url]: https://npmjs.org/package/drupal-attribute