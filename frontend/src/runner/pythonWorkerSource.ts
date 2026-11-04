/**
 * Source for the Python Web Worker. Loaded as a Blob (classic worker) so it can
 * importScripts() Pyodide from the CDN without any bundler configuration.
 */
export const PYODIDE_VERSION = '0.29.5';
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const PY_HARNESS = String.raw`
import json, inspect, io, sys, time, traceback, contextlib

sys.setrecursionlimit(3000)

PRELUDE = '''
from typing import *
import collections, heapq, math, bisect, itertools, functools, string, re, random, operator
from collections import deque, defaultdict, Counter, OrderedDict
from heapq import heappush, heappop, heapify, heappushpop, nlargest, nsmallest
from functools import lru_cache, cache, reduce
from bisect import bisect_left, bisect_right, insort
from math import inf, gcd, sqrt, ceil, floor, log2
from itertools import accumulate, permutations, combinations, product, chain

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next
    def __repr__(self):
        return f"ListNode({self.val})"

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
    def __repr__(self):
        return f"TreeNode({self.val})"
'''

_STATE = {}

def _err(e, prefix=""):
    line = getattr(e, "lineno", None) if isinstance(e, SyntaxError) else None
    if line is None:
        for fr in traceback.extract_tb(e.__traceback__):
            if fr.filename == "solution.py":
                line = fr.lineno
    return {"ok": False, "error": f"{prefix}{type(e).__name__}: {e}", "line": line}

def __mp_prepare(src):
    ns = {"__name__": "__main__"}
    try:
        exec(PRELUDE, ns)
        exec(compile(src, "solution.py", "exec"), ns)
    except BaseException as e:
        return json.dumps(_err(e))
    _STATE.clear()
    _STATE["ns"] = ns
    cls = ns.get("Solution")
    if cls is not None and inspect.isclass(cls):
        methods = [n for n, v in cls.__dict__.items() if callable(v) and not n.startswith("_")]
        if not methods:
            return json.dumps({"ok": False, "error": "class Solution has no public method to call."})
        _STATE["cls"] = cls
        _STATE["methods"] = methods
        return json.dumps({"ok": True, "entry": methods})
    user_classes = [n for n, v in ns.items() if inspect.isclass(v) and getattr(v, "__module__", "") == "__main__" and n not in ("ListNode", "TreeNode")]
    funcs = [n for n, v in ns.items() if inspect.isfunction(v) and getattr(v.__code__, "co_filename", "") == "solution.py" and not n.startswith("_")]
    # A helper class (UnionFind, Trie…) next to a plain function is fine; only a lone class is a design problem.
    if user_classes and not funcs:
        return json.dumps({"ok": False, "design": True, "error": f"Design-style problems (class {user_classes[0]} with several methods called in sequence) aren't supported by the runner yet. Use a 'class Solution' with one method."})
    if not funcs:
        return json.dumps({"ok": False, "error": "No 'class Solution' or top-level function found to call."})
    _STATE["funcs"] = [ns[n] for n in funcs]
    return json.dumps({"ok": True, "entry": funcs})

def _entry_score(fn, names, nargs, is_method):
    """Rank candidate entry points: matching argument names first, then an argument count that
    fits the input, then LeetCode-style type annotations (helpers like dfs rarely have them)."""
    try:
        params = list(inspect.signature(fn).parameters.values())
    except (TypeError, ValueError):
        return (0, 0, 0)
    if is_method:
        params = params[1:]
    pnames = [p.name for p in params]
    named = sum(1 for n in names if n and n in pnames)
    required = sum(1 for p in params if p.default is inspect.Parameter.empty and p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD))
    fits = 1 if required <= nargs <= len(params) else 0
    annotated = 1 if any(p.annotation is not inspect.Parameter.empty for p in params) else 0
    return (named, fits, annotated)

def _ann(a):
    if a is inspect.Parameter.empty or a is inspect.Signature.empty:
        return ""
    return a if isinstance(a, str) else str(getattr(a, "__name__", "") or a) + " " + str(a)

def _build_list(vals, ns):
    LN = ns["ListNode"]
    head = cur = None
    for v in vals:
        node = LN(v)
        if head is None:
            head = cur = node
        else:
            cur.next = node
            cur = node
    return head

def _build_tree(vals, ns):
    TN = ns["TreeNode"]
    if not vals or vals[0] is None:
        return None
    root = TN(vals[0])
    q = collections_deque([root])
    i = 1
    while q and i < len(vals):
        node = q.popleft()
        if i < len(vals) and vals[i] is not None:
            node.left = TN(vals[i]); q.append(node.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            node.right = TN(vals[i]); q.append(node.right)
        i += 1
    return root

from collections import deque as collections_deque

def _convert_in(value, ann, ns):
    if not isinstance(value, list):
        return value
    nested = ann.count("List[") + ann.count("list[")
    if "ListNode" in ann:
        if nested >= 1 and value and all(isinstance(x, list) for x in value):
            return [_build_list(x, ns) for x in value]
        return _build_list(value, ns)
    if "TreeNode" in ann:
        return _build_tree(value, ns)
    return value

def _to_json(v, ns, depth=0):
    if depth > 50:
        return repr(v)
    LN, TN = ns.get("ListNode"), ns.get("TreeNode")
    if v is None or isinstance(v, (bool, int, str)):
        return v
    if isinstance(v, float):
        if v != v or v in (float("inf"), float("-inf")):
            return str(v)
        return v
    if LN is not None and isinstance(v, LN):
        out, seen = [], set()
        while v is not None and id(v) not in seen and len(out) < 100000:
            seen.add(id(v)); out.append(_to_json(v.val, ns, depth + 1)); v = v.next
        return out
    if TN is not None and isinstance(v, TN):
        out, q = [], collections_deque([v])
        while q and len(out) < 100000:
            n = q.popleft()
            if n is None:
                out.append(None); continue
            out.append(_to_json(n.val, ns, depth + 1)); q.append(n.left); q.append(n.right)
        while out and out[-1] is None:
            out.pop()
        return out
    if isinstance(v, (list, tuple)):
        return [_to_json(x, ns, depth + 1) for x in v]
    if isinstance(v, (set, frozenset)):
        items = [_to_json(x, ns, depth + 1) for x in v]
        try:
            return sorted(items)
        except TypeError:
            return items
    if isinstance(v, dict):
        return {str(k): _to_json(x, ns, depth + 1) for k, x in v.items()}
    return repr(v)

def __mp_call(args_json):
    ns = _STATE.get("ns")
    if ns is None:
        return json.dumps({"ok": False, "error": "Code was not prepared."})
    args = json.loads(args_json)
    names = [a.get("name") for a in args]
    if "cls" in _STATE:
        cls = _STATE["cls"]
        methods = _STATE["methods"]
        method = max(methods, key=lambda m: _entry_score(getattr(cls, m), names, len(args), True)) if len(methods) > 1 else methods[0]
        try:
            fn = getattr(cls(), method)
        except BaseException as e:
            return json.dumps(_err(e, "Creating Solution(): "))
    else:
        funcs = _STATE["funcs"]
        # Highest score wins; on a tie the LAST defined function (helpers usually come first).
        fn = max(reversed(funcs), key=lambda f: _entry_score(f, names, len(args), False)) if len(funcs) > 1 else funcs[0]
    try:
        sig = inspect.signature(fn)
        params = list(sig.parameters.values())
    except (TypeError, ValueError):
        sig, params = None, []
    pnames = [p.name for p in params]
    by_name = {p.name: p for p in params}
    warning = None
    use_kwargs = bool(args) and all(n and n in by_name for n in names)
    if not use_kwargs and any(names) and pnames:
        warning = f"Input names ({', '.join(n for n in names if n)}) don't match parameters ({', '.join(pnames)}); passing values in order."
    call_args, call_kwargs, first = [], {}, None
    for i, a in enumerate(args):
        p = by_name.get(a.get("name")) if use_kwargs else (params[i] if i < len(params) else None)
        val = _convert_in(a.get("value"), _ann(p.annotation) if p else "", ns)
        if i == 0 and not use_kwargs:
            first = val
        if use_kwargs:
            call_kwargs[a["name"]] = val
        else:
            call_args.append(val)
    if use_kwargs and pnames:
        first = call_kwargs.get(pnames[0])
    buf = io.StringIO()
    t0 = time.perf_counter()
    try:
        with contextlib.redirect_stdout(buf):
            res = fn(*call_args, **call_kwargs)
    except BaseException as e:
        out = _err(e)
        out["stdout"] = buf.getvalue()[-20000:]
        out["ms"] = round((time.perf_counter() - t0) * 1000, 2)
        return json.dumps(out)
    ms = round((time.perf_counter() - t0) * 1000, 2)
    ret_ann = _ann(sig.return_annotation) if sig else ""
    in_place = False
    if res is None and first is not None and (ret_ann.strip() in ("None", "None None", "NoneType") or "None" == ret_ann.split(" ")[0]):
        res, in_place = first, True
    if res is None and ("ListNode" in ret_ann or "TreeNode" in ret_ann):
        res = []  # LeetCode shows an empty list/tree as []
    return json.dumps({"ok": True, "value": _to_json(res, ns), "stdout": buf.getvalue()[-20000:], "ms": ms, "warning": warning, "in_place": in_place})
`;

export const PYTHON_WORKER_SOURCE = `
let pyodide = null;
let ready = null;
const HARNESS = ${JSON.stringify(PY_HARNESS)};
function load() {
  if (!ready) {
    ready = (async () => {
      importScripts(${JSON.stringify(PYODIDE_INDEX_URL + 'pyodide.js')});
      pyodide = await loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_INDEX_URL)} });
      pyodide.runPython(HARNESS);
    })();
  }
  return ready;
}
self.onmessage = async (e) => {
  const { id, type } = e.data;
  try {
    await load();
    if (type === 'init') {
      self.postMessage({ id, ok: true });
    } else if (type === 'prepare') {
      pyodide.globals.set('__mp_src', e.data.code);
      self.postMessage({ id, ...JSON.parse(pyodide.runPython('__mp_prepare(__mp_src)')) });
    } else if (type === 'call') {
      pyodide.globals.set('__mp_args', JSON.stringify(e.data.args));
      self.postMessage({ id, ...JSON.parse(pyodide.runPython('__mp_call(__mp_args)')) });
    }
  } catch (err) {
    ready = type === 'init' ? null : ready;
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
`;
