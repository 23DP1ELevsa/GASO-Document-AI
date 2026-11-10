import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (name) => readFile(path.join(root, name), 'utf8')
const config = JSON.parse(await read('capacitor.config.json'))
assert.equal(config.appId, 'lv.gaso.documentai.prototype')
assert.equal(config.appName, 'GASO Document AI')
assert.equal(config.webDir, 'dist')
assert.deepEqual(
  JSON.parse(await read('android/app/src/main/assets/capacitor.config.json')),
  config,
)
assert.match(
  await read('android/app/build.gradle'),
  /applicationId "lv\.gaso\.documentai\.prototype"/,
)
assert.match(await read('android/variables.gradle'), /compileSdkVersion = 36/)
assert.match(
  await read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'),
  /@drawable\/ic_launcher_foreground/,
)
assert.equal(
  await read('android/app/src/main/res/drawable/ic_launcher_foreground.xml'),
  await read('android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml'),
)
for (const file of [
  'android/gradlew.bat',
  'android/gradle/wrapper/gradle-wrapper.jar',
  'android/app/src/main/assets/public/index.html',
  'android/app/src/main/java/lv/gaso/documentai/prototype/MainActivity.java',
])
  await access(path.join(root, file))
const plugins = JSON.parse(await read('android/app/src/main/assets/capacitor.plugins.json'))
assert.ok(plugins.some((plugin) => plugin.pkg === '@capacitor/app'))
assert.ok(plugins.some((plugin) => plugin.pkg === '@capacitor/splash-screen'))
let hasServiceWorker = false
try {
  await access(path.join(root, 'android/app/src/main/assets/public/sw.js'))
  hasServiceWorker = true
} catch {}
assert.equal(hasServiceWorker, false, 'Native būvējumā nedrīkst būt web service worker')
console.log(
  'Android konfigurācija, resursi, spraudņi un native interfeisa kopija pārbaudīta. Tas nav APK kompilācijas vai ierīces tests.',
)
