import {DrupalAttribute} from "../../main/index.mjs";
import tape from "tape";

// Locks in HTML escaping behavior for parity with Drupal core's
// \Drupal\Component\Utility\Html::escape(), which is
// htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').
//
// Reference behavior verified against PHP via `drush php:cli`:
//   print htmlspecialchars('a"b<c>&d\'', ENT_QUOTES, 'UTF-8');
//   // a&quot;b&lt;c&gt;&amp;d&#039;
//
// The apostrophe MUST render as '&#039;' (three-digit, leading zero) — that
// is the byte PHP emits without ENT_HTML5. Other JS escapers (escape-html,
// React, Vue) emit '&#39;' or '&#x27;' which would diff in snapshot tests
// against Drupal-rendered output.

tape('HTML escaping', function(test) {

  test.test('toString escapes & in attribute values', function(test) {
    let attr = new DrupalAttribute();
    attr.setAttribute('data-q', 'a&b');

    test.equal(attr.toString(), ' data-q="a&amp;b"');
    test.end();
  });

  test.test('toString escapes " in attribute values', function(test) {
    // The literal " character must be escaped or it terminates the attribute
    // value early — this is the core attribute-injection vector.
    let attr = new DrupalAttribute();
    attr.setAttribute('title', 'a"b');

    test.equal(attr.toString(), ' title="a&quot;b"');
    test.end();
  });

  test.test("toString escapes ' as &#039; (PHP htmlspecialchars parity, not &#39; or &#x27;)", function(test) {
    let attr = new DrupalAttribute();
    attr.setAttribute('title', "a'b");

    test.equal(attr.toString(), ' title="a&#039;b"');
    test.end();
  });

  test.test('toString escapes < in attribute values', function(test) {
    let attr = new DrupalAttribute();
    attr.setAttribute('title', 'a<b');

    test.equal(attr.toString(), ' title="a&lt;b"');
    test.end();
  });

  test.test('toString escapes > in attribute values', function(test) {
    let attr = new DrupalAttribute();
    attr.setAttribute('title', 'a>b');

    test.equal(attr.toString(), ' title="a&gt;b"');
    test.end();
  });

  test.test('toString escapes a combined-character string with byte parity to PHP', function(test) {
    // PHP: htmlspecialchars('a"b<c>&d\'', ENT_QUOTES, 'UTF-8')
    //   === 'a&quot;b&lt;c&gt;&amp;d&#039;'
    let attr = new DrupalAttribute();
    attr.setAttribute('data-x', "a\"b<c>&d'");

    test.equal(attr.toString(), ' data-x="a&quot;b&lt;c&gt;&amp;d&#039;"');
    test.end();
  });

  test.test('toString escapes the attribute KEY too, matching Drupal AttributeValueBase::render', function(test) {
    // PHP escapes attribute names as well as values. A key with embedded "
    // would otherwise terminate the previous attribute and inject markup.
    let attr = new DrupalAttribute();
    attr.set('data-x"', 'v');

    test.equal(attr.toString(), ' data-x&quot;="v"');
    test.end();
  });

  test.test('toString escapes < and > in attribute keys', function(test) {
    let attr = new DrupalAttribute();
    attr.set('a<b>', 'v');

    test.equal(attr.toString(), ' a&lt;b&gt;="v"');
    test.end();
  });

  test.test('toString escapes class-array items joined with spaces', function(test) {
    // Spaces between class items are not in the entity table, so they pass
    // through. Each item's special characters get escaped after the join.
    let attr = new DrupalAttribute();
    attr.setAttribute('class', ['ct-a', 'ct-<b>', 'ct-&c']);

    test.equal(attr.toString(), ' class="ct-a ct-&lt;b&gt; ct-&amp;c"');
    test.end();
  });

  test.test('toString re-escapes already-escaped input ("&amp;" becomes "&amp;amp;"), matching PHP', function(test) {
    // PHP htmlspecialchars is iterative — it does not detect already-encoded
    // entities. "&amp;" goes in, "&amp;amp;" comes out. Don't try to be
    // clever and skip; that would diverge from PHP.
    let attr = new DrupalAttribute();
    attr.setAttribute('data-x', '&amp;');

    test.equal(attr.toString(), ' data-x="&amp;amp;"');
    test.end();
  });

  test.test('toString prevents attribute-injection XSS via stray quote in value', function(test) {
    // Regression for the original vulnerability: an unescaped " in a value
    // would close the attribute and let the rest of the payload land as
    // separate attributes (e.g. an event handler).
    let attr = new DrupalAttribute();
    attr.setAttribute('title', 'safe" onerror="alert(1)');

    test.equal(
      attr.toString(),
      ' title="safe&quot; onerror=&quot;alert(1)"'
    );
    test.end();
  });

  test.test('toString escapes <script>-style payloads in values', function(test) {
    let attr = new DrupalAttribute();
    attr.setAttribute('data-payload', '<script>alert(1)</script>');

    test.equal(
      attr.toString(),
      ' data-payload="&lt;script&gt;alert(1)&lt;/script&gt;"'
    );
    test.end();
  });

  test.test('toString leaves alphanumerics, spaces and dashes unchanged', function(test) {
    // Sanity: only the five-character set is touched. Letters, digits,
    // whitespace, dashes, underscores, dots — all pass through.
    let attr = new DrupalAttribute();
    attr.setAttribute('data-foo_bar.baz-9', 'Hello World 123');

    test.equal(attr.toString(), ' data-foo_bar.baz-9="Hello World 123"');
    test.end();
  });

  test.test('toString escaping covers all five entities in a single value (byte-pinned)', function(test) {
    // Catch-all guard: if a future contributor adjusts the escape map and
    // breaks any one entity, this test reports the exact deviation.
    let attr = new DrupalAttribute();
    attr.setAttribute('data-all', `&"'<>`);

    test.equal(attr.toString(), ' data-all="&amp;&quot;&#039;&lt;&gt;"');
    test.end();
  });
});
