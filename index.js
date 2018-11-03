const fs = require('fs')
const ssbClient = require('ssb-client')
const ssbKeys = require('ssb-keys')
const opts = JSON.parse(fs.readFileSync('./.trerc'))
opts.manifest = JSON.parse(fs.readFileSync(__dirname + '/.tre/manifest.json'))

const keys = ssbKeys.loadOrCreateSync('tre-keypair')
console.log('keys', keys)
const pubkey = keys.id.slice(1).replace(`.${keys.curve}`, '')

console.log('browser key is maser key', keys.id == opts.master[0])
const port = opts.ws.port
const host = opts.budo.host
opts.appKey = opts.caps.shs
//opts.remote = `ws://${host}:${port}~shs:${pubkey}`
opts.remote = JSON.parse(localStorage['tre-remote'])
console.log(opts)

ssbClient(keys, opts, (err, ssb) => {
  if (err) return console.error(err)
  ssb.manifest( (err, manifest) => {
    if (err) return console.error(err)
    console.log('manifest', manifest)
    ssb.whoami( (err, feed) => {
      if (err) return console.error(err)
      console.log('pub key', feed.id) 
    }) 
  }) 
})
