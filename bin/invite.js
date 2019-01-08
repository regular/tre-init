#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')

const conf = require('rc')('tre')
const path = conf.config
if (!path) {
  console.error('.trerc not found')
  process.exit(1)
}

let remotes
try {
  remotes = JSON.parse(
    fs.readFileSync(join(path, '../.tre/remotes'), 'utf8')
  )
} catch(err) {
  console.error('Unable to read .tre/remotes:', err.message)
  process.exit(1)
}

let remote
if (Object.values(remotes).length == 1) remote = Object.values(remotes)[0]
if (!remote) {
  console.error('specify a remote. Available remotes: ' + Object.keys(remotes))
}
console.error('remote:', remote)
const keys = ssbKeys.loadSync(join(path, '../.tre/secret'))
getInviteCode(conf, keys, remote, (err, code) => {
  if (err) {
    console.error('Unable to connect to remote sbot:', err.message)
    process.exit(1)
  }
  console.error('got invite code', code)
  console.log(JSON.stringify({
    caps: conf.caps,
    autofollow: keys.id,
    autoinvite: code,
    autoname: 'Karin Mustermann'
  }, null, 2))
})

function getInviteCode(conf, keys, remote, cb) {
  console.error('using identity:', keys.id)
  console.error('using appKey:', conf.appKey)
  ssbClient(keys, {
    caps: conf.caps,
    appKey: conf.appKey,
    remote,
    manifest: {invite: {create: 'async'}}
  }, (err, ssb) => {
    if (err) return cb(err)
    ssb.invite.create(1, (err, code) => {
      ssb.close()
      cb(err, code)
    })
  })
}
