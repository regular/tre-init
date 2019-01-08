#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')

const conf = require('rc')('tre')
const path = conf.config
if (!path) {
  console.error('.trerc not found')
  process.exit(1)
}

const keys = ssbKeys.loadSync(join(path, '../.tre/secret'))

const pub_conf = {
  caps: conf.caps,
  port: conf.port,
  ws: conf.ws,
  master: [keys.id],
  gossip: {
    connections: 4
  },
  blobs: {
    legacy: false,
    sympathy: 10,
    max: 3221225472
  },
  timers: {
    handshake: 30000,
    keepalive: 240000
  }
}

console.log(JSON.stringify(pub_conf, null, 2))
