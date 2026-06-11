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
| Class array joined with space | `AttributeArray::__toString` lines ~74-78 | Empty values filtered, then `implode(' ', ...)` |
| Class array deduplicated at render | `AttributeArray::__toString` line ~76 | `array_unique` is called inside `__toString`, not at storage time |
| `addClass` filters null/false/empty | `Attribute::addClass` lines ~186-208 | Filters before adding |
| `removeClass` removes ALL matches | `Attribute::removeClass` line ~286 | Uses `array_diff` + `array_values` to reset indices |
| `addClass` defers dedup to render | `AttributeArray::__toString` line ~76 (`array_unique`) | Appends raw; `array_unique` at render |
| Merge: arrays deep-merge, scalars overwrite | `Attribute::merge` lines ~399-404 | Uses `NestedArray::mergeDeep` |
| Iteration order = insertion order | `Attribute::getIterator` lines ~370-371 | Uses `ArrayIterator` over storage |

---