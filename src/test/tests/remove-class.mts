import {DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

tape('removeClass', function(test) {
  test.test('should support method chaining', function(test) {
    const attribute = new DrupalAttribute();

    test.equal(attribute.removeClass('foo'), attribute);
    test.end();
  });

  test.test('should support being passed a string', function (test) {
    const attribute = new DrupalAttribute();

    attribute
      .addClass('foo')
      .addClass('bar')
      .removeClass('bar')
    ;

    test.same(attribute.get('class'), ['foo']);
    test.end();
  });

  test.test('should support being passed an array', function (test) {
    const attribute = new DrupalAttribute();

    attribute
      .addClass(['foo', 'bar', 'foo-bar'])
      .removeClass(['foo', 'foo-bar'])
    ;

    test.same(attribute.get('class'), ['bar']);
    test.end();
  });

  test.test('should support being called on an instance with no class set', function (test) {
    const attribute = new DrupalAttribute();

    attribute
      .removeClass(['bar'])
    ;

    test.notOk(attribute.get('class'));
    test.end();
  });

  test.test('should support being called on a unregistered class', function (test) {
    const attribute = new DrupalAttribute();

    attribute
      .addClass('foo')
      .removeClass('bar')
    ;

    test.same(attribute.get('class'), ['foo']);
    test.end();
  });

  test.test('should remove ALL occurrences of a duplicated class and re-index', function (test) {
    // PHP Attribute::removeClass uses array_diff + array_values: every match
    // is removed and the result is re-indexed. Duplicates can exist because
    // addClass defers deduplication to render time.
    const attribute = new DrupalAttribute();

    attribute
      .addClass('foo', 'bar', 'foo')
      .removeClass('foo')
    ;

    test.same(attribute.get('class'), ['bar']);
    test.end();
  });
});