# tre-init

tre-init and other command line utilities for Tre. 

## Install

```
npm i -g tre-init
```

## tre-init - Create a new ssb network and an initial message tree

```
cd myproject
tre-init
```

This creates the file `.trerc` and the directory `.tre` in the current working directory. `.trerc` serves the same purpose as `~/.ssb/config` in traditional ssb setups. Additionally, it contains ssb message keys of some of the branches that were created by tre-init. A new, random network-id was created, port numbers also are random (above 50000 and below 65000)

Data is stored in `.tre`, it replaces `~/.ssb` in traditional ssb setups. 

In case they did not exist before, new keypairs were created in `.tre/secret` and `.tre/browser-keys`

## Run sbot with the local config

`tre-bot` is a simple wrapper around `sbot` (scuttlebot). It instructs sbot to use the local config. You can run it from anywhere inside your project tree, it will pick up the closest `.trerc` file.

```
tre-bot server
```

## Create a pub

```
tre-pub-config | ssh myserver.com 'mkdir -p .myappname && cat - > .myappname/config'
# run `ssb_appname=myappname sbot server` on your server
ssh korn 'ssb_appname=myappname sbot getAddress' > .tre/remotes
# edit .tre/remotes so that it looks something like
{
  "myserver": "net:138.231.111.84:42632~shs:6odsaDg5OpsFlfa7LLSLxikxF5ze4DN03bAz6vrz7uMQ="
}

## Crete an invite code

```
tre-invite > invite.json
```

This invite code can be pasted into bay-of-plenty. It will instruct the pub to follow the user, the user to follow the pub and you, and give the user a name you can specify in invite.json.

## deploy an application

```
tre-apps-deploy <source.js>
```

browserifies source.js, uploads the result as a blob and publishes a message of type `webapp`. If a previous webapp exists and was deployed from a repo with the same `origin  remote and from the same git branch, and by the same author, that pre-existing webapp is updated. (a new revision of that webapp is posted).

Here's an example message piblished by `tre-apps-deploy`

```
{
  "previous": "%GkSmUhYX7jM5rzHobHlUHTzgqc9LKxM8T5eRwuJW624=.sha256",
  "sequence": 28,
  "author": "@h8sMNhOo43PP8HX+9B3PCJPchqxhpPXgzwFG7HIaNbc=.ed25519",
  "timestamp": 1547036143789,
  "hash": "sha256",
  "content": {
    "type": "webapp",
    "name": "tre-init",
    "description": "Initialize and test a new ssb network",
    "keywords": [
      "ssb",
      "tre"
    ],
    "config": {
      "tre": {
        "branches": {
          "root": "%eMe2hfQ+gI4NKQJzoycSQmefvSLKkwmdXBGj6JRQHwM=.sha256",
          "about": "%LQu4ZrTcuS2JhiYGAwk1Lg+Wee5M7OH74XnoSVZ1TdQ=.sha256",
          "machines": "%IPYCOlf24z5BeN9BSGPZfWpDIKptDbeYDnEryKldxew=.sha256",
          "prototypes": "%38ZbMKMoC4oVXeTZ+bx3objqO8SL3ZYXz6wLBprnmd8=.sha256",
          "webapps": "%lkexgs1dnCCvkOjbRyJAUnWwbk1igt4DqOhBe9U3klY=.sha256",
          "trash": "%152k3CQRaeK7K+hZy41QCo8aRZjaUg6SyfgG8FeGeLo=.sha256"
        }
      }
    },
    "codeBlob": "&IBbpG0szrPmtzbPwXKN0ZijQ9KeIJpzh0JYnIrZx6SE=.sha256",
    "lockBlob": "&iwEhkt7JCD9tRnFzkAgRvgdeARj450Db8whC2QMbhqU=.sha256",
    "commit": "v1.6.0-6-g01484fd",
    "repository": "git@github.com:regular/tre-init.git",
    "repositoryBranch": "master",
    "revisionBranch": "%GkSmUhYX7jM5rzHobHlUHTzgqc9LKxM8T5eRwuJW624=.sha256",
    "revisionRoot": "%39L6vcMxCbcDrRUJyUWSJd2oJ5mA55aG0ecNNijlSaw=.sha256",
    "change-log": [
      "01484fd5aa5c0376e02df540dbee7d63a7239992 Add tre-apps-deploy to Readme"
    ]
  },
  "signature": "rtkZoJkNRDoWUi39gU+LMmVfkOODLdLM/B7sSnbpXNG02/H21DhNazmEmK5ZbUJrEw5R6HgBJLaSY0G+shbUCw==.sig.ed25519"
}
```
---

Licsense: AGPLv3 - Copyright 2019 Jan Boelsche
