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

export type DrupalAttributeEntry = string | Array<string> | Record<string, any> | boolean | null | undefined;

export interface DrupalAttribute extends Map<string, DrupalAttributeEntry> {
  addClass(...args: Array<DrupalAttributeEntry | Map<string, string>>): this;
  hasClass(key: string): boolean;
  removeClass(value: string | Array<string>): this;
}

export class DrupalAttribute extends Map<string, DrupalAttributeEntry> {
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
    let classes = this.getClasses();

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
    let components = [];

    for (let key of this.keys()) {
      let value = this.get(key);

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
    let currentAttributes = Object.fromEntries(this);
    let newAttributes = Object.fromEntries(collection);

    // Perform a deep merge.
    let mergedAttributes = this.mergeDeep(currentAttributes, newAttributes);

    // Clear the current Map and set the merged attributes.
    this.clear();
    for (let key in mergedAttributes) {
      this.set(key, mergedAttributes[key]);
    }

    return this;
  }

  // Helper function for deep merging.
  mergeDeep(target: Record<string, DrupalAttributeEntry>, source: Record<string, DrupalAttributeEntry>) {
    for (let key in source) {
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

// Provide a default export for compatibility with legacy consumers and tooling.
export default DrupalAttribute;