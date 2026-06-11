import {DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

tape('setAttribute', function (test) {
  test.test('should support method chaining', function (test) {
    let attribute = new DrupalAttribute();

    test.equal(attribute.setAttribute('foo', 'bar'), attribute);
    test.end();
  });

  test.test('should support being passed a key and a value', function (test) {
    let attribute = new DrupalAttribute();

    attribute.setAttribute('foo', 'bar');

    test.equal(attribute.get('foo'), 'bar');
    test.end();
  });

  test.test('should omit attributes set to false or null', function (test) {
    let attr = new DrupalAttribute()
      .setAttribute('disabled', false)
      .setAttribute('readonly', null);

    test.equal(attr.toString(), '');
    test.end();
  });

  test.test('should render true as a bare key', function (test) {
    // PHP AttributeBoolean::__toString renders ` required`, not
    // ` required="required"`.
    let attr = new DrupalAttribute()
      .setAttribute('required', true);

    test.equal(attr.toString(), ' required');
    test.end();
  });

  test.test('should store boolean true as-is, not as the key string', function (test) {
    let attr = new DrupalAttribute()
      .setAttribute('required', true);

    test.equal(attr.get('required'), true);
    test.end();
  });

  test.test('should normalise class arrays with space separation', function (test) {
    let attr = new DrupalAttribute()
      .setAttribute('class', ['foo', null, 'bar', '', undefined]);

    test.equal(attr.toString(), ' class="foo bar"');
    test.end();
  });

  test.test('should skip attributes with arrays of only empty values in toString', function(test) {
    let attribute = new DrupalAttribute();
    attribute.setAttribute('class', [null, undefined, '']); // filtered to []

    test.equal(attribute.toString(), ''); // nothing rendered
    test.end();
  });

  test.test('setAttribute(class) stores the raw array; toString filters at render', function(test) {
    // PHP setAttribute('class', ...) stores the raw array via AttributeArray;
    // empties are dropped only at render (array_filter in __toString).
    let attribute = new DrupalAttribute();
    attribute.setAttribute('class', ['foo', null, 'bar', '', undefined] as any);

    test.same(attribute.get('class'), ['foo', null, 'bar', '', undefined]);
    test.equal(attribute.toString(), ' class="foo bar"');
    test.end();
  });

  test.test('setAttribute(class) replaces a previously set class list', function(test) {
    // PHP creates a fresh AttributeArray on setAttribute('class', ...) — it
    // replaces rather than appends (unlike addClass).
    let attribute = new DrupalAttribute();
    attribute.setAttribute('class', ['foo', 'bar']);
    attribute.setAttribute('class', ['baz']);

    test.same(attribute.get('class'), ['baz']);
    test.end();
  });

  test.test('should render a bare key when setAttribute called with true', function(test) {
    let attribute = new DrupalAttribute();
    attribute.setAttribute('disabled', true);

    test.equal(attribute.toString(), ' disabled');
    test.end();
  });
});