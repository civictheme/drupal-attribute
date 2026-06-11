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

## JS package coverage map

(Updated for the parity test suite added on
`feature/comprehensive-attribute-tests`.)

| PHP behavior | Status | Test |
|---|---|---|
| Constructor with iterable | ✅ Covered | `constructor.mts` |
| `setAttribute` chaining | ✅ Covered | `set-attribute.mts` |
| `setAttribute` with `null`/`undefined`/`false` | ✅ Covered | `set-attribute.mts` |
| `setAttribute` with `true` (renders as bare `key`) | ✅ Covered (fix applied — see below) | `set-attribute.mts` |
| `setAttribute` with empty string renders as `key=""` | ✅ Covered | `to-string.mts` (regression test) |
| `setAttribute` with `0` renders as `key="0"` | ✅ Covered | `php-parity.mts` |
| `setAttribute` with negative numbers | ✅ Covered | `php-parity.mts` |
| `setAttribute` overwrites previous scalar | ✅ Covered | `php-parity.mts` |
| `removeAttribute` chaining | ✅ Covered | `remove-attribute.mts` |
| `removeAttribute` is a no-op for absent keys | ✅ Covered | `php-parity.mts` |
| `addClass` with strings / arrays / Maps | ✅ Covered | `add-class.mts` |
| `addClass` filters null/undefined/empty | ✅ Covered | `add-class.mts` |
| `addClass` deduplicates within a call | ✅ Covered | `php-parity.mts` |
| `addClass` chaining | ✅ Covered | `php-parity.mts` |
| `removeClass` with string / array | ✅ Covered | `remove-class.mts` |
| `removeClass` on uninitialized class | ✅ Covered | `remove-class.mts` |
| `removeClass` removes ALL duplicates | ✅ Covered (fix applied — see below) | `remove-class.mts` |
| `addClass` defers dedup to render | ✅ Covered (fix applied — see below) | `add-class.mts`, `php-parity.mts` |
| `setAttribute('class')` stores raw array | ✅ Covered (fix applied — see below) | `set-attribute.mts` |
| `hasClass` on uninitialized | ✅ Covered | `php-parity.mts` |
| `hasClass` across add/remove/add cycles | ✅ Covered | `php-parity.mts` |
| `merge` chaining + simple attrs | ✅ Covered | `merge.mts` |
| `merge` scalar-overwrites-scalar | ✅ Covered | `php-parity.mts` |
| `merge` doesn't clobber unrelated keys | ✅ Covered | `php-parity.mts` |
| `merge` deduplicates class arrays | ✅ Covered | `merge.mts` |
| `merge` deep-merges nested objects | ✅ Covered | `merge.mts` |
| `toString` empty | ✅ Covered | `to-string.mts` |
| `toString` insertion order | ✅ Covered | `php-parity.mts` |
| `toString` mixed scalar + array + bool | ✅ Covered | `php-parity.mts` |
| `toString` HTML escaping | ✅ Covered (fix applied — see below) | `escaping.mts` |
| Iteration via `for...of` | ✅ Covered | `php-parity.mts` |

---

## Known divergences from PHP behavior

All five divergences originally catalogued here have been resolved on
`feature/comprehensive-attribute-tests`. The fork now matches PHP both in
rendered output and in raw `get('class')` storage. The original analysis is
retained below for reviewers, with each item's resolution.

### 1. ~~CRITICAL~~ — `toString()` HTML escaping (FIXED in this fork)

**Status:** fixed on `feature/comprehensive-attribute-tests`. Tracking
upstream at https://gitlab.com/nightlycommit/drupal-attribute (the
maintainer's October 2025 "Modernize the project" rewrite is recent
enough that they're likely to engage with an MR).

**The bug:** PHP `\Drupal\Core\Template\Attribute` calls
`Html::escape()` on every attribute value (`AttributeValueBase.php`
line ~55) and on attribute names. The JS port previously did:

```js
components.push(`${key}="${String(value)}"`);
```

No escaping. So:

```js
new DrupalAttribute().setAttribute('title', 'a"b<script>').toString()
// Was: ' title="a"b<script>"'   ← invalid HTML, attribute injection
// PHP: ' title="a&quot;b&lt;script&gt;"'
```

**Risk:** any consumer that passed user input through `setAttribute`
and then rendered the result was open to attribute-injection / XSS in
contexts where the output is parsed as HTML. Affected consumers
include vite-plugin-twig-drupal, twig.js, twing.

**The fix** (in `src/main/index.mts`):

```ts
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#039;',
  '<': '&lt;',
  '>': '&gt;',
};
const HTML_ESCAPE_RE = /[&"'<>]/g;

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch]);
}
```

Applied to both key and value in `toString()`. Single regex pass with
a lookup table (`'&'` is a key in the map, so order doesn't matter and
`&quot;` cannot get re-escaped to `&amp;quot;`).

**Why `&#039;` and not `&#39;` / `&#x27;`:** Drupal's `Html::escape` is
literally `htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`
— **without** `ENT_HTML5`. PHP without `ENT_HTML5` emits `&#039;`
(three-digit, leading zero). Every common JS escaper (`escape-html`,
React, Vue) emits `&#39;` or `&#x27;`. Snapshot tests against
Drupal-rendered output diff on this byte. The
`escaping.mts > toString escapes ' as &#039; (PHP htmlspecialchars
parity, not &#39; or &#x27;)` test pins the leading-zero form.

**Why no dependency on `escape-html`:** that library would emit
`&#39;`, defeating the parity goal. The 5-line inline implementation
also keeps the audit surface minimal for a security-critical fork.

### 2. `removeClass` only removes the first occurrence (FIXED)

**Status:** fixed on `feature/comprehensive-attribute-tests`.

PHP: `array_diff` removes ALL occurrences of each value; result is
re-indexed via `array_values` (`Attribute.php` line ~286).

JS previously: `removeClass(v)` did `classes.indexOf(v)` then
`splice(index, 1)` — only the first match was removed.

**The fix** (`src/main/index.mts`): `removeClass` now filters and writes
back a fresh array — `this.set('class', classes.filter(c => !toRemove.includes(c)))`
— which removes every match and re-indexes in one step. This matters now
that `addClass` defers dedup to render (#3), so duplicates can legitimately
exist in storage. Covered by `remove-class.mts`
("should remove ALL occurrences of a duplicated class and re-index").

### 3. `addClass` deduplicates at storage time; PHP defers to render (FIXED)

**Status:** fixed on `feature/comprehensive-attribute-tests`.

PHP: `addClass` appends to the class array without deduplicating;
`AttributeArray::__toString` calls `array_unique` at render time
(`AttributeArray.php` line ~76).

JS previously: `addClass` checked `indexOf` and skipped duplicates before
storing.

**The fix** (`src/main/index.mts`): `addClass` now appends every value
(still dropping `null`/`undefined`/`''`, still `String()`-coercing) without
a dedup guard, and `toString` deduplicates the class array at render via
`[...new Set(filtered)]` before escaping and joining — mirroring PHP's
`array_unique`. Raw `get('class')` now preserves duplicates exactly as PHP
does; rendered output is unchanged. Covered by `add-class.mts` and
`php-parity.mts` ("addClass stores duplicates raw and deduplicates at render").

### 4. Boolean `true` renders as `key="key"` rather than bare `key` (FIXED)

**Status:** fixed on `feature/comprehensive-attribute-tests`. This is the
only one of the storage/rendering fixes that changes rendered output.

PHP: `setAttribute('disabled', TRUE)` renders ` disabled` (bare).

JS previously: `setAttribute('disabled', true)` rendered ` disabled="disabled"`
because `setAttribute` stored `true` as the key string itself and `toString`
rendered it as a normal key/value.

**The fix** (`src/main/index.mts`): `setAttribute` stores boolean `true`
as-is (`this.set(key, true)`), and `toString` renders a `value === true`
entry as a bare, HTML-escaped key with no `="..."`. This also correctly
handles `true` arriving via the `Map` constructor or a raw `.set()`.

**Breaking-change note:** output for boolean attributes passed through
`setAttribute` changes from ` disabled="disabled"` to ` disabled`. Verified
safe for CivicTheme: in both `civictheme-uikit` and the `civictheme` theme,
boolean attributes are hardcoded in Twig templates
(`{% if x %}checked="checked"{% endif %}`) and do **not** flow through the
`attributes`/drupal-attribute object, so no civictheme snapshot is affected.
Other consumers that pass booleans through `setAttribute` (twing,
vite-plugin-twig-drupal) will see the bare form. Covered by
`set-attribute.mts`, `php-parity.mts`, and `escaping.mts` (bare-key escaping).

### 5. `setAttribute('class', [...])` filters early in JS (FIXED)

**Status:** fixed on `feature/comprehensive-attribute-tests`.

PHP: stores the raw array via `AttributeArray`; filters at render time.

JS previously: `setAttribute('class', ...)` was routed through `addClass`,
which filtered null/undefined/empty before storage (and, before #3, also
deduplicated).

**The fix** (`src/main/index.mts`): `setAttribute('class', value)` now stores
the raw array (`this.set('class', Array.isArray(value) ? value.slice() : [value])`)
and **replaces** any existing class list rather than appending — matching PHP,
which constructs a fresh `AttributeArray`. All filtering and dedup happen in
`toString` (#3). Raw `get('class')` now returns the unfiltered array exactly
as PHP does; rendered output is unchanged. Covered by `set-attribute.mts`
("setAttribute(class) stores the raw array…" and "…replaces a previously set
class list").

**Note on `addClass` vs `setAttribute('class')`:** `addClass` appends (and
still skips empties at add); `setAttribute('class', ...)` replaces and stores
raw. This mirrors the PHP distinction between `Attribute::addClass` and
`Attribute::setAttribute`.

---

## Publishing runbook (resume tomorrow)

End goal: ship a `civictheme-uikit` PR whose `overrides` block points at
public, version-pinned forks of `drupal-attribute` and
`drupal-twig-extensions` — closing the XSS hole and the
`CVE-2026-29091` locutus chain — with the local `file:` path removed
and the lockfile regenerated against the public refs.

State as of last session (2026-05-08):
- `drupal-attribute` (this repo, `feature/comprehensive-attribute-tests`):
  fix written + 14 escaping tests added + NOTES.md updated; **all 77
  tests pass locally**. Nothing committed yet.
- `drupal-twig-extensions` (`~/work/twig-js-work/drupal-twig-extensions`,
  `feature/update-vulnerable-js-packages`): 1 commit ahead of
  `origin/main` (`2256c60 fix: locutus 3 named-import incompatibility`).
  Not pushed.
- `twig.js`: at parity with upstream `master`. Nothing to do.
- `civictheme-uikit` (`main`, dirty): `package.json` has `file:` override
  pointing at the local drupal-twig-extensions checkout — must be
  replaced with a public ref before any push.

### Step 1 — drupal-attribute: commit, push, tag

Working dir: `/home/rgaunt/work/twig-js-work/drupal-attribute`,
branch: `feature/comprehensive-attribute-tests`,
remote: `git@gitlab.com:richardgaunt/drupal-attribute.git`.

Optional version bump (hygienic; the override pins by tag so this is
informational only):

```bash
# Edit package.json: "version": "1.2.2" -> "1.2.2-civictheme.0"
```

Stage the security work (don't `git add -A` — leave any unrelated
tooling output alone):

```bash
git add NOTES.md \
        src/main/index.mts \
        src/test/index.mts \
        src/test/tests/escaping.mts \
        src/test/tests/php-parity.mts
# plus package.json if you bumped the version

git status   # confirm only the files above are staged
git diff --cached --stat
npm test     # final green run before committing (expect 77 passing)
```

Commit (note: per global CLAUDE.md, never add Claude coauthor lines):

```bash
git commit -m "fix(security): escape HTML special characters in toString()

DrupalAttribute.toString() previously interpolated keys and values
verbatim, allowing attribute-injection / XSS in any consumer that
passed user input through setAttribute and rendered the result as
HTML — including vite-plugin-twig-drupal, twig.js, and twing.

Apply htmlspecialchars(..., ENT_QUOTES, 'UTF-8') parity escaping to
both the key and value in toString(). Single regex pass with a 5-entity
lookup table (& \" ' < >). Apostrophe is emitted as &#039; (three-digit,
leading zero) to match PHP's output without ENT_HTML5 — the canonical
form Drupal renders, distinct from escape-html / React / Vue's &#39; or
&#x27;.

Adds 14 escaping tests covering each entity individually, combined-
character byte parity with PHP, key escaping, class-array item
escaping, attribute-injection regression, and a byte-pinned guard for
the &#039; form so a future contributor cannot \"modernize\" it.

NOTES.md divergence #1 flipped from CRITICAL to FIXED with the
implementation rationale."
```

Push and tag:

```bash
git push -u origin feature/comprehensive-attribute-tests
git tag -a v1.2.2-civictheme.0 -m "Security: HTML-escape toString output"
git push origin v1.2.2-civictheme.0
```

Capture the resulting tag SHA — civictheme-uikit's override pins to it:

```bash
git rev-parse v1.2.2-civictheme.0
```

Then file an upstream MR at
https://gitlab.com/nightlycommit/drupal-attribute with the same diff
(escaping fix + escaping.mts test). The maintainer's October 2025
"Modernize the project" rewrite is recent — they're likely to engage.

### Step 2 — drupal-twig-extensions: push, tag

Working dir: `~/work/twig-js-work/drupal-twig-extensions`,
branch: `feature/update-vulnerable-js-packages`,
remote: `git@github.com:richardgaunt/drupal-twig-extensions.git`.

The locutus named-import fix is already committed (`2256c60`); just
push and tag.

```bash
cd ~/work/twig-js-work/drupal-twig-extensions
npm test   # confirm green before tagging
git push -u origin feature/update-vulnerable-js-packages
git tag -a v1.0.0-beta.6-civictheme.0 -m "Security: locutus 3 + named-import fix"
git push origin v1.0.0-beta.6-civictheme.0
git rev-parse v1.0.0-beta.6-civictheme.0   # capture for civictheme-uikit
```

Then file a PR upstream at `JohnAlbin/drupal-twig-extensions` with the
single `2256c60` commit — anyone else upgrading locutus past 3.0 hits
the same incompatibility.

### Step 3 — civictheme-uikit: rewrite overrides, regenerate lockfile, validate

Working dir: `~/work/civictheme-uikit`. Currently dirty on `main`. Branch
off before committing.

```bash
cd ~/work/civictheme-uikit
git checkout -b security/js-supply-chain-fixes
```

Edit `package.json` `overrides` block to (replace the local `file:` path
and `#main` ref with the tags from steps 1 and 2):

```json
"overrides": {
  "@whitespace/storybook-addon-html": {
    "storybook": "^10.0.0"
  },
  "twig": "^3.0.0",
  "drupal-attribute": "git+https://gitlab.com/richardgaunt/drupal-attribute.git#v1.2.2-civictheme.0",
  "drupal-twig-extensions": "git+https://github.com/richardgaunt/drupal-twig-extensions.git#v1.0.0-beta.6-civictheme.0"
}
```

Regenerate the lockfile from a clean state (partial regen leaves stale
`resolved` lines pointing at the local file path):

```bash
rm -rf node_modules package-lock.json
npm install
```

Verify the override actually reaches workspace deps:

```bash
npm ls drupal-attribute drupal-twig-extensions
# Both should resolve to the gitlab/github tag refs everywhere they appear.
```

Run the full validation set:

```bash
npm run lint
npm run test
npm run build                # both packages/twig and packages/sdc
npm run build-storybook
npm audit --omit=dev         # confirm CVE list is clean (locutus, twig, drupal-attribute)
```

If any test fails because of the apostrophe entity change (`&#039;`
vs the previous unescaped `'`), update the snapshot — that diff is the
intended fix. Note in the PR description which snapshots changed and why.

### Step 4 — civictheme-uikit PR

```bash
git add package.json package-lock.json .github/workflows/release-storybook.yml
git status   # confirm nothing else sneaks in
git commit -m "security: pin forked drupal-attribute and drupal-twig-extensions overrides

- drupal-attribute v1.2.2-civictheme.0: closes attribute-injection /
  XSS in toString() (htmlspecialchars parity escaping for key + value).
- drupal-twig-extensions v1.0.0-beta.6-civictheme.0: locutus 3
  (CVE-2026-29091) + named-import compatibility fix.
- twig: pin to ^3.0.0 (registry release with locutus 3.0.25 +
  serialize-javascript 7.0.5).
- release-storybook workflow: persist-credentials: false on checkout
  to prevent token persistence into subsequent steps.

Forks track upstream MRs at:
- https://gitlab.com/nightlycommit/drupal-attribute (TODO: link MR)
- https://github.com/JohnAlbin/drupal-twig-extensions (TODO: link PR)
Override block can be removed once both land in upstream releases."

git push -u origin security/js-supply-chain-fixes
gh pr create --title "Security: pin forked overrides closing XSS + CVE-2026-29091" \
             --body-file .github/SECURITY-PR-BODY.md   # or inline via heredoc
```

PR description should list:
- Each CVE / vulnerability ID being closed
- Why the override is necessary (upstream MRs filed but not yet
  released)
- Which snapshot tests changed and why (apostrophe entity)
- Plan for retiring the override (drop when upstream releases land)

### Step 5 — pre-flight items still open

Worth checking before / during step 3, not blockers:

- **`civictheme-uikit-security/`** (sibling working directory) — confirm
  whether it's a clean reference clone or a separate active workstream.
  If active, it likely needs the same overrides.
- **Workspace lockfiles** — verify `packages/twig` and `packages/sdc`
  don't have their own `package-lock.json` that bypasses the root
  override. (Workspace + overrides has edge cases.)
- **`npm audit` baseline** — capture the audit output *before* the
  override change so the PR description can quote the exact CVE list
  closed.

---

## Long-term: making the override unnecessary

Three follow-ups to retire the fork-based overrides:

1. Land the HTML-escaping MR upstream at
   https://gitlab.com/nightlycommit/drupal-attribute.
2. Land the locutus named-import PR upstream at
   `JohnAlbin/drupal-twig-extensions`.
3. Once both ship in upstream releases, drop the overrides and bump
   the regular dependencies in `civictheme-uikit`. Track this with a
   TODO in the override block citing both upstream issue URLs.

Other upstream issues worth filing while you're there:
- The original empty-string-skip bug in `drupal-attribute` (already
  fixed in this fork — verify it's still present in upstream
  `nightlycommit/main` before filing).
- Missing `prepare` script + missing `rollup`/`typescript` devDeps in
  the `drupal-attribute` package.json — the package can't be built from
  a clean clone without these.
