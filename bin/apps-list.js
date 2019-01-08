#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const pull = require('pull-stream')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')

const conf = require('rc')('tre')
const path = conf.config
if (!path) {
  console.error('.trerc not found')
  process.exit(1)
}
const keys = ssbKeys.loadSync(join(path, '../.tre/secret'))

showList(conf, keys, err  => {
  if (err) {
    console.error('Unable to list apps:', err.message)
    process.exit(1)
  }
})

function showList(conf, keys, cb) {
  ssbClient(keys, Object.assign({},
    conf,
    {
      manifest: {
        revisions: {
          messagesByType: 'source'
        }
      }
    }
  ), (err, ssb) => {
    if (err) return cb(err)
    pull(
      ssb.revisions.messagesByType('webapp'),
      pull.drain( e =>{
        const revRoot = e.key.slice(-1)[0]
        const content = e.value.value.content
        console.log(revRoot.substr(0,5), content.name)
      }, err => {
        ssb.close()
        cb(err)
      })
    )
  })
}
