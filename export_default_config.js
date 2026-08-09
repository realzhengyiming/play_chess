const fs = require('fs');
const path = require('path');
globalThis.RoomChessConfigContract=require('./assets/js/config-contract.js');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'furniture-rule-editor.html'), 'utf8');
const external = html.match(/<script[^>]+src=["']([^"']*furniture-rule-editor\.js)["'][^>]*><\/script>/i);
const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)][0];
const scriptSource = external
  ? fs.readFileSync(path.resolve(root, external[1]), 'utf8')
  : inline?.[1];
if (!scriptSource) throw new Error('没有找到家具配置中心脚本');
new Function(scriptSource)();

setTimeout(() => {
  const config = globalThis.FurnitureConfigBaseline;
  if (!config?.furnitureLibrary?.length || !config?.furnitureRules?.length) throw new Error('默认配置编译失败');
  globalThis.RoomChessConfigContract.assertGlobalConfig(config);
  const directory = path.join(root, 'server_config');
  fs.mkdirSync(directory, {recursive:true});
  const payload = `${JSON.stringify(config, null, 2)}\n`;
  fs.writeFileSync(path.join(directory, 'furniture-config-default.json'), payload, 'utf8');
  if (process.argv.includes('--activate')) fs.writeFileSync(path.join(directory, 'furniture-config-current.json'), payload, 'utf8');
  console.log(`已导出 FastAPI 基础默认配置 v${config.baselineVersion}：${config.furnitureLibrary.length} 个家具定义，${config.furnitureRules.length} 条房间规则`);
}, 0);
