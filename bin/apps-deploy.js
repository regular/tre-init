#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const pull = require('pull-stream')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const {exec} = require('child_process')

exec('git status --porcelain', (err, status) => {
  if (err) {
    console.error('git status failed', err.message)
    process.exit(1)
  }
  if (status.replace(/\n/g,''.length)) {
    console.error('\nWorking directory is not clean\n')
    console.error(status)
    console.error('\nPlease commit and try again.\n')
    process.exit(1)
  }
})


const conf = require('rc')('tre')
const path = conf.config
if (!path) {
  console.error('.trerc not found')
  process.exit(1)
}
const keys = ssbKeys.loadSync(join(path, '../.tre/secret'))



function gitInfo(cb) {
  exec('git describe --dirty', (err, ref) => {
    if (err) return cb(err)
    console.log(ref)
    cb(null, {
      ref
    })
  })
}

gitInfo( (err, info) => {
  if (err) {
    console.error('Unable to get git info:', err.message)
    process.exit(1)
  }
  console.log(info)
})

/*
showList(conf, keys, err  => {
  if (err) {
    console.error('Unable to list apps:', err.message)
    process.exit(1)
  }
})
*/

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
