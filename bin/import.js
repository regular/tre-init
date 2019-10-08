#!/usr/bin/env node
const fs = require('fs')
const {join, resolve, dirname} = require('path')
const {isMsg} = require('ssb-ref')
const causalOrder = require('../lib/causal-order')
const merge = require('lodash.merge')
const traverse = require('traverse')
const debug = require('debug')('tre-import')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const pull = require('pull-stream')
const Importer = require('tre-file-importer')
const fileFromPath = require('tre-file-importer/file')

if (!module.parent) {
  const argv = require('minimist')(process.argv.slice(2))
  debug('parsed command line arguments: %O', argv)
  const conf = require('rc')('tre')
  const path = conf.config
  debug('read .trerc from %s: %O', path, conf)
  if (!path) {
    console.error('.trerc not found')
    process.exit(1)
  }
  const keys = ssbKeys.loadSync(join(path, '../.tre/secret'))

  if (argv._.length<1) {
    console.error('USAGE: tre-import <json-file> [--dryRun] [--publish-prototype TYPE]')
    process.exit(1)
  }

  const sourceFile = resolve(argv._[0])
  console.error('source:', sourceFile)
  const sourcePath = dirname(sourceFile)
  console.error('source path:', sourcePath)
  let pkg = JSON.parse(fs.readFileSync(sourceFile))
  pkg = pkg['tre-init'] || pkg

  ssbClient(keys, Object.assign({},
    conf,
    { manifest: {
      publish: 'async',
      blobs: {
        add: 'sink'
      }
    }}
  ), (err, ssb) => {
    if (err) {
      console.error(err.message)
      process.exit(1)
    }
    doImport(ssb, conf, sourcePath, pkg, argv, (err, newConf) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }
      console.log(JSON.stringify(newConf, null, 2))
    })
  })
}

module.exports = doImport

function doImport(ssb, conf, basedir, pkg, opts, cb) {
  const {dryRun} = opts
  const importConfig = conf.tre || conf
  debug('pkg: %O', pkg)
  debug('importConfig: %O', importConfig)
  debug('root: %s', importConfig.branches.root)

  if (opts.dryRun) {
    console.error("Won't publish because of --dryRun option")
    ssb.blobs.add = cb => pull.onEnd(err => cb(err, 'fake-hash'))
    ssb.publish = function(content, cb) {
      const msg = {
        key: 'fake-key',
        value: {
          content
        }
      }
      console.error('would publish', JSON.stringify(msg, null, 2))
      cb(null, msg)
    }
  }

  const branches = Object.assign({}, importConfig.branches, pkg.branches)
  debug('branches are: %O', branches)
  const protos = pkg.prototypes || {}
  debug('prototypes from package: %O', pkg.prototypes)
  debug('prototypes from command line: %O', conf['publish-prototype'])
  ;(arr(conf['publish-prototype']) || []).forEach(p =>{protos[p] = true})
  publishPrototypes(ssb, protos, branches, (err, prototypes) => {
    if (err) return cb(err)
    prototypes = Object.assign({}, importConfig.prototypes || {}, prototypes)
    debug('prototypes are: %O', prototypes)
    const importers = Object.assign({}, importConfig.importers || {}, pkg.importers || {})
    debug('importers are: %O', importers)
    importFiles(ssb, importers, pkg.files, prototypes, basedir, (err, fileMessages) => {
      if (err) return cb(err)
      const messages = Object.assign({}, fileMessages, pkg.messages || {})
      publishMessages(ssb, branches, messages, (err, branches) => {
        if (err) return cb(err)
        const newConfig = {
          branches, prototypes
        }
        ssb.close()
        cb(null, newConfig)
      })
    })
  })
}

// --

function publishPrototypes(ssb, prototypes, folders, cb) {
  if (!prototypes) {
    return cb(null, {})
  }
  console.error('Publishing prototypes ...')
  makePrototypes(ssb, Object.keys(prototypes).filter(k => prototypes[k]), folders, cb)
}

function importFiles(ssb, importers, files, prototypes, basedir, cb) {
  debug('importers: %O')
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
      let paths = Array.isArray(path) ? path : [path]
      paths = paths.map(p => join(basedir, p))

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

function publishMessages(ssb, folders, messages, cb) {

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

  if (!Object.keys(messages)) return cb(null, folders)

  const sorted = causalOrder(messages)
  debug('Causal order:')
  sorted.forEach(kv => debug('%s', kv.key))

  pull(
    pull.values(sorted),
    pull.asyncMap( (kv, cb) => {
      const content = kv.value
      const name = kv.key
      resolveVars(content)
      ssb.publish(content, (err, msg) => {
        if (err) return cb(err)
        folders[name] = msg.key
        console.error('Published', content.type, name, 'as', msg.key)
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

function localRequire(modname) {
  return modname == '.' ? require(resolve('.')) : require(resolve(`node_modules/${modname}`))
}

function arr(x) {
  if (!x) return []
  if (Array.isArray(x)) return x
  return [x]
}
