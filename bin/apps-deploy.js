#!/usr/bin/env node
const fs = require('fs')
const {join, resolve} = require('path')
const pull = require('pull-stream')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const {exec} = require('child_process')
const multicb = require('multicb')
const readPkg = require('read-pkg-up').sync
const file = require('pull-file')
const Browserify = require('browserify')
const toPull = require('stream-to-pull-stream')

if (process.argv.length<3) {
  console.error('USAGE: tre-apps-deploy <index.js>')
  process.exit(1)
}

const sourceFile = process.argv[2]
console.error('source:', sourceFile)

const conf = require('rc')('tre')
const path = conf.config
if (!path) {
  console.error('.trerc not found')
  process.exit(1)
}
const keys = ssbKeys.loadSync(join(path, '../.tre/secret'))

isClean( (err, clean) => {
  //if (err || !clean) process.exit(1)
  const {pkg,path} = readPkg()
  const basic = {
    name: pkg.name,
    description: pkg.description,
    keywords: pkg.keywords || []
  }
  const pkgLckPath = resolve(path, '../package-lock.json')
  if (!fs.existsSync(pkgLckPath)) {
    console.error('No package-lock.json found')
    process.exit(1)
  }
  const done = multicb({pluck:1, spread: true})

  compile(sourceFile, done())
  upload(conf, keys, pkgLckPath, done())
  gitInfo(done())
   
  done( (err, codeBlob, lockBlob, git) => {
    if (err) {
      console.error(err.message)
      process.exit(1)
    }
    const blobs = {
      codeBlob,
      lockBlob
    }
    const tre = conf.tre

    const content = Object.assign({},
      basic,
      {config: {tre}},
      blobs,
      git
    )
    console.log(content)
  })
})

/*
showList(conf, keys, err  => {
  if (err) {
    console.error('Unable to list apps:', err.message)
    process.exit(1)
  }
})
*/

function compile(sourceFile, cb) {
  const browserify = Browserify()
  browserify.add(sourceFile)
  ssbClient(keys, Object.assign({},
    conf, { manifest: {blobs: {add: 'sink'}} }
  ), (err, ssb) => {
    if (err) return cb(err)
    pull(
      toPull.source(browserify.bundle()),
      ssb.blobs.add( (err, hash) =>{
        ssb.close()
        cb(err, hash)
      })
    )
  })
}

function upload(conf, keys, path, cb) {
  ssbClient(keys, Object.assign({},
    conf, { manifest: {blobs: {add: 'sink'}} }
  ), (err, ssb) => {
    if (err) return cb(err)
    pull(
      file(path),
      ssb.blobs.add( (err, hash) =>{
        ssb.close()
        cb(err, hash)
      })
    )
  })
}


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

function isClean(cb) {
  exec('git status --porcelain', (err, status) => {
    if (err) {
      console.error('git status failed', err.message)
      return cb(err)
    }
    if (status.replace(/\n/g,''.length)) {
      console.error('\nWorking directory is not clean\n')
      console.error(status)
      console.error('\nPlease commit and try again.\n')
      return cb(null, false)
    }
    cb(null, true)
  })
}

function gitInfo(cb) {
  const done = multicb({pluck: 1, spread: true})

  exec('git describe --dirty', done())
  exec('git remote get-url origin', done())
  exec('git symbolic-ref --short HEAD', done())

  done( (err, ref, url, branch) => {
    if (err) return cb(err)
    cb(null, {
      commit: ref.replace(/\n/,''),
      repository: url.replace(/\n/,''),
      branch: branch.replace(/\n/,'')
    })
  })
}
