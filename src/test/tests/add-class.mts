import {DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

tape('addClass', function(test) {
  test.test('should support method chaining', function(test) {
    const attribute = new DrupalAttribute();

    test.equal(attribute.addClass('foo'), attribute);
    test.end();
  });

  test.test('should support being passed a string', function (test) {
    const attribute = new DrupalAttribute();

    attribute
      .addClass('foo')
      .addClass('bar')
    ;

    test.same(attribute.get('class'), ['foo', 'bar']);
    test.end();
  });

  test.test('should support being passed an array', function (test) {
    const attribute = new DrupalAttribute();

    attribute.addClass(['foo', 'bar']);

    test.same(attribute.get('class'), ['foo', 'bar']);
    test.end();
  });

  test.test('should keep duplicates in raw storage and dedupe at render', function (test) {
    // PHP defers deduplication to render time (array_unique in
    // AttributeArray::__toString), so raw storage retains both entries.
    const attribute = new DrupalAttribute();

    attribute
      .addClass('foo')
      .addClass('foo')
    ;

    test.same(attribute.get('class'), ['foo', 'foo']);
    test.equal(attribute.toString(), ' class="foo"');
    test.end();
  });

  test.test('should accept being passed multiple parameters', function (test) {
    const attribute = new DrupalAttribute();

    attribute
      .addClass('foo', 'bar', ['foo-bar', null, undefined], null, undefined)
    ;

    test.same(attribute.get('class'), ['foo', 'bar', 'foo-bar']);
    test.end();
  });

  test.test('should handle Map values in addClass', function(test) {
    const attribute = new DrupalAttribute();

    // Create a Map with classes as values
    const map = new Map();
    map.set('one', 'foo');
    map.set('two', 'bar');

    attribute.addClass(map);

    test.ok(attribute.hasClass('foo'), 'class foo should be added');
    test.ok(attribute.hasClass('bar'), 'class bar should be added');
    test.end();
  });
});