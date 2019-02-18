#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const argv = require('minimist')(process.argv.slice(2))
const {stdin} = require('pull-stdio')
const {parse} = require('tre-invite-code')
const pull = require('pull-stream')
const bl = require('bl')
const merge = require('lodash.merge')

const {profile} = argv
if (!profile) {
  console.error(`
  Reads invite code from stdin and outputs sbot config
  USAGE: tre-config-from-invite --profle=NAME
  `)
  process.exit(1)
}

let base
try {
  base = JSON.parse(fs.readFileSync(resolve(join(__dirname, '..', 'profiles'), profile)))
} catch(err) {
  console.error('Unable to read file:', err.message)
  process.exit(-1)
}


pull(
  stdin(),
  pull.collect( (err, buffers)=>{
    const invite = bl(buffers).toString().replace(/\s*/g,'')
    const parsed = parse(invite)
    const {autofollow, boot, network, autoinvite, autoname} = parsed

    let port = Math.floor(50000 + 15000 * Math.random())
    if (autoinvite) {
      const n = autoinvite.split(':')[1]
      if (/[0-9]+/.test(n)) {
        port = Number(n)
      }
    }
    const config = merge({}, base, {
      caps: {
        shs: network.slice(1).replace(/\.[^.]+$/, '')
      },
      port,
      ws: {
        port: port + 1
      },
      autofollow,
      autoinvite,
      autoname,
      boot
    })
    console.log(JSON.stringify(config, null, 2))
  })
)
