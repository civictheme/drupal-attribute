// Mirrors Drupal core's Html::escape(), which is
// htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') — five entities,
// single pass. The apostrophe is intentionally '&#039;' (three-digit form):
// without ENT_HTML5 PHP emits the leading-zero variant, and Drupal's escape
// helper does not pass that flag. Do not "modernize" this to '&#39;' or
// '&#x27;' — it would drift from byte-parity with PHP-rendered output and
// break snapshot tests that compare against Drupal.
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

// `number` is included because numeric values are a supported parity behavior:
// PHP renders 0 as key="0" rather than skipping it (see NOTES.md).
//
// The nested record is unconstrained by design: merge() deep-merges arbitrary
// consumer-supplied objects, mirroring PHP NestedArray::mergeDeep, which places
// no constraint on nested value types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrupalAttributeEntry = string | number | Array<string> | Record<string, any> | boolean | null | undefined;

// What the constructor and createAttribute() accept. Anything iterable is read
// as key/value entries — Map, another DrupalAttribute, an array of pairs —
// mirroring the Map constructor. Everything else is read as a plain mapping,
// mirroring PHP's `new Attribute(['class' => 'foo'])`.
export type DrupalAttributeInit =
  | Iterable<readonly [string, DrupalAttributeEntry]>
  | Record<string, DrupalAttributeEntry>;

function isEntryIterable(value: object): value is Iterable<readonly [string, DrupalAttributeEntry]> {
  return typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';
}

// Interface/class declaration merging is intentional: the interface supplies the
// polymorphic `this` return types for the chainable class methods below, each of
// which the class implements. The rule guards against interfaces declaring
// members the class never implements — not the case here.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface DrupalAttribute extends Map<string, DrupalAttributeEntry> {
  addClass(...args: Array<DrupalAttributeEntry | Map<string, string>>): this;
  hasClass(key: string): boolean;
  removeClass(value: string | Array<string>): this;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DrupalAttribute extends Map<string, DrupalAttributeEntry> {
  // Every entry is routed through setAttribute() rather than Map's own bulk
  // insert, matching PHP Attribute::__construct, which loops over the input and
  // calls offsetSet() per pair. That is what applies the `class`-is-always-an-
  // array rule to constructor input as well as to later assignment.
  constructor(attributes?: DrupalAttributeInit | null) {
    super();

    if (attributes === null || attributes === undefined) {
      return;
    }

    const entries = isEntryIterable(attributes) ? attributes : Object.entries(attributes);

    for (const [key, value] of entries) {
      this.setAttribute(key, value);
    }
  }

  getClasses(): Array<string> | null {
    let results: Array<string> | null = null;

    const classValue = this.get('class') as Array<string> | undefined;

    if (classValue !== undefined) {
      results = classValue;
    }

    return results;
  }
  
  addClass(...values: Array<string | Array<string> | Map<string, string> | null | undefined>) {
    let classes = this.getClasses();
    
    if (classes === null) {
      classes = [];

      this.set('class', classes);
    }

    values.forEach((value) => {
      if (value !== null && value !== undefined) {
        // Handle Maps by converting to array of value.
        if (typeof value === "string") {
          value = [value];
        }

        if (value instanceof Map) {
          value = Array.from(value.values());
        }

        value.forEach(function (d) {
          if (d === null || d === undefined || d === '') {
            return;
          }
          // PHP Attribute::addClass appends without deduplicating; the class
          // list is run through array_unique only at render time
          // (AttributeArray::__toString). Mirror that here — dedup lives in
          // toString(), not at storage.
          classes.push(String(d));
        });
      }
    });

    return this;
  }

  removeClass(value: string | Array<string>): this {
    const classes = this.getClasses();

    if (classes !== null) {
      const toRemove = Array.isArray(value) ? value : [value];

      // PHP Attribute::removeClass uses array_diff + array_values: every
      // occurrence of each value is removed and the result is re-indexed.
      // filter() removes all matches and produces a fresh, re-indexed array.
      this.set('class', classes.filter((c) => !toRemove.includes(c)));
    }

    return this;
  }

  hasClass(value: string): boolean {
    const classes = this.getClasses();

    return classes !== null ? (classes.indexOf(value) > -1) : false;
  }

  setAttribute(key: string, value: DrupalAttributeEntry) {
    // Omit attribute for nullish / false values.
    if (value === null || value === undefined || value === false) {
      this.delete(key);
      return this;
    }

    // Boolean true is stored as-is and rendered as a bare key (e.g. ` disabled`)
    // by toString(), matching PHP AttributeBoolean::__toString.
    if (value === true) {
      this.set(key, true);
      return this;
    }

    // PHP setAttribute('class', ...) creates a fresh AttributeArray storing the
    // raw value (replace, not append); empties/duplicates are resolved at
    // render time. Store the raw array here and let toString() filter + dedup.
    if (key === 'class') {
      this.set('class', Array.isArray(value) ? value.slice() : [value]);
      return this;
    }

    this.set(key, value);

    return this;
  }

  removeAttribute(key: string) {
    this.delete(key);

    return this;
  }

  toString(): string {
    const components = [];

    for (const key of this.keys()) {
      const value = this.get(key);

      // Skip nullish and false attributes. Empty strings are rendered as
      // key="" to match Drupal's PHP Attribute behavior.
      if (value === null || value === undefined || value === false) {
        continue;
      }

      // Boolean true renders as a bare key (e.g. ` disabled`), matching PHP
      // AttributeBoolean::__toString. The key is still HTML-escaped.
      if (value === true) {
        components.push(escapeHtml(key));
        continue;
      }

      if (Array.isArray(value)) {

        // Mirror PHP AttributeArray::__toString: array_filter drops empties,
        // array_unique deduplicates, then each value is escaped and joined
        // with a space. Filtering and dedup happen here at render time, not at
        // storage, so raw get('class') matches PHP.
        const filtered = value
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(String);

        const unique = [...new Set(filtered)];

        // Skip empty arrays.
        if (unique.length === 0) {
          continue;
        }

        components.push(`${escapeHtml(key)}="${unique.map(escapeHtml).join(' ')}"`);
        continue;
      }

      components.push(`${escapeHtml(key)}="${escapeHtml(String(value))}"`);
    }

    return components.length ? ' ' + components.join(' ') : '';
  }

  /**
   * Merge another DrupalAttribute instance into this one.
   */
  merge(collection: DrupalAttribute): this {
    // Convert both the current attributes and the input collection's attributes to plain objects.
    const currentAttributes = Object.fromEntries(this);
    const newAttributes = Object.fromEntries(collection);

    // Perform a deep merge.
    const mergedAttributes = this.mergeDeep(currentAttributes, newAttributes);

    // Read the resulting order from the two Maps, not from the merged plain
    // object: JS hoists integer-like keys to the front of an object, so a
    // `for...in` here would turn ` b="bee" 2="two"` into ` 2="two" b="bee"`.
    // Maps preserve true insertion order. Existing keys keep their position and
    // incoming ones append, matching PHP NestedArray::mergeDeepArray for string
    // keys (see NOTES.md for the integer-key gap).
    const order = Array.from(this.keys());

    for (const key of collection.keys()) {
      if (order.indexOf(key) === -1) {
        order.push(key);
      }
    }

    // Clear the current Map and set the merged attributes.
    this.clear();
    for (const key of order) {
      this.set(key, mergedAttributes[key]);
    }

    return this;
  }

  // Helper function for deep merging.
  mergeDeep(target: Record<string, DrupalAttributeEntry>, source: Record<string, DrupalAttributeEntry>) {
    for (const key in source) {
      if (source[key] instanceof Array) {
        if (!target[key]) {
          target[key] = [];
        }
        
        target[key] = Array.from(new Set((target[key] as Array<string>).concat(source[key])));
      }
      else if (source[key] instanceof Object) {
        if (!target[key]) {
          target[key] = {};
        }
        
        Object.assign(source[key], this.mergeDeep(target[key] as Record<string, DrupalAttributeEntry>, source[key]));
      }
      else {
        target[key] = source[key];
      }
    }
    return target;
  }
}

// Twig.js stamps every object literal it compiles from a template with an own,
// enumerable `_keys` array holding the authored key order. It needs that array
// because the object it builds does not preserve that order itself: its
// expression stack assigns the keys out of order, and JS additionally hoists
// integer-like keys to the front. For `{'2': 'two', 'b': 'bee', '1': 'one'}`,
// Object.keys() gives ['1', '2', '_keys', 'b'] while `_keys` gives the authored
// ['2', 'b', '1'].
//
// So `_keys` is bookkeeping that must never be rendered as an attribute, and at
// the same time it is the only way to recover the order Drupal would render in.
// Verified identical in twig.js 1.17.1 and 3.0.0.
const TWIG_KEY_ORDER_PROPERTY = '_keys';

function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

/**
 * Resolves the order a Twig.js mapping's keys should be rendered in.
 */
function orderedKeys(attributes: Record<string, DrupalAttributeEntry>): Array<string> {
  const declared = attributes[TWIG_KEY_ORDER_PROPERTY];

  const ordered = Array.isArray(declared)
    ? declared.filter((key) => typeof key === 'string' && key !== TWIG_KEY_ORDER_PROPERTY && hasOwn(attributes, key))
    : [];

  // Whatever `_keys` does not account for — because it is absent, stale, or not
  // an array at all — keeps its own enumeration order behind the ordered keys.
  // No attribute is ever dropped for being unlisted.
  const remaining = Object.keys(attributes)
    .filter((key) => key !== TWIG_KEY_ORDER_PROPERTY && ordered.indexOf(key) === -1);

  return ordered.concat(remaining);
}

/**
 * Creates an attribute collection from a Twig mapping.
 *
 * This is the Twig-facing entry point, equivalent to Drupal's
 * `create_attribute()`. Register it with twig.js to keep `_keys` out of the
 * rendered markup and to render attributes in template order:
 *
 * ```js
 * Twig.extendFunction('create_attribute', createAttribute);
 * ```
 *
 * @param {?DrupalAttributeInit} attributes
 *   (optional) Key-value pairs to convert into HTML attributes.
 *
 * @returns {DrupalAttribute}
 *   An attribute collection holding the given attributes.
 */
export function createAttribute(attributes?: DrupalAttributeInit | null): DrupalAttribute {
  if (attributes === null || attributes === undefined) {
    return new DrupalAttribute();
  }

  // Maps and entry arrays are already ordered key/value pairs and never carry
  // Twig.js bookkeeping, so they go straight to the constructor.
  if (isEntryIterable(attributes)) {
    return new DrupalAttribute(attributes);
  }

  return new DrupalAttribute(
    orderedKeys(attributes).map((key): [string, DrupalAttributeEntry] => [key, attributes[key]]),
  );
}

// Provide a default export for compatibility with legacy consumers and tooling.
export default DrupalAttribute;