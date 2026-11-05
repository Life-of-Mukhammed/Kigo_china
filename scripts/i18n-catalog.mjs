import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";

const root = process.cwd();
const localesDir = path.join(root, "locales");
const sourceFiles = ["components", "app", "lib"];
const supported = new Set(["uz", "kk", "tg", "ky", "az", "tr", "tk", "ar", "fa", "ur", "id", "ms", "bn", "ps", "ru", "en"]);
const ignoredDirectories = new Set(["ui", "node_modules", ".next", "dist", ".wrangler"]);

async function loadTypeScript() {
  try {
    return await import("typescript");
  } catch {
    throw new Error("TypeScript is required. Run npm install before extracting interface strings.");
  }
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : walk(full);
    return /\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith("i18n.ts") ? [full] : [];
  });
}

function textOf(node, ts) {
  if (!node) return "";
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isPropertyName(node) && ts.isIdentifier(node)) return node.text;
  return "";
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function addIfHuman(map, value) {
  const text = normalize(value);
  if (text.length < 2 || text.length > 500 || !/[\p{L}]/u.test(text)) return;
  if (text === "ta") return; // Uzbek count suffix; translate the complete count phrase instead.
  if (/^(https?:|mailto:|tel:|\/#|#[\w-]+$)/i.test(text)) return;
  map.set(text, text);
}

function readKnownTranslations(ts, language) {
  const file = path.join(root, "lib/i18n.ts");
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys = new Set();
  const hasTarget = new Set();
  const inspect = (object, extended = false) => {
    if (!object || !ts.isObjectLiteralExpression(object)) return;
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = textOf(property.name, ts);
      if (!key) continue;
      keys.add(key);
      const targetExists = extended
        ? language === "ru"
        : ts.isObjectLiteralExpression(property.initializer) && property.initializer.properties.some((item) => ts.isPropertyAssignment(item) && textOf(item.name, ts) === language);
      if (targetExists) hasTarget.add(key);
    }
  };
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (declaration.name.text === "translations") inspect(declaration.initializer);
      if (declaration.name.text === "extendedRussian") inspect(declaration.initializer, true);
    }
  }
  const curatedTarget = new Set(hasTarget);
  const generatedFile = path.join(root, "lib/i18n-generated.ts");
  if (fs.existsSync(generatedFile)) {
    const generatedSource = fs.readFileSync(generatedFile, "utf8");
    const generatedAst = ts.createSourceFile(generatedFile, generatedSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    for (const statement of generatedAst.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === "generatedTranslations") inspect(declaration.initializer);
      }
    }
  }
  return { keys, hasTarget, curatedTarget };
}

function collectCandidates(ts, language) {
  const candidates = new Map();
  const { keys, hasTarget } = readKnownTranslations(ts, language);
  for (const key of keys) if (!hasTarget.has(key)) addIfHuman(candidates, key);

  for (const file of sourceFiles.flatMap((directory) => walk(path.join(root, directory)))) {
    const content = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const userFacingErrors = file.includes(`${path.sep}app${path.sep}api${path.sep}`) || file.includes(`${path.sep}lib${path.sep}`);
    const visit = (node, contexts = new Set()) => {
      const contextNames = new Set(["fieldDefs", "statusName", "kindLabels"]);
      const entersContext = ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && contextNames.has(node.name.text);
      const activeContexts = entersContext ? new Set([...contexts, node.name.text]) : contexts;
      if (ts.isJsxText(node)) addIfHuman(candidates, node.text);
      if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
        if (["placeholder", "title", "aria-label", "alt"].includes(node.name.getText(ast))) addIfHuman(candidates, node.initializer.text);
      }
      if (ts.isCallExpression(node) && node.arguments.length && ts.isIdentifier(node.expression) && ["translate", "tr", "label"].includes(node.expression.text)) {
        const argument = node.arguments[0];
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) addIfHuman(candidates, argument.text);
      }
      if (ts.isCallExpression(node) && node.arguments.length && ts.isIdentifier(node.expression) && ["notify", "setError", "setNotice"].includes(node.expression.text)) {
        const argument = node.arguments[0];
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) addIfHuman(candidates, argument.text);
      }
      if (userFacingErrors && ts.isPropertyAssignment(node) && textOf(node.name, ts) === "error") {
        const message = textOf(node.initializer, ts);
        if (message) addIfHuman(candidates, message);
      }
      if (userFacingErrors && ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Error" && node.arguments?.length) {
        const message = textOf(node.arguments[0], ts);
        if (message) addIfHuman(candidates, message);
      }
      if (activeContexts.has("fieldDefs") && ts.isArrayLiteralExpression(node)) {
        const label = textOf(node.elements[1], ts);
        if (label) addIfHuman(candidates, label);
        const optionList = textOf(node.elements[3], ts);
        if (optionList) {
          for (const option of optionList.split(",")) {
            const separator = option.indexOf(":");
            if (separator >= 0) addIfHuman(candidates, option.slice(separator + 1));
          }
        }
      }
      if ((activeContexts.has("statusName") || activeContexts.has("kindLabels")) && ts.isPropertyAssignment(node)) {
        const value = textOf(node.initializer, ts);
        if (value) addIfHuman(candidates, value);
      }
      ts.forEachChild(node, (child) => visit(child, activeContexts));
    };
    visit(ast);
  }
  return [...candidates.keys()].filter((source) => !hasTarget.has(source)).sort((a, b) => a.localeCompare(b, "uz"));
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((item) => item.some((value) => value.length));
}

function idFor(source) {
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 12);
}

async function extract(language) {
  const ts = await loadTypeScript();
  const items = collectCandidates(ts, language);
  fs.mkdirSync(localesDir, { recursive: true });
  const csv = ["id,source,target", ...items.map((source) => `${idFor(source)},${csvCell(source)},`)].join("\n") + "\n";
  const output = path.join(localesDir, `${language}-to-translate.csv`);
  fs.writeFileSync(output, csv);
  console.log(`Wrote ${items.length} interface strings to ${path.relative(root, output)}.`);
  const separator = language === "ru" ? ";" : ",";
  console.log(`In Google Sheets, import the CSV and enter =GOOGLETRANSLATE(B2${separator}"uz"${separator}"${language}") in C2, then fill down and export as CSV.`);
}

async function merge(language, inputFile) {
  const ts = await loadTypeScript();
  const { hasTarget, curatedTarget } = readKnownTranslations(ts, language);
  const candidates = new Set(collectCandidates(ts, language));
  const rows = parseCsv(fs.readFileSync(path.resolve(root, inputFile), "utf8"));
  const header = rows.shift()?.map((item) => item.trim().toLowerCase());
  const sourceColumn = header?.indexOf("source") ?? -1;
  const targetColumn = header?.indexOf("target") ?? -1;
  if (sourceColumn < 0 || targetColumn < 0) throw new Error("CSV must contain source and target columns. Keep the original column headers when exporting from Sheets.");

  const generated = {};
  const missing = [];
  const unknown = [];
  for (const row of rows) {
    const source = normalize(row[sourceColumn] || "");
    const target = normalize(row[targetColumn] || "");
    if (!source) continue;
    if (language === "ru" && ["ta", "ta tanlandi", "ta turnir topildi", "yulduz"].includes(source)) continue;
    if (hasTarget.has(source)) continue;
    if (!candidates.has(source)) { unknown.push(source); continue; }
    if (!target || target.startsWith("=")) { missing.push(source); continue; }
    const sourceTokens = [...source.matchAll(/\{[^{}]+\}|\$\{[^{}]+\}/g)].map((match) => match[0]).sort();
    const targetTokens = [...target.matchAll(/\{[^{}]+\}|\$\{[^{}]+\}/g)].map((match) => match[0]).sort();
    if (sourceTokens.join("\0") !== targetTokens.join("\0")) {
      missing.push(`${source} (placeholder mismatch)`);
      continue;
    }
    generated[source] = { [language]: target };
  }
  if (missing.length || unknown.length) {
    console.error(`Not imported: ${missing.length} blank or unsafe rows, ${unknown.length} unexpected source rows.`);
    for (const value of [...missing.slice(0, 12), ...unknown.slice(0, 5)]) console.error(`- ${value}`);
    if (missing.length) throw new Error("Complete every target cell and preserve placeholders, then export the CSV again.");
  }
  const output = path.join(root, "lib/i18n-generated.ts");
  const existing = fs.readFileSync(output, "utf8");
  const existingJson = existing.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
  const current = existingJson ? JSON.parse(existingJson[1]) : {};
  for (const source of Object.keys(current)) if (curatedTarget.has(source)) delete current[source];
  if (language === "ru") {
    for (const source of ["ta", "ta tanlandi", "ta turnir topildi", "yulduz"]) {
      if (current[source]) delete current[source].ru;
      if (current[source] && !Object.keys(current[source]).length) delete current[source];
    }
  }
  for (const [source, values] of Object.entries(generated)) current[source] = { ...(current[source] || {}), ...values };
  fs.writeFileSync(output, `export const generatedTranslations: Record<string, Partial<Record<string, string>>> = ${JSON.stringify(current, null, 2)};\n`);
  console.log(`Merged ${Object.keys(generated).length} ${language} translations into lib/i18n-generated.ts.`);
  if (unknown.length) console.warn(`${unknown.length} rows were skipped because their source text was not in the current extraction.`);
}

const [command, language, inputFile] = process.argv.slice(2);
if (!supported.has(language)) throw new Error(`Choose a supported language code: ${[...supported].join(", ")}`);
if (command === "extract") await extract(language);
else if (command === "merge" && inputFile) await merge(language, inputFile);
else throw new Error("Usage: node scripts/i18n-catalog.mjs extract <language> | merge <language> <translated.csv>");
