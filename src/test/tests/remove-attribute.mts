import {DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

tape('removeAttribute', function(test) {
  test.test('should support method chaining', function(test) {
    const attribute = new DrupalAttribute();

    test.equal(attribute.removeAttribute('foo'), attribute);
    test.end();
  });

  test.test('should support being passed a string', function (test) {
    const attribute = new DrupalAttribute();

    attribute
      .setAttribute('foo', 'bar')
      .removeAttribute('foo')
    ;

    test.notOk(attribute.get('foo'));
    test.end();
  });
});