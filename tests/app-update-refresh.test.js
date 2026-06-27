const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app', 'api', 'version', 'route.ts'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app', 'globals.css'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(route.includes('VERCEL_GIT_COMMIT_SHA') && route.includes('Cache-Control') && route.includes('no-store'), 'Version endpoint should expose an uncached deployment version.');
assert(page.includes('const [appUpdateAvailable, setAppUpdateAvailable] = useState(false);'), 'App should track whether a newer deployed version is available.');
assert(page.includes('fetch("/api/version", { cache: "no-store" })'), 'App should poll the uncached version endpoint.');
assert(page.includes('window.setInterval(checkAppVersion, 60_000)'), 'App should check periodically for new deployments.');
assert(page.includes('window.addEventListener("focus", checkAppVersion)') && page.includes('visibilitychange'), 'App should re-check when the user returns to the tab.');
assert(page.includes('New update available') && page.includes('window.location.reload()'), 'App should show a refresh prompt with a reload button.');
assert(css.includes('.appUpdateBanner'), 'Refresh prompt should have dedicated themed styling.');

console.log('App update refresh checks passed.');
