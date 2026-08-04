// Mirrors Drupal Html::escape(). Keep the apostrophe as the three-digit
// '&#039;' — PHP emits that form without ENT_HTML5 and snapshots compare bytes.
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

// `number` because PHP renders 0 as key="0". The nested record is open: merge()
// deep-merges arbitrary consumer objects.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrupalAttributeEntry = string | number | Array<string> | Record<string, any> | boolean | null | undefined;

// Iterables are read as key/value entries, anything else as a plain mapping.
export type DrupalAttributeInit =
  | Iterable<readonly [string, DrupalAttributeEntry]>
  | Record<string, DrupalAttributeEntry>;

function isEntryIterable(value: object): value is Iterable<readonly [string, DrupalAttributeEntry]> {
  return typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';
}

// Twig.js key-order property. Never an attribute; see NOTES.md.
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

  // Unlisted keys follow in their own order. Nothing is ever dropped.
  const remaining = Object.keys(attributes)
    .filter((key) => key !== TWIG_KEY_ORDER_PROPERTY && ordered.indexOf(key) === -1);

  return ordered.concat(remaining);
}

// The interface supplies the polymorphic `this` returns the class implements.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface DrupalAttribute extends Map<string, DrupalAttributeEntry> {
  addClass(...args: Array<DrupalAttributeEntry | Map<string, string>>): this;
  hasClass(key: string): boolean;
  removeClass(value: string | Array<string>): this;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DrupalAttribute extends Map<string, DrupalAttributeEntry> {
  // Entries go through setAttribute(), matching PHP Attribute::__construct.
  constructor(attributes?: DrupalAttributeInit | null) {
    super();

    if (attributes === null || attributes === undefined) {
      return;
    }

    // Plain objects follow `_keys` order when Twig.js supplied one.
    const entries: Iterable<readonly [string, DrupalAttributeEntry]> = isEntryIterable(attributes)
      ? attributes
      : orderedKeys(attributes).map((key): [string, DrupalAttributeEntry] => [key, attributes[key]]);

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
          // PHP appends without dedup; array_unique runs at render time.
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

      // PHP array_diff + array_values: all matches removed, then re-indexed.
      this.set('class', classes.filter((c) => !toRemove.includes(c)));
    }

    return this;
  }

  hasClass(value: string): boolean {
    const classes = this.getClasses();

    return classes !== null ? (classes.indexOf(value) > -1) : false;
  }

  setAttribute(key: string, value: DrupalAttributeEntry) {
    // Dropped, not stored. This is the path drupal-twig-extensions takes.
    if (key === TWIG_KEY_ORDER_PROPERTY) {
      return this;
    }

    // Omit attribute for nullish / false values.
    if (value === null || value === undefined || value === false) {
      this.delete(key);
      return this;
    }

    // Stored as-is; toString() renders a bare key, per AttributeBoolean.
    if (value === true) {
      this.set(key, true);
      return this;
    }

    // PHP replaces with a fresh AttributeArray. Filter and dedup at render.
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

      // The guarantee: Map.set() and merge() both bypass setAttribute().
      if (key === TWIG_KEY_ORDER_PROPERTY) {
        continue;
      }

      // Skip nullish and false. Empty strings render as key="", as in PHP.
      if (value === null || value === undefined || value === false) {
        continue;
      }

      // Bare key, per AttributeBoolean. Still escaped.
      if (value === true) {
        components.push(escapeHtml(key));
        continue;
      }

      if (Array.isArray(value)) {

        // PHP AttributeArray: drop empties, dedup, escape, join.
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
    const currentAttributes = Object.fromEntries(this);
    const newAttributes = Object.fromEntries(collection);

    const mergedAttributes = this.mergeDeep(currentAttributes, newAttributes);

    // Order comes from the Maps, not the merged object: JS hoists integer-like
    // keys. Existing keys hold position, incoming ones append.
    const order = Array.from(this.keys());

    for (const key of collection.keys()) {
      if (order.indexOf(key) === -1) {
        order.push(key);
      }
    }

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

/**
 * Creates an attribute collection from a Twig mapping.
 *
 * The Twig-facing entry point, equivalent to Drupal's `create_attribute()`.
 * Register it with twig.js to render attributes in template order:
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
  return new DrupalAttribute(attributes);
}

// Default export for legacy consumers and tooling.
export default DrupalAttribute;
