const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'furniture-rule-editor.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) throw new Error('没有找到家具配置中心脚本');
new Function(scripts[0][1])();

setTimeout(() => {
  const config = globalThis.FurnitureConfigBaseline;
  if (!config?.furnitureLibrary?.length || !config?.furnitureRules?.length) throw new Error('默认配置编译失败');
  const directory = path.join(root, 'server_config');
  fs.mkdirSync(directory, {recursive:true});
  const payload = `${JSON.stringify(config, null, 2)}\n`;
  fs.writeFileSync(path.join(directory, 'furniture-config-default.json'), payload, 'utf8');
  if (process.argv.includes('--activate')) fs.writeFileSync(path.join(directory, 'furniture-config-current.json'), payload, 'utf8');
  console.log(`已导出 FastAPI 基础默认配置 v${config.baselineVersion}：${config.furnitureLibrary.length} 个家具定义，${config.furnitureRules.length} 条房间规则`);
}, 0);
