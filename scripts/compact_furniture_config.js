'use strict';

const fs=require('fs');
const path=require('path');
const contract=require('../assets/js/config-contract.js');
const root=path.resolve(__dirname,'..');
const files=process.argv.slice(2).length?process.argv.slice(2):['default','current'].map(name=>path.join(root,'server_config',`furniture-config-${name}.json`));
const migrationFlags=['richBedroomDefaultsV1','richBedroomDefaultsV2','wallCabinetFirstV1','bedroomCorePriorityV1','livingCorePriorityV1','livingGroupDependencyV2','bedroomGroupDependencyV3','bedroomMediaPriorityV4','livingDiningPriorityV3'];

for(const input of files){
  const file=path.resolve(input),config=JSON.parse(fs.readFileSync(file,'utf8')),before=fs.statSync(file).size;
  config.schemaVersion=9;
  migrationFlags.forEach(key=>delete config[key]);
  delete config.furnitureRules;
  for(const rule of config.furnitureLibrary||[]){
    delete rule.schemaVersion;
    const rules=Array.isArray(rule.candidate?.rules)?rule.candidate.rules:[];
    rule.candidate={rules,maxCandidates:rule.candidate?.maxCandidates??32};
    for(const entry of rules){delete entry.excludeForLShape;delete entry.avoidChaiseSide;delete entry.lShapeCrossAlign;}
  }
  contract.assertGlobalConfig(config);
  fs.writeFileSync(file,`${JSON.stringify(config,null,2)}\n`,'utf8');
  const after=fs.statSync(file).size;
  console.log(`${path.basename(file)}: ${before} -> ${after} bytes (-${Math.round((1-after/before)*100)}%)`);
}
