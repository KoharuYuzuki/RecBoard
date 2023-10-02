VERSION=$(node -p "require('./package.json').version")

pushd 'dist'

ditto -c -k "./mac/"       "RecBoard-v${VERSION}-mac-x64.zip"
ditto -c -k "./mac-arm64/" "RecBoard-v${VERSION}-mac-arm64.zip"

popd
