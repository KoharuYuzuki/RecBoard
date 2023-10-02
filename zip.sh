pushd 'dist'

ditto -c -k "./mac/"       "RecBoard-mac-x64.zip"
ditto -c -k "./mac-arm64/" "RecBoard-mac-arm64.zip"

popd
