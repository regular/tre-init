const fs = require('fs')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')

const opts = JSON.parse(fs.readFileSync('./.trerc'))
opts.manifest = JSON.parse(fs.readFileSync(__dirname + '/.tre/manifest.json'))
opts.remote = `ws:localhost:${opts.port + 1}~shs:${opts.caps.shs}`
opts.appKey = opts.caps.shs
console.log(opts)

ssbClient(null, opts, (err, ssb) => {
  if (err) return console.error(err)
  ssb.whoami( (err, feed) => {
    if (err) return console.error(err)
    console.log('pub key', feed.id) 
  }) 
})
