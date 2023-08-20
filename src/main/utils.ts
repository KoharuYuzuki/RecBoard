import fs from 'fs/promises'

export function isExists (path: string) {
  return fs.access(path, fs.constants.R_OK | fs.constants.W_OK)
}

export function isFile (path: string) {
  return new Promise<boolean>((resolve, reject) => {
    isExists(path)
    .then(() => fs.lstat(path))
    .then((stats) => resolve(stats.isFile()))
    .catch(reject)
  })
}

export function readFileAsString (path: string) {
  return fs.readFile(path, { encoding: 'utf-8' })
}
