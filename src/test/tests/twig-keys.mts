import {createAttribute, DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

// Four ways `_keys` can enter a collection. All four are covered here.
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

  // The path drupal-twig-extensions' create_attribute takes.
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

  // Map.set() bypasses setAttribute(), so toString() holds the line alone.
  test.test('via raw Map.set()', function (test) {
    const attributes = new DrupalAttribute();

    attributes.set('_keys', ['class']);
    attributes.setAttribute('class', 'btn');

    test.equal(attributes.toString(), ' class="btn"');

    test.end();
  });

  // merge() rebuilds with raw Map.set(), so a smuggled `_keys` survives storage.
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
  // Twig.js owns the name, so it is dropped rather than stored.
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

  // Authored order. Object.keys() would give ' 1="one" 2="two" b="bee"'.
  test.equal(createAttribute(mapping).toString(), ' 2="two" b="bee" 1="one"');

  test.end();
});
