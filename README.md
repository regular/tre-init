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

```
