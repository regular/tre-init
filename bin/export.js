#!/usr/bin/env node
const fs = require('fs')
const {parse, join, resolve, dirname} = require('path')
const argv = require('minimist')(process.argv.slice(2))
const debug = require('debug')('tre-export')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')
const traverse = require('traverse')

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
    console.error('USAGE: tre-export DESTDIR [--field FILENAME_OR_DOTPATH] --type CONTENTTYPE --branch BRANCH [--forceExt EXT] [--lowerCase] [--kebabCase] [--dryRun]')
    process.exit(1)
  }

  const destDir = resolve(argv._[0])
  console.error('destination directory:', destDir)

  ssbClient(keys, Object.assign({},
    conf,
    { manifest: {
      revisions: {
        messagesByType: 'source',
        messagesByBranch: 'source'
      } 
    }}
  ), (err, ssb) => {
    if (err) {
      console.error(err.message)
      process.exit(1)
    }
    doExport(ssb, conf, destDir, argv, err => {
      ssb.close()
      if (err) {
        console.error(err)
        process.exit(1)
      }
    })
  })
}

module.exports = doExport

function doExport(ssb, conf, destDir, opts, cb) {
  const {dryRun, branch, type} = opts

  let fileWriteStream = function(filepath, cb) {
    return toPull.sink(fs.createWriteStream(filepath), cb) 
  }
  
  if (opts.dryRun) {
    console.error("Won't write files because of --dryRun option")
    fileWriteStream = function(filepath, cb) {
      console.error(`WOuld write file ${filepath}`)
      return cb(null)
    }
  }
  if (!opts.branch && !opts.type) return cb(new Error('Need to specify BRANCH or TYPE'))
  // TODO: support combined branch and type query
  if (opts.branch && opts.type) return cb(new Error('Need to specify BRANCH or TYPE'))
  const source = opts.branch ? 
    ssb.revisions.messagesByBranch(opts.branch) :
    ssb.revisions.messagesByType(opts.type)

  pull(
    source,
    pull.map( kkv => {
      const revRoot = kkv.key.slice(-1)[0]
      const revision = kkv.value.key
      const content = kkv.value.value.content
      let filename =
        content.filename ||
        content.name ||
        content.file && content.file.name ||
        revRoot.slice(1, 8)
      console.error(`Exporting ${revRoot.slice(0,6)}:${revision.slice(0,6)} as ${filename}`)
      const fn = parse(filename)
      if (opts.forceExt) {
        debug('forcing file extension: %s', opts.forceExt)
        fn.ext = opts.forceExt
        filename = `${fn.name}.${fn.ext}`
      }
      if (opts.lowerCase) {
        debug('forcing filename to lowerCase')
        filename = filename.toLowerCase()
      }
      if (opts.kebabCase) {
        debug('forcing filename to kebabCase')
        filename = filename.replace(/[^\w.]/g, '-')
      }
      return {filename, content}
    }),
    pull.map(({filename, content}) => {
      if (opts.field) {
        const path = opts.field.split('.')
        content = traverse(content).get(path)
        if (!content) console.error(filename, 'has no field', opts.field)
      }
      if (!content) {
        console.error(filename, 'has no content - skipping')
        return null
      }
      return {filename, content}
    }),
    pull.filter(),
    pull.map(({filename, content}) => {
      if (typeof content == 'object') {
        content = JSON.stringify(content, null, 2)
      }
      return {filename, content}
    }),
    pull.asyncMap(({filename, content}, cb) => {
      const filepath = join(destDir, filename)
      pull(
        pull.values([content]),
        fileWriteStream(filepath, err => {
          if (err) return cb(err)
          cb(null, filepath)
        })
      )
    }),
    pull.drain(filepath => {
      console.error(`Written ${filepath}`)
    }, cb)
  )
}

