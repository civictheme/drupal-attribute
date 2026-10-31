import Twig from "twig";
import {DrupalAttribute, type DrupalAttributeEntry} from "../../main/index.mjs";
import tape from "tape";

// A one-for-one port of Drupal core's Attribute unit test:
// core/tests/Drupal/Tests/Core/Template/AttributeTest.php (Drupal 11.3.x).
// Each subtest carries the PHP test method it ports. PHP-isms translate as:
//
//   $attributes['name']          -> offsetGet('name')
//   $attributes['name'] = $v     -> offsetSet('name', $v)
//   isset($attributes['name'])   -> offsetExists('name')
//   unset($attributes['name'])   -> offsetUnset('name')
//   $attributes['class'][] = 'x' -> offsetGet('class').push('x')  (live array)
//   $attribute['class']->value() -> offsetGet('class')            (raw array)
//   (string) $attribute['class'] -> getClass()                    (rendered)
//   (string) $attribute          -> toString()
//
// PHP wraps values in AttributeValueBase objects; this library stores raw
// values, so value() reads collapse to offsetGet. Two PHP-only behaviors have
// no JS analog and are noted inline where their cases are adapted or skipped:
// AttributeBoolean(FALSE) storage, and MarkupInterface tag-stripping.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = (data: string, context: Record<string, any> = {}): string =>
  Twig.twig({data}).render(context) as string;

tape('Drupal core AttributeTest port', function (test) {

  // Ports testAttributeValueBaseCopy.
  test.test('attribute values copy across instances under new names', function (test) {
    const originalAttributes = new DrupalAttribute({
      'checked': true,
      'class': ['who', 'is', 'on'],
      'id': 'first',
    });
    const attributes = new DrupalAttribute({
      'selected': originalAttributes.offsetGet('checked'),
      'id': originalAttributes.offsetGet('id'),
    });

    test.equal(originalAttributes.toString(), ' checked class="who is on" id="first"', 'Original boolean value used with original name.');
    test.equal(attributes.toString(), ' selected id="first"', 'Original boolean value used with new name.');
    test.end();
  });

  // Ports testConstructor.
  test.test('constructor', function (test) {
    let attribute = new DrupalAttribute({'class': ['example-class']});
    test.ok(attribute.offsetExists('class'));
    test.same(attribute.offsetGet('class'), ['example-class']);

    // Test adding boolean attributes through the constructor. PHP stores
    // AttributeBoolean(FALSE) and value() returns FALSE; this library drops
    // false at storage time instead, so the read returns null. Both render
    // nothing, which the toString assertion locks in.
    attribute = new DrupalAttribute({'selected': true, 'checked': false});
    test.equal(attribute.offsetGet('selected'), true);
    test.equal(attribute.offsetGet('checked'), null);
    test.equal(attribute.toString(), ' selected');

    // Test that non-array values with name "class" are cast to array.
    attribute = new DrupalAttribute({'class': 'example-class'});
    test.ok(attribute.offsetExists('class'));
    test.same(attribute.offsetGet('class'), ['example-class']);

    // Test that safe string objects work correctly. PHP prophesizes a
    // MarkupInterface; the JS analog is any Stringable object, which the
    // 'class' cast stringifies on the way in.
    const safeString = {toString: () => 'example-class'};
    attribute = new DrupalAttribute({'class': safeString});
    test.ok(attribute.offsetExists('class'));
    test.same(attribute.offsetGet('class'), ['example-class']);
    test.end();
  });

  // Ports testSet.
  test.test('set of values', function (test) {
    const attribute = new DrupalAttribute();
    attribute.offsetSet('class', ['example-class']);

    test.ok(attribute.offsetExists('class'));
    test.same(attribute.offsetGet('class'), ['example-class']);
    test.end();
  });

  // Ports testAdd.
  test.test('adding new values to an existing part of the attribute', function (test) {
    const attribute = new DrupalAttribute({'class': ['example-class']});

    (attribute.offsetGet('class') as Array<string>).push('other-class');
    test.same(attribute.offsetGet('class'), ['example-class', 'other-class']);
    test.end();
  });

  // Ports testRemove.
  test.test('removing of values', function (test) {
    const attribute = new DrupalAttribute({'class': ['example-class']});
    attribute.offsetUnset('class');
    test.notOk(attribute.offsetExists('class'));
    test.end();
  });

  // Ports testSetAttribute.
  test.test('setting attributes', function (test) {
    // Test adding various attributes.
    const attributes = ['alt', 'id', 'src', 'title', 'value'];
    for (const key of attributes) {
      for (const value of ['kitten', '']) {
        const attribute = new DrupalAttribute();
        attribute.setAttribute(key, value);
        test.equal(attribute.offsetGet(key), value);
      }
    }

    // Test adding array to class.
    let attribute = new DrupalAttribute();
    attribute.setAttribute('class', ['kitten', 'cat']);
    test.same(attribute.offsetGet('class'), ['kitten', 'cat']);

    // Test adding boolean attributes.
    attribute = new DrupalAttribute();
    attribute.offsetSet('checked', true);
    test.equal(attribute.offsetGet('checked'), true);
    test.end();
  });

  // Ports testRemoveAttribute.
  test.test('removing attributes', function (test) {
    const attribute = new DrupalAttribute({
      'alt': 'Alternative text',
      'id': 'bunny',
      'src': 'zebra',
      'style': 'color: pink;',
      'title': 'kitten',
      'value': 'ostrich',
      'checked': true,
    });

    // Single value.
    attribute.removeAttribute('alt');
    test.equal(attribute.offsetGet('alt'), null);

    // Multiple values.
    attribute.removeAttribute('id', 'src');
    test.equal(attribute.offsetGet('id'), null);
    test.equal(attribute.offsetGet('src'), null);

    // Single value in array.
    attribute.removeAttribute(['style']);
    test.equal(attribute.offsetGet('style'), null);

    // Boolean value.
    attribute.removeAttribute('checked');
    test.equal(attribute.offsetGet('checked'), null);

    // Multiple values in array.
    attribute.removeAttribute(['title', 'value']);
    test.equal(attribute.toString(), '');
    test.end();
  });

  // Ports testAddClasses.
  test.test('adding class attributes with the AttributeArray helper method', function (test) {
    // Add a class with the array syntax without first initializing the
    // 'class' attribute: offsetGet('class') initializes and returns the live
    // stored array, as PHP's `$attribute['class'][]` append syntax relies on.
    let attribute = new DrupalAttribute();
    (attribute.offsetGet('class') as Array<string>).push('test-class');
    test.same(attribute.offsetGet('class'), ['test-class']);

    attribute = new DrupalAttribute();
    // Add no class on empty attribute.
    attribute.addClass();
    test.same(attribute.offsetGet('class'), []);

    // Test various permutations of adding values to empty Attribute objects.
    for (const value of [null, false, '', []]) {
      // Single value.
      attribute.addClass(value);
      test.equal(attribute.toString(), '');

      // Multiple values.
      attribute.addClass(value, value);
      test.equal(attribute.toString(), '');

      // Single value in array.
      attribute.addClass([value as string]);
      test.equal(attribute.toString(), '');

      // Single value in arrays.
      attribute.addClass([value as string], [value as string]);
      test.equal(attribute.toString(), '');
    }

    // Add one class on empty attribute.
    attribute.addClass('banana');
    test.same(attribute.offsetGet('class'), ['banana']);

    // Add one class.
    attribute.addClass('aa');
    test.same(attribute.offsetGet('class'), ['banana', 'aa']);

    // Add multiple classes.
    attribute.addClass('xx', 'yy');
    test.same(attribute.offsetGet('class'), ['banana', 'aa', 'xx', 'yy']);

    // Add an array of classes.
    attribute.addClass(['red', 'green', 'blue']);
    test.same(attribute.offsetGet('class'), ['banana', 'aa', 'xx', 'yy', 'red', 'green', 'blue']);

    // Add an array of duplicate classes. PHP casts $attribute['class'] to a
    // string here; getClass() is the rendered-string analog.
    attribute.addClass(['red', 'green', 'blue'], ['aa', 'aa', 'banana'], 'yy');
    test.equal(attribute.getClass(), 'banana aa xx yy red green blue');
    test.end();
  });

  // Ports testRemoveClasses.
  test.test('removing class attributes with the AttributeArray helper method', function (test) {
    // Add duplicate class to ensure that both duplicates are removed.
    const classes = ['example-class', 'aa', 'xx', 'yy', 'red', 'green', 'blue', 'red'];
    const attribute = new DrupalAttribute({'class': classes});

    // Remove one class.
    attribute.removeClass('example-class');
    test.notOk((attribute.offsetGet('class') as Array<string>).includes('example-class'));

    // Remove multiple classes.
    attribute.removeClass('xx', 'yy');
    test.notOk((attribute.offsetGet('class') as Array<string>).some((c) => ['xx', 'yy'].includes(c)));

    // Remove an array of classes.
    attribute.removeClass(['red', 'green', 'blue']);
    test.notOk((attribute.offsetGet('class') as Array<string>).some((c) => ['red', 'green', 'blue'].includes(c)));

    // Remove a class that does not exist.
    attribute.removeClass('gg');
    test.notOk((attribute.offsetGet('class') as Array<string>).includes('gg'));
    // Test that the array index remains sequential.
    test.same(attribute.offsetGet('class'), ['aa']);

    attribute.removeClass('aa');
    test.equal(attribute.toString(), '');
    test.end();
  });

  // Ports testHasClass.
  test.test('checking for class names with the Attribute method', function (test) {
    // Test an attribute without any classes.
    const attribute = new DrupalAttribute();
    test.notOk(attribute.hasClass('a-class-nowhere-to-be-found'));

    // Add a class to check for.
    attribute.addClass('we-totally-have-this-class');
    // Check that this class exists.
    test.ok(attribute.hasClass('we-totally-have-this-class'));
    test.end();
  });

  // Ports testChainAddRemoveClasses.
  test.test('removing class attributes with the Attribute helper methods', function (test) {
    const attribute = new DrupalAttribute(
      {'class': ['example-class', 'red', 'green', 'blue']}
    );

    attribute
      .removeClass(['red', 'green', 'pink'])
      .addClass(['apple', 'lime', 'grapefruit'])
      .addClass(['banana']);
    const expected = ['example-class', 'blue', 'apple', 'lime', 'grapefruit', 'banana'];
    test.same(attribute.offsetGet('class'), expected, 'Attributes chained');
    test.end();
  });

  // Ports testTwigAddRemoveClasses with providerTestAttributeClassHelpers.
  // PHP renders through a real Twig; this renders through a real twig.js,
  // which resolves `attributes.class` via getClass() exactly as PHP Twig does.
  test.test('twig calls to the Attribute', function (test) {
    // cSpell:disable
    const provider: Array<[string, string, Record<string, DrupalAttributeEntry>?]> = [
      ["{{ attributes.class }}", ''],
      ["{{ attributes.addClass('everest').class }}", 'everest'],
      ["{{ attributes.addClass(['k2', 'kangchenjunga']).class }}", 'k2 kangchenjunga'],
      ["{{ attributes.addClass('lhotse', 'makalu', 'cho-oyu').class }}", 'lhotse makalu cho-oyu'],
      [
        "{{ attributes.addClass('nanga-parbat').class }}",
        'dhaulagiri manaslu nanga-parbat',
        {'class': ['dhaulagiri', 'manaslu']},
      ],
      [
        "{{ attributes.removeClass('annapurna').class }}",
        'gasherbrum-i',
        {'class': ['annapurna', 'gasherbrum-i']},
      ],
      [
        "{{ attributes.removeClass(['broad peak']).class }}",
        'gasherbrum-ii',
        {'class': ['broad peak', 'gasherbrum-ii']},
      ],
      [
        "{{ attributes.removeClass('gyachung-kang', 'shishapangma').class }}",
        '',
        {'class': ['shishapangma', 'gyachung-kang']},
      ],
      [
        "{{ attributes.removeClass('nuptse').addClass('annapurna-ii').class }}",
        'himalchuli annapurna-ii',
        {'class': ['himalchuli', 'nuptse']},
      ],
      // Test for the removal of an empty class name.
      ["{{ attributes.addClass('rakaposhi', '').class }}", 'rakaposhi'],
    ];
    // cSpell:enable

    for (const [template, expected, seedAttributes] of provider) {
      const result = render(template, {attributes: new DrupalAttribute(seedAttributes ?? {})});
      test.equal(result, expected, template);
    }
    test.end();
  });

  // Ports testIterate.
  test.test('iterating on the values of the attribute', function (test) {
    const attribute = new DrupalAttribute({'class': ['example-class'], 'id': 'example-id'});

    let counter = 0;
    for (const [key, value] of attribute) {
      if (counter === 0) {
        test.equal(key, 'class');
        test.same(value, ['example-class']);
      }
      if (counter === 1) {
        test.equal(key, 'id');
        test.equal(value, 'example-id');
      }
      counter++;
    }
    test.equal(counter, 2);
    test.end();
  });

  // Ports testPrint. PHP asserts through DOM XPath on a random content
  // string; the rendered attribute string carries the same assertions.
  test.test('printing of an attribute', function (test) {
    const attribute = new DrupalAttribute({'class': ['example-class'], 'id': 'example-id', 'enabled': true});

    const content = 'example content';
    const html = '<div' + attribute + '>' + content + '</div>';
    test.ok(html.includes('class="example-class"'));
    test.notOk(html.includes('example-class2'));

    test.ok(html.includes('id="example-id"'));
    test.notOk(html.includes('example-id2'));

    test.ok(html.includes('enabled'));
    test.equal(html, '<div class="example-class" id="example-id" enabled>example content</div>');
    test.end();
  });

  // Ports testAttributeValues with providerTestAttributeValues. The PHP
  // safe-object cases (Markup::create) exercise MarkupInterface detection and
  // PlainTextOutput tag-stripping, machinery with no JS analog — they are the
  // one omission. Their non-safe twins and the Twig\Markup case port: a plain
  // string escapes, and a Stringable object stringifies then escapes.
  test.test('attribute values', function (test) {
    const xss1 = '"> <script>alert(123)</script>"';
    const xss2 = '&quot;><script>alert(123)</script>';

    const provider: Record<string, [Record<string, DrupalAttributeEntry>, string]> = {
      'HTML-encoded attribute name': [{'&"\'<>': 'value'}, ' &amp;&quot;&#039;&lt;&gt;="value"'],
      'HTML-encoded attribute value': [{'title': '&"\'<>'}, ' title="&amp;&quot;&#039;&lt;&gt;"'],
      'multi-value attribute': [{'class': ['first', 'last']}, ' class="first last"'],
      'true boolean attribute': [{'disabled': true}, ' disabled'],
      'false boolean attribute': [{'disabled': false}, ''],
      'empty attribute value': [{'alt': ''}, ' alt=""'],
      'null attribute value': [{'alt': null}, ''],
      'multiple attributes': [
        {
          'id': 'id-test',
          'class': ['first', 'last'],
          'alt': 'Alternate',
        },
        ' id="id-test" class="first last" alt="Alternate"',
      ],
      'empty attributes array': [{}, ''],
      'non-safe-object-xss1': [{'title': xss1}, ' title="&quot;&gt; &lt;script&gt;alert(123)&lt;/script&gt;&quot;"'],
      'non-safe-object-xss2': [{'title': xss2}, ' title="&amp;quot;&gt;&lt;script&gt;alert(123)&lt;/script&gt;"'],
      // \Twig\Markup objects are generated when using twig defined variables
      // like `{% set xxx %}Foo{% endset %}`; any Stringable object takes the
      // same path here.
      'twig-markup': [{'title': {toString: () => 'foo'}}, ' title="foo"'],
    };

    for (const [name, [attributes, expected]] of Object.entries(provider)) {
      test.equal(new DrupalAttribute(attributes).toString(), expected, name);
    }
    test.end();
  });

  // Ports testStorage. PHP's storage() returns the raw internal array of
  // AttributeValueBase objects; the Map's own entries are the JS storage.
  test.test('the storage method', function (test) {
    const attribute = new DrupalAttribute({'class': ['example-class']});

    test.same(Array.from(attribute.entries()), [['class', ['example-class']]]);
    test.end();
  });

  // Ports testHasAttribute with providerTestHasAttribute.
  test.test('has attribute', function (test) {
    const provider: Array<[Record<string, DrupalAttributeEntry>, string, boolean]> = [
      [{'class': ['example-class']}, 'class', true],
      [{}, 'class', false],
      [{'class': ['example-class']}, 'id', false],
      [{'class': ['example-class'], 'id': 'foo'}, 'id', true],
      [{'id': 'foo'}, 'class', false],
    ];

    for (const [testData, testAttribute, expected] of provider) {
      const attributes = new DrupalAttribute(testData);
      test.equal(attributes.hasAttribute(testAttribute), expected);
    }
    test.end();
  });

  // Ports testMerge with providerTestMerge. Equality compares entries and
  // rendered output, the observable surface of PHP's assertEquals on objects.
  test.test('merge', function (test) {
    const provider: Array<[DrupalAttribute, DrupalAttribute, DrupalAttribute]> = [
      [
        new DrupalAttribute({}),
        new DrupalAttribute({'class': ['class1']}),
        new DrupalAttribute({'class': ['class1']}),
      ],
      [
        new DrupalAttribute({'class': ['example-class']}),
        new DrupalAttribute({'class': ['class1']}),
        new DrupalAttribute({'class': ['example-class', 'class1']}),
      ],
      [
        new DrupalAttribute({'class': ['example-class']}),
        new DrupalAttribute({'id': 'foo', 'href': 'bar'}),
        new DrupalAttribute({
          'class': ['example-class'],
          'id': 'foo',
          'href': 'bar',
        }),
      ],
    ];

    for (const [original, merge, expected] of provider) {
      const result = original.merge(merge);
      test.same(Array.from(result.entries()), Array.from(expected.entries()));
      test.equal(result.toString(), expected.toString());
    }
    test.end();
  });

  // Ports testMergeArgumentException.
  test.test('merge argument exception', function (test) {
    const attributes = new DrupalAttribute({'class': ['example-class']});
    test.throws(
      () => attributes.merge('not an array' as unknown as DrupalAttribute),
      TypeError
    );
    test.end();
  });
});
