#!/usr/bin/env node
const fs = require('fs')
const pull = require('pull-stream')
const bl = require('bl')
const {stdin} = require('pull-stdio')

let configPath = '.trerc'
if (process.argv.length > 2) {
  configPath = process.argv[2]
}
console.error(`Config path is: ${configPath}`)

pull( stdin(), pull.collect( (err, buffers) => {
  const key = bl(buffers).toString().replace(/\s/g, '')
  console.error('Pub key is', key)
  const config = JSON.parse(fs.readFileSync(configPath))
  config.master = config.master || []
  config.master.push(key)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}))
