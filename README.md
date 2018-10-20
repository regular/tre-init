# tre-init

## Install

```
npm i -g tre-init
```

## Create a new ssb network and an initial message tree

```
cd myproject
tre-init > .trerc
```

`.trerc` contains a valid sbot config and ssb message keys of some of the branches that were created by tre-init. A new, random network-id was created, port numbers also are random (above 50000 and below 65000)

In case it did not exist before, a new keypair was created in `.tre/secret`

## Run sbot with the local config

```
trebot server
```

looks for `.trerc` in the current working directory, if not found traverses the parent directories. (just like git or npm)

## Test local tcp connection

```
trebot whoami
```

## Test non-auth local websocket connection

```
npx budo index.js
```
