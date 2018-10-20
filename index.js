const fs = require('fs')
const ssbClient = require('ssb-client')
const ssbKeys = require('ssb-keys')

const opts = JSON.parse(fs.readFileSync('./.trerc'))
opts.manifest = JSON.parse(fs.readFileSync(__dirname + '/.tre/manifest.json'))
//opts.appKey = opts.caps.shs

const keys = ssbKeys.loadOrCreateSync('tre-keys')
const pubkey = keys.id.slice(1).replace(`.${keys.curve}`, '')
const port = opts.connections.incoming.ws[0].port
//opts.remote = `ws://[::1]:${port}:~noauth:${pubkey}`
opts.remote = `ws://localhost:${port}~noauth`
console.log(opts)

ssbClient(keys, opts, (err, ssb) => {
  if (err) return console.error(err)
  ssb.whoami( (err, feed) => {
    if (err) return console.error(err)
    console.log('pub key', feed.id) 
  }) 
})
