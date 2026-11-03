/** Source for the JavaScript Web Worker (created from a Blob; no bundler config needed). */
export const JS_WORKER_SOURCE = `
const PRELUDE_LIST = 'function ListNode(val, next) { this.val = (val === undefined ? 0 : val); this.next = (next === undefined ? null : next); }';
const PRELUDE_TREE = 'function TreeNode(val, left, right) { this.val = (val === undefined ? 0 : val); this.left = (left === undefined ? null : left); this.right = (right === undefined ? null : right); }';
let fn = null;
let sig = null;
let ctors = {};
let preludeLines = 0;

function fmt(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
function buildList(vals) {
  let head = null, cur = null;
  for (const v of vals) { const n = new ctors.ListNode(v); if (!head) { head = cur = n; } else { cur.next = n; cur = n; } }
  return head;
}
function buildTree(vals) {
  if (!vals.length || vals[0] === null) return null;
  const root = new ctors.TreeNode(vals[0]); const q = [root]; let i = 1;
  while (q.length && i < vals.length) {
    const n = q.shift();
    if (i < vals.length && vals[i] !== null) { n.left = new ctors.TreeNode(vals[i]); q.push(n.left); } i++;
    if (i < vals.length && vals[i] !== null) { n.right = new ctors.TreeNode(vals[i]); q.push(n.right); } i++;
  }
  return root;
}
function convertIn(v, type) {
  if (!Array.isArray(v) || !type) return v;
  if (/ListNode/.test(type)) {
    if (/\\[\\]|Array</.test(type) && v.every((x) => Array.isArray(x))) return v.map(buildList);
    return buildList(v);
  }
  if (/TreeNode/.test(type)) return buildTree(v);
  return v;
}
function isNode(v, name) { return v && typeof v === 'object' && ctors[name] && v instanceof ctors[name]; }
function toJson(v, depth) {
  depth = depth || 0;
  if (depth > 50) return String(v);
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean' || typeof v === 'string') return v;
  if (isNode(v, 'ListNode') || (v && typeof v === 'object' && 'val' in v && 'next' in v)) {
    const out = []; const seen = new Set();
    while (v && !seen.has(v) && out.length < 100000) { seen.add(v); out.push(toJson(v.val, depth + 1)); v = v.next; }
    return out;
  }
  if (isNode(v, 'TreeNode') || (v && typeof v === 'object' && 'val' in v && 'left' in v && 'right' in v)) {
    const out = []; const q = [v];
    while (q.length && out.length < 100000) { const n = q.shift(); if (!n) { out.push(null); continue; } out.push(toJson(n.val, depth + 1)); q.push(n.left); q.push(n.right); }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  }
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return Array.from(v, (x) => toJson(x, depth + 1));
  if (v instanceof Set) return Array.from(v, (x) => toJson(x, depth + 1));
  if (v instanceof Map) { const o = {}; v.forEach((x, k) => { o[String(k)] = toJson(x, depth + 1); }); return o; }
  if (typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = toJson(v[k], depth + 1); return o; }
  return String(v);
}
function errLine(err) {
  const m = /<anonymous>:(\\d+):(\\d+)/.exec((err && err.stack) || '');
  if (!m) return null;
  const line = Number(m[1]) - 2 - preludeLines;
  return line > 0 ? line : null;
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  if (type === 'prepare') {
    try {
      sig = e.data.sig;
      const code = e.data.code;
      const prelude = [];
      if (!/(function|class)\\s+ListNode\\b|ListNode\\s*=/.test(code)) prelude.push(PRELUDE_LIST);
      if (!/(function|class)\\s+TreeNode\\b|TreeNode\\s*=/.test(code)) prelude.push(PRELUDE_TREE);
      preludeLines = prelude.length;
      const body = prelude.join('\\n') + (prelude.length ? '\\n' : '') + code +
        '\\n;return { fn: ' + sig.name + ', ListNode: typeof ListNode === "undefined" ? null : ListNode, TreeNode: typeof TreeNode === "undefined" ? null : TreeNode };';
      const out = new Function(body)();
      fn = out.fn; ctors = { ListNode: out.ListNode, TreeNode: out.TreeNode };
      if (typeof fn !== 'function') throw new Error(sig.name + ' is not a function');
      self.postMessage({ id, ok: true });
    } catch (err) {
      self.postMessage({ id, ok: false, error: (err && err.name ? err.name + ': ' : '') + ((err && err.message) || String(err)), line: errLine(err) });
    }
    return;
  }
  if (type === 'call') {
    const logs = [];
    const capture = (...a) => { if (logs.length < 2000) logs.push(a.map(fmt).join(' ')); };
    console.log = capture; console.info = capture; console.warn = capture; console.error = capture; console.debug = capture;
    const args = e.data.values.map((v, i) => convertIn(v, sig.paramTypes[sig.params[i]] || ''));
    const t0 = performance.now();
    try {
      let res = fn.apply(null, args);
      if (res && typeof res.then === 'function') res = await res;
      const ms = Math.round((performance.now() - t0) * 100) / 100;
      let inPlace = false;
      if (res === undefined && args.length && (!sig.returnType || /void|undefined/.test(sig.returnType))) { res = args[0]; inPlace = true; }
      if ((res === null || res === undefined) && /ListNode|TreeNode/.test(sig.returnType || '')) res = [];
      self.postMessage({ id, ok: true, value: toJson(res), stdout: logs.join('\\n').slice(-20000), ms, in_place: inPlace });
    } catch (err) {
      const ms = Math.round((performance.now() - t0) * 100) / 100;
      self.postMessage({ id, ok: false, error: (err && err.name ? err.name + ': ' : '') + ((err && err.message) || String(err)), line: errLine(err), stdout: logs.join('\\n').slice(-20000), ms });
    }
  }
};
`;
