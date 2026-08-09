const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'module-growth-prototype.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const noop = () => {};
const context2d = new Proxy({}, { get: (target, key) => target[key] || noop, set: (target, key, value) => (target[key] = value, true) });
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: id.includes('width') ? 3.6 : id.includes('depth') ? 4.2 : '',
      checked: !['showGrid'].includes(id),
      textContent: '',
      innerHTML: '',
      parentElement: {},
      classList: { add: noop, remove: noop, toggle: noop },
      addEventListener: noop,
      getBoundingClientRect: () => ({ width: 900, height: 650 }),
      getContext: () => context2d,
    });
  }
  return elements.get(id);
}

const sandbox = {
  console,
  performance,
  devicePixelRatio: 1,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  ResizeObserver: class { observe() {} },
  document: { getElementById: element, querySelectorAll: () => [] },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'module-growth-prototype.html' });

const cases = [
  ['compact', 2.9, 3.4],
  ['standard', 3.6, 4.2],
  ['large', 5.4, 5.2],
  ['wide', 6.5, 4.0],
  ['deep', 3.1, 6.6],
];
const results = cases.map(([name, width, depth]) => ({ name, ...sandbox.__moduleGrowthLab.setRoom(width, depth) }));

for (const result of results) {
  if (!Number.isFinite(result.metrics.time)) throw new Error(`${result.name}: invalid timing`);
  if (result.metrics.furniture < 2) throw new Error(`${result.name}: no usable furniture plan`);
  if (result.metrics.modules < 1) throw new Error(`${result.name}: no module selected`);
  if (Math.abs(result.area - result.width * result.depth) > 0.01) throw new Error(`${result.name}: wrong room area`);
}
if (results[2].metrics.furniture < results[0].metrics.furniture) throw new Error('large room should not contain fewer furniture pieces than compact room');

const balanced = sandbox.__moduleGrowthLab.setRoom(4.4, 4.8);
const rich = sandbox.__moduleGrowthLab.setDensity('rich');
const restrained = sandbox.__moduleGrowthLab.setDensity('compact');
if (rich.metrics.furniture < restrained.metrics.furniture) throw new Error('rich density should not contain fewer furniture pieces than restrained density');
const hugeRich = sandbox.__moduleGrowthLab.setDensity('rich') && sandbox.__moduleGrowthLab.setRoom(7, 7);
if (hugeRich.metrics.modules < 7 || hugeRich.metrics.furniture < 18) throw new Error('7×7 rich room should grow additional modules and furniture');
sandbox.__moduleGrowthLab.setDensity('balanced');
const growth = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7].map(size => sandbox.__moduleGrowthLab.setRoom(size, size));
console.table(growth.map((r,i)=>({size:3+i*.5,target:r.targetModules,modules:r.metrics.modules,furniture:r.metrics.furniture,types:r.modules.map(m=>m.type).join(',')})));
for (let i = 1; i < growth.length; i++) {
  if (growth[i].metrics.modules < growth[i - 1].metrics.modules) throw new Error(`module count regressed at ${3 + i * .5}m square`);
  if (growth[i].metrics.furniture < growth[i - 1].metrics.furniture) throw new Error(`furniture count regressed at ${3 + i * .5}m square`);
}

console.table(results.map(r => ({
  case: r.name,
  room: `${r.width.toFixed(1)}×${r.depth.toFixed(1)}`,
  modules: r.metrics.modules,
  furniture: r.metrics.furniture,
  fill: `${r.metrics.fill.toFixed(0)}%`,
  gap: `${r.metrics.gap.toFixed(1)}㎡`,
  types: r.modules.map(m => `${m.type}:${m.size}`).join(', '),
})));
console.log('7×7 rich:', hugeRich.metrics.modules, 'modules,', hugeRich.metrics.furniture, 'furniture,', hugeRich.modules.map(m=>m.label).join(' / '));
console.log('MODULE_GROWTH_PROTOTYPE_OK');
