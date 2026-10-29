// ============================================================================
// Demo recordings in tests. The app plays public/demos/*.m4a (AAC, which Safari
// and Chrome decode), but Playwright's Chromium is built without proprietary
// codecs and can't decode AAC. So tests answer the app's requests for those files
// with the very same recordings decoded to WAV by ffmpeg (cached per file
// version): the app's own fetch, decode, trim and playback all still run.
//   await serveDemoRecordings(pageOrContext)
// With SYNTH_DEMO_AAC=1 (a browser that decodes AAC) the files go through as they are.
// ============================================================================
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'public', 'demos');
const CACHE = path.join(os.tmpdir(), 'synth-demo-wav');
const FFMPEG = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';

/** The WAV of a recording (32-bit float, as ffmpeg decodes the AAC) */
function wavOf(file) {
  const src = path.join(DIR, path.basename(file));
  const st = fs.statSync(src);
  const out = path.join(CACHE, `${path.basename(file)}.${st.size}.${Math.round(st.mtimeMs)}.wav`);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(CACHE, { recursive: true });
    execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-c:a', 'pcm_f32le', out]);
  }
  return out;
}

async function serveDemoRecordings(target) {
  if (process.env.SYNTH_DEMO_AAC === '1') return;
  await target.route(/\/demos\/[^/?#]+\.m4a(\?.*)?$/, async route => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    try {
      await route.fulfill({ status: 200, contentType: 'audio/wav', body: fs.readFileSync(wavOf(name)) });
    } catch (e) {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: String(e) });
    }
  });
}

/** The manifest the app plays from */
const manifest = () => JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

module.exports = { serveDemoRecordings, wavOf, manifest };
