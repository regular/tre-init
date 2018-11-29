#!/usr/bin/env node
const fs = require('fs')
const crypto = require('crypto')
const {join, resolve} = require('path')
const createSbot = require('scuttlebot-release/node_modules/scuttlebot')
const merge = require('lodash.merge')

const pull = require('pull-stream')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const mkdirp = require('mkdirp')

const path = join(process.cwd(), '.tre')
mkdirp.sync(path)
fs.symlinkSync(fs.realpathSync('node_modules'), path + '/node_modules')

const caps = crypto.randomBytes(32).toString('base64')
const port = Math.floor(50000 + 15000 * Math.random())

const branches = [
  {type: 'folder', name: 'Users', key: 'about'},
  {type: 'folder', name: '.Machines', key: 'machines'},
  {type: 'folder', name: '.Prototypes', key: 'prototypes'},
  {type: 'folder', name: 'Assets', children: [
    {type: 'folder', name: 'Icons'},
    {type: 'folder', name: 'Stylesheets'},
    {type: 'folder', name: 'Fonts'},
  ]},
  {type: 'folder', name: '.Code', children: [
    {type: 'folder', name: 'WebApps', key: 'webapps'}
  ]},
  {type: 'folder', name: '.Trash', key: 'trash'},
]

const keys = ssbKeys.loadOrCreateSync(join(path, 'secret'))
const browserKeys = ssbKeys.loadOrCreateSync(join(path, 'browser-keys'))

const ssb = createSbot({
  keys, path, caps: {
    shs: caps
  }
})

ssb.whoami( (err, feed) => {
  if (err) return console.error(err)
  console.error('pub key', feed.id)
  console.error('app key', caps)

  buildTree(ssb, branches, (err, folders) => {
    if (err) console.error(err)
    const config = {
      caps: {shs: caps},
      appKey: caps,
      port,
      ws: {port: port + 1},
      master: [browserKeys.id],
      budo: {
        host: 'localhost',
        port: port + 2
      },
      tre: {branches: folders},
      autofollow: keys.public,
      autoname: folders.machines
    }
    mergeFromPackageJson(config)
    if (config.prototypes) makePrototypes(Object.keys(config.prototypes).filter(k => config.prototypes[k]), config, err => {
      if (err) throw err
      writeConfig(config)
      setTimeout( ()=> process.exit(0), 200)
    })
  })
})

function makePrototypes(modules, config, cb) {
  const {root, prototypes} = config.tre.branches
  pull(
    pull.values(modules),
    pull.asyncMap( (m, cb) =>{
      const f = require(resolve(`node_modules/${m}`)).factory
      const content = f(config).prototype()
      if (!content) return cb(new Error(`${m} prototype() returned no content`))
      Object.assign(content, {root, branch: prototypes})
      ssb.publish(content, cb)
    }),
    pull.drain( kv =>{
      config.tre.prototypes = config.tre.prototypes || {}
      config.tre.prototypes[kv.value.content.type] = kv.key
      console.error(`Published ${kv.value.content.type} prototype as ${kv.key}`)
    }, cb)
  )
}

function mergeFromPackageJson(config) {
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync('package.json'))
  } catch(err) {
    console.error('Unable to read package.json:', err.message)
    return
  }
  const c = pkg['tre-init']
  if (!c) return
  merge(config, c)
}

function writeConfig(config) {
  const file = '.trerc'
  if (fs.existsSync(file)) {
    return console.error(`${file} already exists, won't overwrite.`)
  }
  fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8')
}

function buildTree(ssb, branches, cb) {
  ssb.publish({type: 'root'}, (err, kv) => {
    if (err) return cb(err)
    const root = kv.key
    const folders = {root}
    console.error('root', root) 
    addBranches(branches, root, 0, err => {
      if (err) return cb(err)
      cb(null, folders)
    })

    function addBranches(children, branch, level, cb) {
      pull(
        pull.values(children || []),
        pull.map( o => ({
          key: o.key,
          children: o.children,
          data: Object.assign({root, branch}, o, {children: undefined, key: undefined})
        })),
        pull.asyncMap( ({children, key, data}, cb) => {
          ssb.publish(data, (err, msg) => {
            if (err) return cb(err)
            console.error(Buffer.alloc(level).fill(' ').toString(), msg.value.content.name, msg.key)
            if (key) folders[key] =  msg.key
            cb(null, {msg, children})
          })
        }),
        pull.asyncMap( ({msg, children}, cb) => addBranches(children, msg.key, level + 1, cb) ),
        pull.onEnd(cb)
      )
    }

  })
}
