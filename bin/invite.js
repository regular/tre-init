#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const {isMsg} = require('ssb-ref')
const argv = require('minimist')(process.argv.slice(2))
const showList = require('./apps-list')

if (!argv.name) {
  console.error("Please specify a name (Example: --name 'Regular Gonzales')")
  process.exit(1)
}
const autoname = argv.name

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

let webapp = argv.webapp

showList(conf, keys, (err, apps) => {
  if (err) {
    console.error('Unable to list webapps:', err.message)
    process.exit(1)
  }
  if (!apps.length) {
    console.error('No wenapps found in network')
  }
  if (apps.length == 1 && !webapp) {
    webapp = apps[0].key
  }else if (apps.length > 1 && !webapp) {
    console.error('Please specify a webapp (Example: --webapp \'%lvxL\')')
    process.exit(1)
  }
  if (webapp && !isMsg(webapp)) {
    const kv = apps.find(kv => {
      const revRoot = kv.value.content.revisionRoot || kv.key
      return revRoot.startsWith(webapp)
    })
    if (!kv) {
      console.error('No webapp found that starts with', webapp)
      process.exit(1)
    }
    webapp = kv.key
  }
  const boot = webapp
  console.error('boot message is', webapp)
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
      autoname,
      boot
    }, null, 2))
  })
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
