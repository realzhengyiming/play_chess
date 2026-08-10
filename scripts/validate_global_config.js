#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const contract=require('../assets/js/config-contract.js');

const source=process.argv[2];
const raw=source?fs.readFileSync(path.resolve(source),'utf8'):fs.readFileSync(0,'utf8');
const config=JSON.parse(raw);
const errors=contract.validateGlobalConfig(config);
if(errors.length){
  process.stderr.write(errors.join('\n'));
  process.exitCode=2;
}else{
  process.stdout.write(JSON.stringify({ok:true,schemaVersion:config.schemaVersion,furnitureRules:contract.compileFurnitureRules(config).length}));
}
