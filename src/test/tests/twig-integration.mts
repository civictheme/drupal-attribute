import Twig from "twig";
import {createAttribute, DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

// twig.js types declare template functions as returning a string. create_attribute
// returns a collection that twig.js stringifies at output time, which is the code
// path under test here — so it must not be pre-stringified.
type TwigFunction = (...params: unknown[]) => string;

Twig.extendFunction('create_attribute', createAttribute as unknown as TwigFunction);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (data: string, context: Record<string, any> = {}): string =>
  Twig.twig({data}).render(context) as string;

// These render through a real twig.js, which is what puts `_keys` on template
// object literals in the first place. Verified identical on twig.js 1.17.1 and
// 3.0.0. The unit equivalents live in tests/create-attribute.mts.
tape('twig.js integration', function (test) {
  test.test('should not leak _keys into rendered markup', function (test) {
    // The reported bug rendered:
    //   <button class="btn" _keys="data-slider-previous class">
    // which broke `[data-slider-previous]` selectors, because the attribute the
    // selector wanted was never emitted and a junk one was.
    const markup = render(
      `<button{{ create_attribute({'data-slider-previous': '', 'class': 'btn'}) }}></button>`
    );

    test.equal(markup, '<button data-slider-previous="" class="btn"></button>');
    test.end();
  });

  test.test('should render attributes in template order', function (test) {
    const markup = render(`<div{{ create_attribute({'a': '1', 'b': '2', 'c': '3'}) }}></div>`);

    test.equal(markup, '<div a="1" b="2" c="3"></div>');
    test.end();
  });

  test.test('should render integer-like keys in template order', function (test) {
    // Object.keys() hoists '1' and '2' ahead of 'b' here; only twig.js's `_keys`
    // records what the template wrote.
    const markup = render(`<div{{ create_attribute({'2': 'two', 'b': 'bee', '1': 'one'}) }}></div>`);

    test.equal(markup, '<div 2="two" b="bee" 1="one"></div>');
    test.end();
  });

  test.test('should render an object carried through a set and a merge', function (test) {
    const markup = render(
      `{% set attrs = {'a': '1'}|merge({'b': '2'}) %}<div{{ create_attribute(attrs) }}></div>`
    );

    test.equal(markup, '<div a="1" b="2"></div>');
    test.end();
  });

  test.test('should render an object supplied by the render context', function (test) {
    // Context objects never carry `_keys` — they are not template literals.
    const markup = render(
      `<div{{ create_attribute(attrs) }}></div>`,
      {attrs: {'data-x': '', 'class': 'ct'}}
    );

    test.equal(markup, '<div data-x="" class="ct"></div>');
    test.end();
  });

  test.test('should render valueless data attributes so selectors match', function (test) {
    const markup = render(
      `<div{{ create_attribute({'data-slider': '', 'data-open': false, 'hidden': true}) }}></div>`
    );

    test.equal(markup, '<div data-slider="" hidden></div>');
    test.end();
  });

  test.test('should escape values coming from the render context', function (test) {
    const markup = render(
      `<div{{ create_attribute({'title': title}) }}></div>`,
      {title: 'a"b<c>&d'}
    );

    test.equal(markup, '<div title="a&quot;b&lt;c&gt;&amp;d"></div>');
    test.end();
  });

  test.test('should support chained calls on the returned collection', function (test) {
    const markup = render(
      `<div{{ create_attribute({'class': 'btn'}).addClass('btn--primary') }}></div>`
    );

    test.equal(markup, '<div class="btn btn--primary"></div>');
    test.end();
  });

  test.test('should return a usable collection when called with no arguments', function (test) {
    const markup = render(`<div{{ create_attribute().addClass('ct') }}></div>`);

    test.equal(markup, '<div class="ct"></div>');
    test.end();
  });

  test.test('should hand the template a DrupalAttribute instance', function (test) {
    let captured: unknown;

    Twig.extendFunction('capture', ((value: unknown) => {
      captured = value;
      return '';
    }) as unknown as TwigFunction);

    render(`{{ capture(create_attribute({'a': '1'})) }}`);

    test.ok(captured instanceof DrupalAttribute);
    test.end();
  });
});
