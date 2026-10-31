# Drupal Attribute Parity Notes

This document tracks the JS `drupal-attribute` package's behavioral parity
with Drupal core's PHP `\Drupal\Core\Template\Attribute` class, the source
material we used to verify behavior, the tests that lock in correct
behavior, and the known gaps.

It is intended for two audiences:

1. **Maintainers of this fork** who need to know which behaviors are
   intentionally locked-in vs which are still divergent from PHP.
2. **Reviewers** who want to verify our claims by reading the Drupal
   source code themselves.

Reference behavior was verified against Drupal core **11.3.5** via
`drush php:cli`.

---

## How to read the Drupal source material

All paths below are relative to the Drupal core repository root. If you
have a local Drupal site, they live under `web/core/...` (D9-D11
default) or `core/...` if you're working in a clone of `drupal/drupal`
directly.

### Implementation classes

| File | Lines | What it does |
|---|---|---|
| `core/lib/Drupal/Core/Template/Attribute.php` | 407 | The main class — storage, dispatch to typed value classes, `__toString`, `merge`, iteration |
| `core/lib/Drupal/Core/Template/AttributeValueBase.php` | 72 | Base class for all attribute value types — defines `render()` and the `RENDER_EMPTY_ATTRIBUTE` flag |
| `core/lib/Drupal/Core/Template/AttributeString.php` | 31 | String values — escapes via `Html::escape()` and renders empty strings |
| `core/lib/Drupal/Core/Template/AttributeBoolean.php` | 43 | Boolean values — renders bare `key` for true, omitted for false |
| `core/lib/Drupal/Core/Template/AttributeArray.php` | 107 | Array values (used for `class`) — joins with spaces, dedupes at render time |

### Test files

| File | Lines | What it covers |
|---|---|---|
| `core/tests/Drupal/Tests/Core/Template/AttributeTest.php` | 552 | Behaviour of the Attribute class itself (public API, escaping, iteration, merge) |
| `core/tests/Drupal/Tests/Core/Template/AttributeHelperTest.php` | — | The helper utilities — relevant if you ever port `AttributeHelper` |

`src/test/tests/core-attribute-test.mts` is a one-for-one port of
`AttributeTest.php`: every test method is represented, with PHP array-access
syntax translated to the `offsetGet`/`offsetSet`/`offsetExists`/`offsetUnset`
methods and divergences noted inline. The PHP `Markup::create()` safe-object
cases are the only omission — see the known gaps below.

### Upstream URLs (Drupal 11.x branch — line numbers may shift)

- https://git.drupalcode.org/project/drupal/-/blob/11.x/core/lib/Drupal/Core/Template/Attribute.php
- https://git.drupalcode.org/project/drupal/-/blob/11.x/core/lib/Drupal/Core/Template/AttributeValueBase.php
- https://git.drupalcode.org/project/drupal/-/blob/11.x/core/lib/Drupal/Core/Template/AttributeString.php
- https://git.drupalcode.org/project/drupal/-/blob/11.x/core/lib/Drupal/Core/Template/AttributeBoolean.php
- https://git.drupalcode.org/project/drupal/-/blob/11.x/core/lib/Drupal/Core/Template/AttributeArray.php
- https://git.drupalcode.org/project/drupal/-/blob/11.x/core/tests/Drupal/Tests/Core/Template/AttributeTest.php

For exact line stability, you can pin to the 11.3.5 tag, e.g.
`https://git.drupalcode.org/project/drupal/-/blob/11.3.5/core/lib/...`.

### Suggested reading order

1. `AttributeValueBase.php` (72 lines) — the smallest file; sets up the
   contract every value type follows. Pay attention to
   `RENDER_EMPTY_ATTRIBUTE = TRUE` and the `render()` method.
2. `AttributeString.php` (31 lines) — concrete simplest case. Note
   `Html::escape()` on the value.
3. `AttributeBoolean.php` (43 lines) — note the bare-key output and
   `RENDER_EMPTY_ATTRIBUTE = FALSE` override.
4. `AttributeArray.php` (107 lines) — class handling, escaping per item,
   `array_unique` + `array_filter` at render time.
5. `Attribute.php` (407 lines) — the orchestrator. Skim
   `createAttributeValue()`, `__toString`, and `merge`.
6. `AttributeTest.php` (552 lines) — the spec, in test form. Especially
   the dataProviders for `setAttribute` edge cases and the XSS payload
   tests near the bottom.

---

## Verifying PHP behavior yourself

If you have a Drupal site running (e.g. via `drush`), you can verify any
claim in this document by running:

```bash
drush php:cli
```

```php
use Drupal\Core\Template\Attribute;

// Empty string renders
print (string) (new Attribute(['data-platform' => '']));   // ' data-platform=""'

// Boolean true renders bare
print (string) (new Attribute(['disabled' => TRUE]));      // ' disabled'

// HTML escaping
print (string) (new Attribute(['title' => 'a"b<c>&d']));   // ' title="a&quot;b&lt;c&gt;&amp;d"'

// Numeric zero renders
print (string) (new Attribute(['data-count' => 0]));       // ' data-count="0"'

// Null / false / undefined are skipped
print (string) (new Attribute(['x' => NULL, 'y' => FALSE])); // ''
```

---

## PHP behavior catalog (key behaviors)

| Behavior | PHP source location | Spec |
|---|---|---|
| Empty string renders as `key=""` | `AttributeValueBase.php` line ~54, `RENDER_EMPTY_ATTRIBUTE` constant | Empty strings are valid attribute values — must render |
| `null`, `undefined`, `false` are skipped | `Attribute::__toString`, dispatched via typed value classes | Attribute removed from output |
| `true` renders as bare `key` | `AttributeBoolean::__toString` line ~39 | Output is ` disabled`, not ` disabled="disabled"` |
| Numeric `0` renders as `key="0"` | `AttributeString::__toString` (numeric coerced to string) | Falsy-but-not-`false` must render |
| HTML escaping on values | `AttributeValueBase::render` line ~55 + `AttributeString::__toString` line ~28 | `Html::escape()` on every value — escapes `&"<>` |
| HTML escaping on names | `AttributeValueBase::render` line ~55 | Names escaped too |
| Class array joined with space | `AttributeArray::__toString` lines ~74-78 | PHP-falsy members filtered (`array_filter` with no callback, so `0` and `'0'` drop too), then `implode(' ', ...)` |
| Class array deduplicated at render | `AttributeArray::__toString` line ~76 | `array_unique` is called inside `__toString`, not at storage time |
| `addClass` filters null/false/empty | `Attribute::addClass` lines ~186-208 | Filters PHP-falsy values before adding, since entries are stringified at add time; PHP stores them raw and filters at render |
| `removeClass` removes ALL matches | `Attribute::removeClass` line ~286 | Uses `array_diff` + `array_values` to reset indices |
| `addClass` defers dedup to render | `AttributeArray::__toString` line ~76 (`array_unique`) | Appends raw; `array_unique` at render |
| Merge: arrays deep-merge, scalars overwrite | `Attribute::merge` lines ~399-404 | Uses `NestedArray::mergeDeep` |
| Iteration order = insertion order | `Attribute::getIterator` lines ~370-371 | Uses `ArrayIterator` over storage |
| Constructor applies `setAttribute` rules | `Attribute::__construct` lines 108-112 | Loops the input calling `offsetSet()`, so `class` is forced to an array on constructor input too |
| `offsetGet` returns the stored value, null when absent | `Attribute::offsetGet` lines ~97-109 | Twig's `attributes['name']` subscript; reading `class` initializes it to an empty array and returns the live reference, so appends mutate storage |
| `offsetSet` / `offsetExists` / `offsetUnset` | `Attribute.php` ArrayAccess methods | `$attributes['x'] = $v`, `isset()`, `unset()`; JS delegates to `setAttribute`, `has`, `delete` |
| `hasAttribute` reports presence | `Attribute::hasAttribute` lines ~236-238 | Boolean, no auto-initialization side effect |
| `attributes.class` in Twig resolves `getClass()` | `Attribute::getClass` lines ~302-304 | PHP returns the `AttributeArray`, whose `__toString` renders the list; the JS method returns that rendered string (filtered, deduped, escaped, space-joined). twig.js resolves `.class` through the method the same way PHP Twig does |
| `removeAttribute` takes names and arrays of names | `Attribute::removeAttribute` lines ~248-262 | Variadic, arrays flattened |
| `removeClass` takes classes and arrays of classes | `Attribute::removeClass` lines ~272-290 | Variadic, arrays flattened via the `(array) $arg` cast |
| `addClass` wraps scalar arguments | `Attribute::addClass` lines ~186-209 | `(array) $arg` casts any scalar; JS wraps non-array, non-Map values the same way |
| `setAttribute('class', scalar)` casts to string | `Attribute::createAttributeValue` lines ~138-141 | `[(string) $value]`, so Stringable objects become their string form at storage time |
| Render order = template order | `Attribute::__construct` lines 108-112 + `getIterator` lines 377-381 | PHP arrays preserve authored key order; `createAttribute()` has to reconstruct it (see below) |

---

## The twig.js boundary: `createAttribute()` and `_keys`

`DrupalAttribute` itself has no knowledge of twig.js. `createAttribute()` is the
one place that does, because a mapping arriving from a twig.js template is not a
faithful record of what the template wrote.

twig.js stamps every object literal it compiles with an own, enumerable `_keys`
array holding the authored key order. It needs that array because the object it
builds does not preserve that order itself — its expression stack assigns the
keys out of order, and JS additionally hoists integer-like keys to the front:

| Template literal | `Object.keys()` | `_keys` |
|---|---|---|
| `{'a': '1', 'b': '2', 'c': '3'}` | `['c', '_keys', 'b', 'a']` | `['a', 'b', 'c']` |
| `{'2': 'two', 'b': 'bee', '1': 'one'}` | `['1', '2', '_keys', 'b']` | `['2', 'b', '1']` |

So `_keys` is bookkeeping that must never be rendered as an attribute, and at
the same time it is the only record of the order PHP would render in. Any
implementation walking these objects with `Object.keys()` — including the
`create_attribute` in `drupal-twig-extensions`, tracked upstream as
[issue #1](https://github.com/JohnAlbin/drupal-twig-extensions/issues/1) — emits
a junk `_keys="…"` attribute and scrambles the rest.

`createAttribute()` orders by `_keys` where it is a usable array, appends any
own keys it does not account for in enumeration order, and never stores `_keys`.
Objects with no `_keys` — anything reaching the function from the render context
rather than from a template literal — keep their own enumeration order.

Verified identical on twig.js 1.17.1 and 3.0.0. `src/test/tests/twig-integration.mts`
drives the cases through a real twig.js render; `src/test/tests/create-attribute.mts`
covers the same ground as units, including malformed and stale `_keys`.

---

## Known gaps

### A plain object cannot carry integer-like keys in authored order

JS hoists integer-like keys to the front of an object, so
`{'2': 'two', 'b': 'bee', '1': 'one'}` has already become `1, 2, b` before the
constructor or `createAttribute()` can see it. Nothing downstream can recover
what the caller wrote. `createAttribute()` recovers it for twig.js templates
only because twig.js records the order separately in `_keys`; there is no
equivalent for a hand-written object literal. Pass a `Map` or an array of
entries where order matters. PHP has no such limitation — its arrays keep
insertion order for integer keys.

### Integer-like attribute names survive `merge()`; in PHP they are renumbered

PHP converts array keys that are integer strings to integers, and
`NestedArray::mergeDeepArray` (`core/lib/Drupal/Component/Utility/NestedArray.php`
lines 216-242) renumbers integer keys rather than preserving them, appending
each with `$result[] = $value` unless `$preserve_integer_keys` is set —
`Attribute::merge` does not set it. So merging `['2' => 'two']` in PHP produces a
fresh sequential key, not `2`.

JS `Map` keys are strings throughout, so `merge()` here keeps `2` as the
attribute name and holds its position. Nothing renders differently for any valid
HTML attribute name — a name cannot start with a digit — so this is recorded
rather than fixed. `merge()` does preserve insertion order for string keys,
which is the behavior `Attribute::merge` has for every name that can legally
reach it.

### `false` values are dropped at storage, not kept as boolean wrappers

PHP stores `FALSE` as an `AttributeBoolean(FALSE)` whose `value()` returns
`FALSE` and which renders nothing. `setAttribute(key, false)` here deletes the
key instead, so `offsetGet` returns `null` where PHP returns the wrapper.
Rendered output is identical; only the storage read differs. The constructor
subtest in `core-attribute-test.mts` locks both halves in.

### Rendering never mutates storage; PHP's does

`AttributeArray::__toString` runs `array_unique(array_filter($this->value))`
**and assigns the result back**, so printing an attribute in PHP permanently
dedupes and strips falsy members from storage. Rendering here applies the
same filter — PHP falsiness, so `0` and `'0'` drop too — and the same dedup,
making the output byte-identical, but it never writes the cleaned list back.
`addClass` additionally applies the filter on the way in, since entries are
stringified as they are added. The difference is observable only by reading
storage after a render: duplicates and falsy members that arrive via
`setAttribute('class', [...])` stay stored here, where PHP would have
scrubbed them as a side effect of printing.

### Safe-markup objects take the plain-text path

PHP detects `MarkupInterface`/`Stringable` values and runs them through
`PlainTextOutput::renderFromHtml()`, which strips tags from strings already
marked safe. There is no JS markup-safety system; any object is stringified
with `String(value)` and escaped like every other value. The `Markup::create()`
XSS cases in `AttributeTest.php` are therefore not ported — their non-safe
twins, which exercise plain-string escaping, are.

---