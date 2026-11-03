// Self-check for the pure runner harness. Run: node scripts/runner-selfcheck.ts
import assert from 'node:assert/strict';
import {
  compareOutput,
  compareStdout,
  deepEqual,
  detectJsSignature,
  orderArgs,
  parseInput,
  parseLiteral,
  splitTopLevel,
} from '../src/runner/harness.ts';

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`ok - ${name}`);
};

check('split named args', () => {
  assert.deepEqual(splitTopLevel('nums = [2,7,11,15], target = 9'), ['nums = [2,7,11,15]', 'target = 9']);
  assert.deepEqual(splitTopLevel('s = "a,b", k = 2'), ['s = "a,b"', 'k = 2']);
  assert.deepEqual(splitTopLevel('grid = [[1,0],\n [0,1]]\nk = 1'), ['grid = [[1,0],\n [0,1]]', 'k = 1']);
});

check('split one-value-per-line', () => {
  assert.deepEqual(splitTopLevel('[2,7,11,15]\n9\n'), ['[2,7,11,15]', '9']);
});

check('parse literals', () => {
  assert.deepEqual(parseLiteral('[1, 2, 3]'), [1, 2, 3]);
  assert.deepEqual(parseLiteral("['a', 'b']"), ['a', 'b']);
  assert.deepEqual(parseLiteral('[True, False, None]'), [true, false, null]);
  assert.deepEqual(parseLiteral('(1, 2)'), [1, 2]);
  assert.deepEqual(parseLiteral('[1,2,]'), [1, 2]);
  assert.deepEqual(parseLiteral(`"it's"`), "it's");
  assert.deepEqual(parseLiteral(`'say "hi"'`), 'say "hi"');
  assert.deepEqual(parseLiteral('hello world'), { __unparsed: 'hello world' });
});

check('parse input with names and values', () => {
  const args = parseInput('nums = [3,2,4], target = 6');
  assert.deepEqual(args.map((a) => [a.name, a.value]), [['nums', [3, 2, 4]], ['target', 6]]);
  const unnamed = parseInput('"abcabcbb"');
  assert.deepEqual(unnamed.map((a) => [a.name, a.value]), [[null, 'abcabcbb']]);
  // "==" is not an assignment
  assert.equal(parseInput('a == b')[0].name, null);
});

check('deep equal with float tolerance', () => {
  assert.ok(deepEqual([1.0000001, [2]], [1, [2]]));
  assert.ok(!deepEqual([1, 2], [2, 1]));
  assert.ok(deepEqual({ a: 1, b: [true] }, { b: [true], a: 1 }));
  assert.ok(!deepEqual(1, '1'));
});

check('compare output', () => {
  assert.equal(compareOutput([0, 1], '[0,1]'), 'pass');
  assert.equal(compareOutput([1, 0], '[0,1]'), 'fail');
  assert.equal(compareOutput(true, 'true'), 'pass');
  assert.equal(compareOutput(true, 'True'), 'pass');
  assert.equal(compareOutput(2.5, '2.50000'), 'pass');
  assert.equal(compareOutput('fl', '"fl"'), 'pass');
  assert.equal(compareOutput(42, ''), 'ran');
  assert.equal(compareOutput('3', '3'), 'pass');
});

check('compare stdout', () => {
  assert.equal(compareStdout('3\n', '3'), 'pass');
  assert.equal(compareStdout('1 2 \n3\n', '1 2\n3'), 'pass');
  assert.equal(compareStdout('[1, 2]', '[1,2]'), 'pass');
  assert.equal(compareStdout('4', '3'), 'fail');
  assert.equal(compareStdout('anything', '  '), 'ran');
});

check('detect JS signatures', () => {
  const a = detectJsSignature(`/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n  const helper = function(x) { return x; };\n};`);
  assert.ok(a && !('design' in a));
  assert.equal((a as { name: string }).name, 'twoSum');
  assert.deepEqual((a as { params: string[] }).params, ['nums', 'target']);
  assert.equal((a as { returnType: string }).returnType, 'number[]');
  const b = detectJsSignature('const maxDepth = (root) => { return 0 }');
  assert.equal((b as { name: string }).name, 'maxDepth');
  const c = detectJsSignature(`/**\n * @param {ListNode} head\n * @return {ListNode}\n */\nfunction reverseList(head) {}`);
  assert.equal((c as { paramTypes: Record<string, string> }).paramTypes.head, 'ListNode');
  const d = detectJsSignature('var MinStack = function() {};\nMinStack.prototype.push = function(val) {};');
  assert.deepEqual(d, { design: true });
  assert.equal(detectJsSignature('console.log(1)'), null);
});

check('order args', () => {
  const args = parseInput('target = 9, nums = [2,7]');
  assert.deepEqual(orderArgs(['nums', 'target'], args).values, [[2, 7], 9]);
  const mism = orderArgs(['a', 'b'], parseInput('x = 1, y = 2'));
  assert.deepEqual(mism.values, [1, 2]);
  assert.ok(mism.warning);
});

console.log(`\n${n} checks passed`);
