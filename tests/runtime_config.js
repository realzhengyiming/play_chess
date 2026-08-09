'use strict';

const fs=require('fs');
const path=require('path');
const contract=require('../assets/js/config-contract.js');

function runtimeConfigPath(root){
  return process.env.ROOM_CHESS_CONFIG
    ?path.resolve(process.env.ROOM_CHESS_CONFIG)
    :path.join(root,'server_config','furniture-config-current.json');
}

function loadRuntimeConfig(root){
  const configPath=runtimeConfigPath(root);
  const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
  contract.assertGlobalConfig(config);
  return {config,configPath};
}

module.exports={loadRuntimeConfig,runtimeConfigPath};
