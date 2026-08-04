import {createAttribute, DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

// The `_keys` fixtures below reproduce exactly what twig.js hands to
// create_attribute(); see tests/twig-integration.mts for the same cases driven
// through a real twig.js render.
tape('createAttribute', function (test) {
  test.test('should return an empty collection when passed nothing', function (test) {
    test.equal(createAttribute().toString(), '');
    test.equal(createAttribute(null).toString(), '');
    test.equal(createAttribute(undefined).toString(), '');
    test.equal(createAttribute({}).toString(), '');
    test.end();
  });

  test.test('should return a DrupalAttribute', function (test) {
    test.ok(createAttribute({foo: 'bar'}) instanceof DrupalAttribute);
    test.end();
  });

  test.test('should never render the twig.js _keys bookkeeping property', function (test) {
    // The reported bug: `create_attribute({'data-slider-previous': ''})` emitted
    // `_keys="data-slider-previous"` into the markup.
    const attribute = createAttribute({
      'data-slider-previous': '',
      _keys: ['data-slider-previous'],
    });

    test.equal(attribute.toString(), ' data-slider-previous=""');
    test.end();
  });

  test.test('should not store _keys at all', function (test) {
    const attribute = createAttribute({foo: 'bar', _keys: ['foo']});

    test.equal(attribute.has('_keys'), false);
    test.same(Array.from(attribute.keys()), ['foo']);
    test.end();
  });

  test.test('should render in the order _keys declares, not enumeration order', function (test) {
    // twig.js builds the object out of order, so Object.keys() here is
    // ['c', '_keys', 'b', 'a'] while the template authored a, b, c.
    const attribute = createAttribute({
      c: '3',
      _keys: ['a', 'b', 'c'],
      b: '2',
      a: '1',
    });

    test.equal(attribute.toString(), ' a="1" b="2" c="3"');
    test.end();
  });

  test.test('should recover authored order when JS hoists integer-like keys', function (test) {
    // Object.keys() puts '1' and '2' first regardless of insertion order, so
    // `_keys` is the only record of what the template actually wrote.
    const attribute = createAttribute({
      '2': 'two',
      'b': 'bee',
      '1': 'one',
      _keys: ['2', 'b', '1'],
    });

    test.equal(attribute.toString(), ' 2="two" b="bee" 1="one"');
    test.end();
  });

  test.test('cannot recover integer-like key order without _keys', function (test) {
    // Documents the limit, not a target: a plain object has already hoisted '1'
    // and '2' by the time it is passed in, so there is nothing left to recover.
    // Only twig.js's `_keys` records the authored order. Pass entries or a Map
    // if order matters and you have no `_keys`.
    const attribute = createAttribute({'2': 'two', 'b': 'bee', '1': 'one'});

    test.equal(attribute.toString(), ' 1="one" 2="two" b="bee"');
    test.end();
  });

  test.test('should fall back to enumeration order when _keys is absent', function (test) {
    // Objects reaching create_attribute() from the render context rather than
    // from a template literal carry no `_keys`.
    const attribute = createAttribute({a: '1', b: '2'});

    test.equal(attribute.toString(), ' a="1" b="2"');
    test.end();
  });

  test.test('should keep attributes that a stale _keys omits', function (test) {
    const attribute = createAttribute({a: '1', b: '2', c: '3', _keys: ['c']});

    // Listed keys lead, unlisted keys follow in enumeration order — nothing is
    // dropped for being unaccounted for.
    test.equal(attribute.toString(), ' c="3" a="1" b="2"');
    test.end();
  });

  test.test('should ignore _keys entries that name no existing key', function (test) {
    const attribute = createAttribute({a: '1', _keys: ['ghost', 'a']});

    test.equal(attribute.has('ghost'), false);
    test.equal(attribute.toString(), ' a="1"');
    test.end();
  });

  test.test('should ignore a _keys that is not an array of strings', function (test) {
    // Defensive: a render-context object may legitimately hold a `_keys` field
    // of its own shape. It is still never rendered, but it cannot order anything.
    const attribute = createAttribute({a: '1', b: '2', _keys: 'nonsense'});

    test.equal(attribute.toString(), ' a="1" b="2"');
    test.end();
  });

  test.test('should ignore non-string entries inside _keys', function (test) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attribute = createAttribute({a: '1', b: '2', _keys: [null, 'b', 'a'] as any});

    test.equal(attribute.toString(), ' b="2" a="1"');
    test.end();
  });

  test.test('should force class to an array, as PHP createAttributeValue does', function (test) {
    const attribute = createAttribute({class: 'btn'});

    test.same(attribute.get('class'), ['btn']);
    test.equal(attribute.toString(), ' class="btn"');
    test.end();
  });

  test.test('should leave an existing class array alone', function (test) {
    const attribute = createAttribute({class: ['btn', 'btn--primary']});

    test.same(attribute.get('class'), ['btn', 'btn--primary']);
    test.end();
  });

  test.test('should accept a Map', function (test) {
    const attribute = createAttribute(new Map([['foo', 'bar']]));

    test.equal(attribute.get('foo'), 'bar');
    test.end();
  });

  test.test('should accept an array of entries', function (test) {
    const attribute = createAttribute([['foo', 'bar'], ['bar', 'foo']]);

    test.equal(attribute.get('foo'), 'bar');
    test.equal(attribute.get('bar'), 'foo');
    test.end();
  });

  test.test('should accept another DrupalAttribute and copy it', function (test) {
    const source = new DrupalAttribute().setAttribute('foo', 'bar');
    const attribute = createAttribute(source);

    test.equal(attribute.get('foo'), 'bar');

    // A copy, not the same collection: writing to the result leaves the source
    // untouched.
    attribute.setAttribute('added', '1');

    test.equal(source.has('added'), false);
    test.end();
  });

  test.test('should apply the usual render rules to twig-supplied values', function (test) {
    const attribute = createAttribute({
      'title': 'a"b<c>&d',
      'disabled': true,
      'hidden': false,
      'data-count': 0,
      'data-empty': '',
      _keys: ['title', 'disabled', 'hidden', 'data-count', 'data-empty'],
    });

    test.equal(
      attribute.toString(),
      ' title="a&quot;b&lt;c&gt;&amp;d" disabled data-count="0" data-empty=""'
    );
    test.end();
  });
});
