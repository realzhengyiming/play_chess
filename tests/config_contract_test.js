'use strict';

const fs=require('fs');
const path=require('path');
const contract=require('../assets/js/config-contract.js');
const root=path.resolve(__dirname,'..');
const clone=value=>JSON.parse(JSON.stringify(value));
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'server_config',`furniture-config-${name}.json`),'utf8'));
const expectError=(label,config,pattern)=>{
  const errors=contract.validateGlobalConfig(config);
  if(!errors.some(error=>pattern.test(error)))throw new Error(`${label}: 没有得到预期错误；实际 ${errors.join('；')||'无错误'}`);
};

for(const name of ['current','default'])contract.assertGlobalConfig(read(name));

const unsafePassage=clone(read('current'));
unsafePassage.layoutConstraints.circulation.levels.find(row=>row.id===unsafePassage.layoutConstraints.circulation.hardLevelId).radius=.2;
expectError('0.40m 硬通路',unsafePassage,/0\.50m/);

const brokenReference=clone(read('current'));
brokenReference.furnitureRules.find(row=>row.id==='coffee').candidate.rules[0].relativeTo='missingSofa';
expectError('家具关系悬空引用',brokenReference,/missingSofa.*未引用/);

const invalidQuantity=clone(read('current'));
invalidQuantity.furnitureRules.find(row=>row.id==='night').preferences.defaultCount=99;
expectError('默认数量越界',invalidQuantity,/defaultCount.*min\/max/);

const missingPolicy=clone(read('current'));
delete missingPolicy.layoutConstraints.qualityPass;
expectError('缺少全局质量门槛',missingPolicy,/qualityPass.*对象/);

const missingIntelligence=clone(read('current'));
delete missingIntelligence.layoutConstraints.layoutIntelligence;
expectError('缺少棋谱智能层',missingIntelligence,/layoutIntelligence/);

const invalidChallengeProfile=clone(read('current'));
invalidChallengeProfile.layoutConstraints.layoutIntelligence.functionalGroups.living.find(group=>group.id==='dining').inventoryChallenges[0].counts.arm=-1;
expectError('功能组棋谱变体数量越界',invalidChallengeProfile,/inventoryChallenges.*counts\.arm.*非负整数/);

console.log('PASS: current/default 配置有效；不安全通路、悬空引用、数量越界和缺失策略均被拒绝');
