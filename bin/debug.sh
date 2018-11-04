set -exu
here=$(dirname $(realpath $0))
port=$(node -p "require('rc')('tre').budo.port")
host=$(node -p "require('rc')('tre').budo.host")
secret=$(dirname $(node -p "require('rc')('tre').config"))/.tre/browser-keys
keys=$(cat "${secret}"|grep -v '^#')
remote=$(bash ${here}/trebot ws.getAddress)
npx localstorage write "${host}:${port}" tre-remote "${remote}"
npx localstorage write "${host}:${port}" tre-keypair "${keys}"
npx budo --static-options [ --dotfiles allow ] --no-portfind --port ${port} --host "${host}" $@
