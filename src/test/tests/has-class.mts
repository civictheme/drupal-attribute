import {DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

tape('hasClass', function(test) {
  test.test('should support being passed a string', function (test) {
    const attribute = new DrupalAttribute();

    attribute.addClass('foo');

    test.ok(attribute.hasClass('foo'));
    test.end();
  });

  test.test('should support being called on an instance with no class set', function (test) {
    const attribute = new DrupalAttribute();

    test.notOk(attribute.hasClass('foo'));
    test.end();
  });
});