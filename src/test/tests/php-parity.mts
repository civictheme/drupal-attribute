import {DrupalAttribute, type DrupalAttributeEntry} from "../../main/index.mjs";
import tape from "tape";

// Tests that lock in behavior matching Drupal core's
// \Drupal\Core\Template\Attribute (PHP) behavior, derived from
// reading core/lib/Drupal/Core/Template/Attribute*.php and
// core/tests/Drupal/Tests/Core/Template/AttributeTest.php.
//
// Reference behavior was verified via `drush php:cli` against a
// running Drupal site.

tape('PHP Drupal Attribute parity', function(test) {

  test.test('toString renders numeric zero as key="0"', function(test) {
    // PHP: (string) new Attribute(['data-count' => 0]) === ' data-count="0"'
    // 0 is falsy in JS but distinct from `false` under strict equality,
    // so it must not be skipped by the nullish/false guard.
    const attr = new DrupalAttribute();
    attr.setAttribute('data-count', 0);

    test.equal(attr.toString(), ' data-count="0"');
    test.end();
  });

  test.test('toString renders string "0" as key="0"', function(test) {
    const attr = new DrupalAttribute();
    attr.setAttribute('data-count', '0');

    test.equal(attr.toString(), ' data-count="0"');
    test.end();
  });

  test.test('toString renders negative numbers', function(test) {
    const attr = new DrupalAttribute();
    attr.setAttribute('data-offset', -42);

    test.equal(attr.toString(), ' data-offset="-42"');
    test.end();
  });

  test.test('toString preserves insertion order across setAttribute calls', function(test) {
    // PHP Attribute iterates its ArrayIterator over storage in insertion
    // order; consumers (e.g. snapshot tests) rely on this determinism.
    const attr = new DrupalAttribute();
    attr.setAttribute('z', '1');
    attr.setAttribute('a', '2');
    attr.setAttribute('m', '3');

    test.equal(attr.toString(), ' z="1" a="2" m="3"');
    test.end();
  });

  test.test('toString skips an attribute whose value is later set to null', function(test) {
    // setAttribute(key, null) calls this.delete(key) — the attribute is
    // removed from storage, not stored as null. Verify the key really
    // disappears (no 'foo' in output).
    const attr = new DrupalAttribute();
    attr.setAttribute('foo', 'bar');
    attr.setAttribute('foo', null);

    test.equal(attr.toString(), '');
    test.end();
  });

  test.test('setAttribute overwrites a previously set scalar', function(test) {
    const attr = new DrupalAttribute();
    attr.setAttribute('id', 'old');
    attr.setAttribute('id', 'new');

    test.equal(attr.get('id'), 'new');
    test.equal(attr.toString(), ' id="new"');
    test.end();
  });

  test.test('removeAttribute removes a previously set attribute', function(test) {
    const attr = new DrupalAttribute();
    attr
      .setAttribute('id', 'foo')
      .setAttribute('class', ['bar'])
      .removeAttribute('id');

    test.equal(attr.get('id'), undefined);
    test.equal(attr.toString(), ' class="bar"');
    test.end();
  });

  test.test('removeAttribute is a no-op for an absent attribute', function(test) {
    const attr = new DrupalAttribute();
    attr.setAttribute('id', 'foo');

    test.doesNotThrow(() => attr.removeAttribute('does-not-exist'));
    test.equal(attr.toString(), ' id="foo"');
    test.end();
  });

  test.test('hasClass returns false for an uninitialized class attribute', function(test) {
    const attr = new DrupalAttribute();

    test.equal(attr.hasClass('foo'), false);
    test.end();
  });

  test.test('hasClass tracks state across addClass/removeClass cycles', function(test) {
    const attr = new DrupalAttribute();
    attr.addClass('foo');
    test.equal(attr.hasClass('foo'), true);

    attr.removeClass('foo');
    test.equal(attr.hasClass('foo'), false);

    attr.addClass('foo');
    test.equal(attr.hasClass('foo'), true);
    test.end();
  });

  test.test('addClass returns the same instance for chaining', function(test) {
    const attr = new DrupalAttribute();

    test.equal(attr.addClass('foo'), attr);
    test.end();
  });

  test.test('addClass stores duplicates raw and deduplicates at render', function(test) {
    // PHP Attribute::addClass appends without deduplicating; the class list is
    // run through array_unique only at render (AttributeArray::__toString).
    // Raw storage therefore keeps the duplicate; toString collapses it.
    const attr = new DrupalAttribute();
    attr.addClass('foo', 'foo', 'bar');

    test.same(attr.get('class'), ['foo', 'foo', 'bar']);
    test.equal(attr.toString(), ' class="foo bar"');
    test.end();
  });

  test.test('toString combines mixed scalar and array values correctly', function(test) {
    const attr = new DrupalAttribute();
    attr
      .setAttribute('id', 'main')
      .setAttribute('data-platform', '')
      .setAttribute('class', ['ct-link', 'ct-theme-light'])
      .setAttribute('tabindex', 0)
      .setAttribute('hidden', true);

    test.equal(
      attr.toString(),
      ' id="main" data-platform="" class="ct-link ct-theme-light" tabindex="0" hidden'
    );
    test.end();
  });

  test.test('merge: scalar from source overwrites scalar in target', function(test) {
    // PHP NestedArray::mergeDeep behavior: non-array values from the second
    // array replace those in the first.
    const attr1 = new DrupalAttribute();
    attr1.setAttribute('id', 'old');

    const attr2 = new DrupalAttribute();
    attr2.setAttribute('id', 'new');

    attr1.merge(attr2);

    test.equal(attr1.get('id'), 'new');
    test.end();
  });

  test.test('merge: scalar from source replaces array in target', function(test) {
    // PHP semantics: when source value is scalar and target was array,
    // mergeDeep falls through to `target[key] = source[key]`.
    const attr1 = new DrupalAttribute();
    attr1.setAttribute('class', ['a', 'b']);

    const attr2 = new DrupalAttribute();
    attr2.setAttribute('id', 'foo');

    attr1.merge(attr2);

    test.same(attr1.get('class'), ['a', 'b']);
    test.equal(attr1.get('id'), 'foo');
    test.end();
  });

  test.test('iteration via for...of yields [key, value] tuples in insertion order', function(test) {
    // DrupalAttribute extends Map; consumers can iterate via for...of as a
    // counterpart to PHP's foreach over the Attribute object.
    const attr = new DrupalAttribute();
    attr.setAttribute('a', '1');
    attr.setAttribute('b', '2');

    const collected: Array<[string, DrupalAttributeEntry]> = [];
    for (const entry of attr) {
      collected.push(entry);
    }

    test.same(collected, [['a', '1'], ['b', '2']]);
    test.end();
  });

  test.test('addClass with a single empty string is a no-op', function(test) {
    // PHP: $attr->addClass(''); $attr->__toString() === '' — the empty
    // string is filtered before being added to the class list.
    const attr = new DrupalAttribute();
    attr.addClass('');

    test.equal(attr.toString(), '');
    test.end();
  });
});
