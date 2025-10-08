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
          d = String(d);
          if (classes.indexOf(d) < 0) {
            classes.push(d);
          }
        });
      }
    });

    return this;
  }

  removeClass(value: string | Array<string>): this {
    const classes = this.getClasses();
    
    if (classes !== null) {
      if (!Array.isArray(value)) {
        value = [value];
      }

      value.forEach(function (v) {
        let index = classes.indexOf(v);

        if (index > -1) {
          classes.splice(index, 1);
        }
      });
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

    // Boolean true, render key="key".
    if (value === true) {
      this.set(key, key);
      return this;
    }

    // Reuse addClass method.
    if (key === 'class') {
      return this.addClass(value);
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

      // Skip nullish / falsey / empty attributes.
      if (value === null || value === undefined || value === false || value === '') {
        continue;
      }

      if (Array.isArray(value)) {

        // Remove nullish / empty values from array, and make sure all values
        // are converted to strings.
        const filtered = value
          .filter(v => v !== null && v !== undefined && v !== '')
          .map(String);

        // Skip empty arrays.
        if (filtered.length === 0) {
          continue;
        }

        value = filtered.join(' ');
      }

      components.push(`${key}="${String(value)}"`);
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