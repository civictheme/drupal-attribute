import {createAttribute, DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

// `_keys` is Twig.js bookkeeping (see the comment on TWIG_KEY_ORDER_PROPERTY in
// src/main/index.mts). It must never reach markup, and there are four ways a
// consumer can put it into a collection. Every one of them is covered here,
// because the guarantee is only worth as much as its weakest entry point.
tape('_keys never renders', function (test) {
  test.test('via createAttribute()', function (test) {
    const attributes = createAttribute({
      'data-slider-previous': '',
      class: 'btn',
      _keys: ['data-slider-previous', 'class'],
    });

    test.equal(attributes.toString(), ' data-slider-previous="" class="btn"');

    test.end();
  });

  test.test('via the constructor', function (test) {
    const attributes = new DrupalAttribute({
      'data-slider-previous': '',
      class: 'btn',
      _keys: ['data-slider-previous', 'class'],
    });

    test.equal(attributes.toString(), ' data-slider-previous="" class="btn"');

    test.end();
  });

  // This is the path drupal-twig-extensions' own create_attribute takes: a
  // fresh collection, then one setAttribute() call per key of the mapping.
  test.test('via setAttribute()', function (test) {
    const mapping: Record<string, string | Array<string>> = {
      class: 'btn',
      _keys: ['data-slider-previous', 'class'],
      'data-slider-previous': '',
    };

    const attributes = new DrupalAttribute();

    Object.keys(mapping).forEach((key) => {
      attributes.setAttribute(key, mapping[key]);
    });

    test.equal(attributes.toString(), ' class="btn" data-slider-previous=""');
    test.equal(attributes.has('_keys'), false, 'is not stored at all');

    test.end();
  });

  // Map.set() bypasses setAttribute() entirely, so toString() has to hold the
  // line on its own.
  test.test('via raw Map.set()', function (test) {
    const attributes = new DrupalAttribute();

    attributes.set('_keys', ['class']);
    attributes.setAttribute('class', 'btn');

    test.equal(attributes.toString(), ' class="btn"');

    test.end();
  });

  // merge() rebuilds the collection with raw Map.set() calls, so a `_keys`
  // smuggled onto either side survives storage — but still must not render.
  test.test('through merge()', function (test) {
    const target = new DrupalAttribute({class: 'btn'});
    const source = new DrupalAttribute();

    source.set('_keys', ['class']);
    source.setAttribute('title', 'Go');

    test.equal(target.merge(source).toString(), ' class="btn" title="Go"');

    test.end();
  });

  test.end();
});

tape('an attribute named _keys is not confused with a real attribute', function (test) {
  // Nothing in HTML is named `_keys`, and Twig.js owns the name. Dropping it is
  // deliberate: an attribute that cannot be rendered should not be stored.
  const attributes = new DrupalAttribute();

  attributes.setAttribute('_keys', 'surprise');

  test.equal(attributes.size, 0);
  test.equal(attributes.toString(), '');

  test.end();
});

tape('the constructor and createAttribute() agree on Twig mappings', function (test) {
  const mapping = {
    '2': 'two',
    b: 'bee',
    '1': 'one',
    _keys: ['2', 'b', '1'],
  };

  test.equal(
    new DrupalAttribute(mapping).toString(),
    createAttribute(mapping).toString(),
  );

  // Authored order, not Object.keys() order — which hoists the integer-like
  // keys to the front and would give ' 1="one" 2="two" b="bee"'.
  test.equal(createAttribute(mapping).toString(), ' 2="two" b="bee" 1="one"');

  test.end();
});
