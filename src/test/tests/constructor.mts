import {DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

tape('constructor', function (test) {
  test.test('should support being passed no parameter', function (test) {
    const attribute = new DrupalAttribute();

    test.ok(attribute);
    test.end();
  });

  test.test('should support being passed an iterable', function (test) {
    const attribute = new DrupalAttribute([
      ['foo', 'bar'],
      ['bar', 'foo']
    ]);

    test.equal(attribute.get('foo'), 'bar');
    test.equal(attribute.get('bar'), 'foo');
    test.end();
  });

  test.test('should support being passed a Map', function (test) {
    const attribute = new DrupalAttribute(new Map([['foo', 'bar']]));

    test.equal(attribute.get('foo'), 'bar');
    test.end();
  });

  test.test('should support being passed a plain object', function (test) {
    // PHP `new Attribute(['foo' => 'bar'])`.
    const attribute = new DrupalAttribute({foo: 'bar', bar: 'foo'});

    test.equal(attribute.get('foo'), 'bar');
    test.equal(attribute.get('bar'), 'foo');
    test.equal(attribute.toString(), ' foo="bar" bar="foo"');
    test.end();
  });

  test.test('should support being passed null', function (test) {
    test.equal(new DrupalAttribute(null).toString(), '');
    test.end();
  });

  test.test('should route entries through setAttribute', function (test) {
    // PHP Attribute::__construct loops over the input calling offsetSet(), so
    // constructor input gets the same treatment as later assignment: `class` is
    // forced to an array, and false/nullish values are omitted.
    const fromObject = new DrupalAttribute({class: 'btn', hidden: false, title: null});
    const fromEntries = new DrupalAttribute([['class', 'btn']]);

    test.same(fromObject.get('class'), ['btn']);
    test.equal(fromObject.has('hidden'), false);
    test.equal(fromObject.has('title'), false);
    test.same(fromEntries.get('class'), ['btn']);
    test.end();
  });

  test.test('should read the twig.js _keys property', function (test) {
    // 2.0.0 kept `_keys` handling in createAttribute() alone, on the reasoning
    // that the constructor is the generic entry point. That split leaked: every
    // consumer that builds a collection directly — drupal-twig-extensions and
    // twig-testing-library both do — rendered `_keys` as an attribute. The
    // constructor now consumes it like createAttribute() always has.
    const attribute = new DrupalAttribute({foo: 'bar', _keys: ['foo']});

    test.equal(attribute.has('_keys'), false);
    test.equal(attribute.toString(), ' foo="bar"');
    test.end();
  });
});