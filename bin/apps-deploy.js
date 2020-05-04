#!/usr/bin/env node
const fs = require('fs')
const {join, resolve, relative, dirname} = require('path')
const pull = require('pull-stream')
const ssbClient = require('scuttlebot-release/node_modules/ssb-client')
const ssbKeys = require('scuttlebot-release/node_modules/ssb-keys')
const {exec} = require('child_process')
const multicb = require('multicb')
const readPkg = require('read-pkg-up').sync
const file = require('pull-file')
const Browserify = require('browserify')
const crypto = require('crypto')
const toPull = require('stream-to-pull-stream')
const htime = require('human-time')
const indexhtmlify = require('indexhtmlify')
const metadataify = require('metadataify')
const getRemote = require('../lib/get-remote')
const uploadBlobs = require('../lib/upload-blobs')
const argv = require('minimist')(process.argv.slice(2))

const {debug, dryRun, force, noCommitLog} = argv

if (argv._.length<1) {
  console.error('USAGE: tre-apps-deploy <index.js> [--dryRun] [--force] [--noCommitLog]')
  process.exit(1)
}

const sourceFile = resolve(argv._[0])
console.error('source:', sourceFile)
const sourcePath = dirname(sourceFile)
console.error('source path:', sourcePath)

const conf = require('rc')('tre')
const path = conf.config
if (!path) {
  console.error('.trerc not found')
  process.exit(1)
}
const keys = ssbKeys.loadSync(join(path, '../.tre/secret'))

const remote = getRemote(conf)
console.error(`remote is ${remote}`)

isClean(sourcePath, (err, clean) => {
  if (err || !clean) {
    if (!force) process.exit(1)
    console.error('(--force is set, so we continue anyway')
  }

  const {pkg, path} = readPkg({cwd: sourcePath})
  const rootDir = dirname(path)
  const main = relative(rootDir, sourceFile)

  console.error('rootDir:', rootDir)
  console.error('main:', main)

  const basic = {
    type: 'webapp',
    name: pkg.name,
    root: conf.tre.branches.root,
    branch: conf.tre.branches.webapps,
    main,
    description: pkg.description,
    keywords: pkg.keywords || []
  }
  const pkgLckPath = resolve(rootDir, 'package-lock.json')
  if (!fs.existsSync(pkgLckPath)) {
    console.error('No package-lock.json found')
    process.exit(1)
  }
  const done = multicb({pluck:1, spread: true})

  if (argv.blob) {
    done()(null, {
      blobHash: argv.blob,
      scriptHash: argv.hash
    })
  } else {
    compile(sourceFile, Object.assign({}, pkg, argv), done())
  }
  uploadBlobs([file(pkgLckPath)], conf, keys, remote, done())
  gitInfo(rootDir, done())
   
  done( (err, html, hashes, git) => {
    if (err) {
      console.error(err.message)
      process.exit(1)
    }
    const lockBlob = hashes[0]
    const blobs = {
      codeBlob: html.blobHash,
      scriptHash: html.scriptHash,
      lockBlob
    }
    const tre = conf.tre

    const content = Object.assign({},
      basic,
      {config: {tre}},
      blobs,
      git,
      {name: `${basic.name} [${git.repositoryBranch.substr(0, 4)}]`}
    )
    
    publish(rootDir, conf, keys, content, (err, kv) => {
      if (err) {
        console.error('Unable to publish', err.message)
        process.exit(1)
      }
      console.error('Published as', kv.key)
      console.log(JSON.stringify(kv, null, 2))
    })
  })
})

function compile(sourceFile, opts, cb) {
  const browserify = Browserify()
  browserify.add(sourceFile)
  const scriptHash = crypto.createHash('sha256')
  const source = pull(
    toPull.source(browserify.bundle()),
    pull.through(b => {
      scriptHash.update(b)
    }),
    toPull.transform(indexhtmlify(opts)),
    toPull.transform(metadataify(opts))
  )
  uploadBlobs([source], conf, keys, remote, (err, hashes) => {
    if (err) return cb(err)
    cb(null, {
      blobHash: hashes[0],
      scriptHash: scriptHash.digest('base64')
    })
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

function publish(path, conf, keys, content, cb) {
  ssbClient(keys, Object.assign({},
    conf,
    {
      manifest: {
        publish: 'async',
        revisions: {
          messagesByType: 'source'
        }
      }
    }
  ), (err, ssb) => {
    if (err) return cb(err)
    const webapps = []
    pull(
      ssb.revisions.messagesByType('webapp'),
      // TODO: we must not use an index (messagesByType) here
      // as long as that implies allowAllAuthors!
      // we pick up the wron app if it was altered by someone except
      // the original author
      pull.drain( e =>{
        const revRoot = e.key.slice(-1)[0]
        const content = e.value.value.content
        console.error('',
          `${revRoot.substr(0,5)}:${e.value.key.substr(0,5)}`, content.name, content.repositoryBranch, content.commit, htime(new Date(e.value.value.timestamp)), 'by', e.value.value.author.substr(0, 5))
        webapps.push(e.value) // kv
      }, err => {
        if (err) return cb(err)
        let webapp = findWebapp(keys.id, webapps, content)
        if (!argv.revRoot) {
          console.error(`Specify --revRoot. Suggested revRoot: ${webapp && revisionRoot(webapp).slice(0,6)}`)
        } else {
          webapp = webapps.find( kv=>revisionRoot(kv).startsWith(argv.revRoot))
        }
        if (!webapp) {
          console.error('First deployment of this webapp')
          if (!argv.first) {
            console.error('specify --first if you want this to happen')
            process.exit(1)
          }
        } else {
          content.revisionBranch = webapp.key
          content.revisionRoot = revisionRoot(webapp)
          console.error('Updating existing webapp', content.revisionRoot.substr(0, 5))
        }
        getLogMessages(path, webapp, content, (err, commits) => {
          if (err) {
            ssb.close()
            return cb(err)
          }
          if (noCommitLog) {
            commits = []
          }
          content['new-commits'] = commits || []
          if (dryRun) {
            ssb.close()
            return cb(null, {value: content})
          }
          ssb.publish(content, (err, kv) => {
            ssb.close()
            if (err) return cb(err)
            cb(null, kv)
          })
        })
      })
    )
  })
}

function getLogMessages(cwd, webapp, content, cb) {
  if (!content.commit) return cb(null, [])
  const before = webapp && webapp.value.content.commit || ''
  const after = content.commit
  //if (!before || !after) return cb(null, [])
  if (before.includes('dirty') || after.includes('-dirty')) return cb(null, null)
  console.error(`getting git log messages ${before}..${after}`)
  exec(`git log --pretty=oneline ${before ? before+'..':''}${after}`, {cwd}, (err, logs) => {
    if (err) return cb(err)
    const lines = logs.split('\n').filter(Boolean)
    cb(null, lines)
  })
}

function findWebapp(author, kvs, content) {
  const {repository, repositoryBranch} = content
  const kv = kvs.find( ({key, value}) => {
    if (debug) console.error(`${key.substr(0,5)}: `)
    const {content} = value
    if (value.author !== author) {
      if (debug) console.error('wrong author')
      return false
    }
    if (content.repository !== repository) {
      if (debug) console.error('wrong repo')
      return false
    }
    if (content.repositoryBranch !== repositoryBranch) {
      if (debug) console.error('wrong repo branch')
      return false
    }
    return true
  })
  return kv
}

function isClean(cwd, cb) {
  exec('git status --porcelain', {cwd}, (err, status) => {
    if (err) {
      console.error('git status failed', err.message)
      return cb(err)
    }
    if (status.replace(/\n/g,''.length)) {
      console.error(`\nWorking directory is not clean: ${cwd}\n`)
      console.error(status)
      console.error('\nPlease commit and try again.\n')
      return cb(null, false)
    }
    cb(null, true)
  })
}

function gitInfo(cwd, cb) {
  const done = multicb({pluck: 1, spread: true})

  exec('git describe --dirty --always', {cwd}, done())
  exec('git remote get-url origin', {cwd}, done())
  exec('git symbolic-ref --short HEAD', {cwd}, done())

  done( (err, ref, url, branch) => {
    if (err) return cb(err)
    cb(null, {
      commit: ref.replace(/\n/,''),
      repository: url.replace(/\n/,''),
      repositoryBranch: branch.replace(/\n/,'')
    })
  })
}

function revisionRoot(kv) {
  return kv.value.content.revisionRoot || kv.key
}
