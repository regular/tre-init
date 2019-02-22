#!/usr/bin/env node
const fs = require('fs')
const ssbKeys = require('ssb-keys')
// jshint -W079
const localStorage = require('chrome-localstorage')

let configPath = '.trerc'
if (process.argv.length > 2) {
  configPath = process.argv[2]
}
console.error(`Config path is: ${configPath}`)
const keys = ssbKeys.generate()
console.error('Pub key is', keys.id)
const config = JSON.parse(fs.readFileSync(configPath))
const port = config.ws.port
const host = config.host || 'localhost'
const domain = `${host}:${port}`

localStorage.write(domain, 'tre-keypair', keys, {}, err => {
  if (err) {
    console.error(err.message)
    process.exit(1)
  }
  console.error(`Written private key to localStorage at ${localStorage.getOpts({}).dbpath} for domain ${domain}`)
  config.master = config.master || []
  config.master.push(keys.id)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
})
