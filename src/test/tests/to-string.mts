import {DrupalAttribute as DrupalAttributes} from "../../main/index.mjs";
import tape from "tape";

tape('toString', function(test) {
  test.test('should return an empty string when no attribute has been set', function (test) {
    const attribute = new DrupalAttributes();

    test.equal(attribute.toString(), '');
    test.end();
  });

  test.test('should return a valid HTML attribute string when at least one attribute has been set', function (test) {
    const attribute = new DrupalAttributes();

    attribute
      .setAttribute('foo', 'bar')
      .setAttribute('bar', 'foo')
      .setAttribute('foo-bar', ['foo', 'bar'])
    ;

    test.equal(attribute.toString(), ' foo="bar" bar="foo" foo-bar="foo bar"');
    test.end();
  });

  test.test('toString should skip nullish and false attributes but render empty strings', function(test) {
    const attribute = new DrupalAttributes();

    attribute.setAttribute('foo', null);
    attribute.setAttribute('bar', undefined);
    attribute.setAttribute('baz', false);
    attribute.setAttribute('qux', ''); // empty string -> key=""
    attribute.setAttribute('valid', 'ok');

    const output = attribute.toString();

    test.equal(output, ' qux="" valid="ok"', 'nullish/false should be skipped, empty strings should render as key=""');
    test.end();
  });

  test.test('toString should render empty-string data attributes to match Drupal PHP Attribute behavior', function(test) {
    // Regression: Drupal's \Drupal\Core\Template\Attribute renders
    // new Attribute(['data-platform' => '']) as ' data-platform=""'.
    // Production JS often relies on these as presence-selectors
    // (e.g. document.querySelectorAll('[data-platform]')), so the empty
    // attribute MUST be present in the output.
    const attribute = new DrupalAttributes();
    attribute.setAttribute('data-platform', '');

    test.equal(attribute.toString(), ' data-platform=""');
    test.end();
  });
});
