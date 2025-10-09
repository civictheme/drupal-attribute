import tape from "tape";
import defaultExport, {DrupalAttribute} from "../main/index.mjs";

import "./tests/add-class.mjs";
import "./tests/constructor.mjs";
import "./tests/has-class.mjs";
import "./tests/merge.mjs";
import "./tests/remove-attribute.mjs";
import "./tests/remove-class.mjs";
import "./tests/set-attribute.mjs";
import "./tests/to-string.mjs";

tape('The library exports DrupalAttribute as default export', ({same, end}) => {
  same(defaultExport, DrupalAttribute);
  
  end();
});