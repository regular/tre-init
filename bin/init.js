#!/usr/bin/env node
const fs = require('fs')
const crypto = require('crypto')
const {join, resolve} = require('path')
const createSbot = require('scuttlebot-release/node_modules/scuttlebot')
const {isMsg} = require('ssb-ref')
const merge = require('lodash.merge')
const traverse = require('traverse')
const multicb = require('multicb')
const argv = require('minimist')(process.argv.slice(2))
const debug = require('debug')('tre-init')

const Importer = require('tre-file-importer')
const fileFromPath = require('tre-file-importer/file')

const pull = require('pull-stream')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const mkdirp = require('mkdirp')

const path = join(process.cwd(), '.tre')
mkdirp.sync(path)
fs.symlinkSync(fs.realpathSync('node_modules'), path + '/node_modules')

const netKeys = ssbKeys.generate()
const caps = netKeys.public.split('.')[0]
const network = '*' + netKeys.public
const port = Math.floor(50000 + 15000 * Math.random())

const branches = [
  {type: 'folder', name: 'Users', key: 'about'},
  {type: 'folder', name: '.Machines', key: 'machines'},
  {type: 'folder', name: '.Prototypes', key: 'prototypes'},
  {type: 'folder', name: 'Assets', key: 'assets', children: [
    {type: 'folder', name: 'Images', key: 'images'},
    {type: 'folder', name: 'Stylesheets', key: 'stylesheets'},
    {type: 'folder', name: 'Fonts', key: 'fonts'},
  ]},
  {type: 'folder', name: '.Code', key: 'code', children: [
    {type: 'folder', name: 'WebApps', key: 'webapps'}
  ]},
  {type: 'folder', name: '.Trash', key: 'trash'},
]

copyKeys()
const keys = ssbKeys.loadOrCreateSync(join(path, 'secret'))
const browserKeys = ssbKeys.loadOrCreateSync(join(path, 'browser-keys'))

const ssb = createSbot
  .use(require('ssb-private'))
  .use(require('scuttlebot-release/node_modules/ssb-blobs')) ({
    keys, path, caps: {
      shs: caps
    }
  })
setTimeout( () => init(ssb, err => {
  if (err) {
    console.error(err)
    process.exit(1)
  } else {
    console.error('Done')
    setTimeout( ()=>process.exit(0), 300)
  }
}), 300)

function init(ssb, cb) {
  ssb.whoami( (err, feed) => {
    if (err) return cb(err)
    console.error('network', network)
    console.error('feed id (your public key)', feed.id)

    const done = multicb({pluck: 1, spread: true})
    sendNetkey(netKeys, done())
    buildTree(ssb, branches, done()) 
    
    done((err, private_msg, folders) => {
      if (err) return cb(err)
      publishPrototypes(ssb, folders, (err, prototypes) => {
        importFiles(ssb, prototypes, (err, messages) => {
          if (err) return cb(err)
          publishMessages(ssb, folders, messages, (err, branches) => {
            if (err) return cb(err)
            const config = {
              network,
              caps: {shs: caps},
              port,
              ws: {port: port + 1},
              master: [browserKeys.id],
              budo: {
                host: 'localhost',
                port: port + 2
              },
              tre: {branches, prototypes}
            }
            mergeFromPackageJson(config)
            writeConfig(config)
            cb(null)
          })
        })
      })
    })

    function sendNetkey(netKeys, cb) {
      const content = {
        type: 'network-key',
        description: 'This key can be used to proof that you created this network. Keep it safe',
        netKeys
      } 
      ssb.private.publish(content, [feed.id], cb)
    }

  })
}

// --

function publishPrototypes(ssb, folders, cb) {
  const {prototypes} = configFromPkg()
  if (!prototypes) {
    return cb(null, {})
  }
  console.error('Publishing prototypes ...')
  makePrototypes(ssb, Object.keys(prototypes).filter(k => prototypes[k]), folders, cb)
}

function importFiles(ssb, prototypes, cb) {
  const {importers, files} = configFromPkg()
  if (!importers || !files) return cb(null, {})
  
  const fileImporter = Importer(ssb, {tre: {prototypes}})
  Object.keys(importers).filter(k => importers[k]).forEach(modname => {
    const m = localRequire(modname)
    fileImporter.use(m)
  })
  
  pull(
    pull.keys(files),
    pull.asyncMap( (name, cb) => {
      const {content, path} = files[name]
      const paths = Array.isArray(path) ? path : [path]

      fileImporter.importFiles(paths.map(fileFromPath), (err, _content) => {
        if (err) return cb(err)
        cb(null, {
          name,
          content: merge(_content, content)
        })
      })
    }),
    pull.collect( (err, contents) => {
      if (err) return cb(err)
      cb(
        null,
        contents.reduce( (acc, {name, content}) => {
          acc[name] = content
          return acc
        }, {})
      )
    })
  )
}

function publishMessages(ssb, folders, fileMessages, cb) {

  function resolveVars(obj) {
    traverse(obj).forEach(function(x) {
      if (typeof x == 'string' && x[0] == '%' && !isMsg(x)) {
        const key = folders[x.substr(1)]
        if (key) {
          this.update(key) 
        } else {
          throw new Error('unknown named message: ' + x)
        }
      }
    })
  }

  const messages = Object.assign({}, fileMessages, configFromPkg().messages || {})
  if (!Object.keys(messages)) return cb(null, folders)
  pull(
    pull.keys(messages),
    pull.asyncMap( (name, cb) => {
      const content = messages[name]
      resolveVars(content)
      ssb.publish(content, (err, msg) => {
        if (err) return cb(err)
        folders[name] = msg.key
        console.error('Published', content.type, 'as', msg.key)
        cb(null, msg)
      })
    }),
    pull.collect( err => {
      if (err) return cb(err)
      cb(null, folders)
    })
  )
}

function makePrototypes(ssb, modules, folders, cb) {
  const {root, prototypes} = folders
  const result = {}
  pull(
    pull.values(modules),
    pull.asyncMap( (m, cb) =>{
      const f = localRequire(m).factory
      const content = f({}).prototype()
      if (!content) return cb(new Error(`${m} prototype() returned no content`))
      Object.assign(content, {root, branch: prototypes})
      ssb.publish(content, cb)
    }),
    pull.drain( kv =>{
      result[kv.value.content.type] = kv.key
      console.error(`Published ${kv.value.content.type} prototype as ${kv.key}`)
    }, err => {
      if (err) return cb(err)
      cb(null, result)
    })
  )
}

function configFromPkg() {
  let pkg
  try {
    pkg = JSON.parse(fs.readFileSync('package.json'))
  } catch(err) {
    console.error('Unable to read package.json:', err.message)
    return
  }
  return pkg['tre-init'] || {}
}

function mergeFromPackageJson(config) {
  const {plugins} = configFromPkg()
  if (!plugins) return
  merge(config, {plugins})
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

function copyKeys() {
  let keySrc = argv['copy-keys']
  if (keySrc) {
    if (keySrc == true) {
      keySrc = join(process.env.HOME, '.ssb', 'secret')
    }
    fs.copyFileSync(keySrc, join(path, 'secret'), fs.constants.COPYFILE_EXCL)
  }
}

function localRequire(modname) {
  return modname == '.' ? require(resolve('.')) : require(resolve(`node_modules/${modname}`))
}
