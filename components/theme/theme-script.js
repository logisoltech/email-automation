import { NO_STREAKS_CLASS, THEME_FIELDS, THEME_STORAGE_KEY } from "@/lib/theme";

const VAR_MAP = JSON.stringify(
  Object.fromEntries(THEME_FIELDS.map((field) => [field.key, field.cssVar]))
);

/*
 * Runs before first paint so a custom palette never flashes the stock
 * Printstream colours. Kept dependency-free and wrapped in try/catch because it
 * executes before React (and before any error boundary) exists.
 */
const SCRIPT = `(function(){try{
var map=${VAR_MAP};
var raw=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(!raw)return;
var theme=JSON.parse(raw);
var root=document.documentElement;
for(var key in map){
  var value=theme[key];
  if(typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value)){root.style.setProperty(map[key],value);}
}
if(theme.streaks===false){root.classList.add(${JSON.stringify(NO_STREAKS_CLASS)});}
}catch(e){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
