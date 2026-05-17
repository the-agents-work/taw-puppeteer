import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 5173);
const env = await loadEnv();

const config = {
  appId: process.env.VBEE_APP_ID || env.VBEE_APP_ID || "e27dcf72-1fe0-4417-9d2e-66940c34fd09",
  token: process.env.VBEE_TOKEN || env.VBEE_TOKEN || "",
  callbackUrl:
    process.env.VBEE_CALLBACK_URL ||
    env.VBEE_CALLBACK_URL ||
    `http://127.0.0.1:${port}/api/vbee-callback`,
  baseUrl: process.env.VBEE_BASE_URL || env.VBEE_BASE_URL || "https://vbee.vn",
};

const actorVoices = {
  mai: process.env.VBEE_VOICE_MAI || env.VBEE_VOICE_MAI || "hn_female_ngochuyen_full_48k-fhg",
  long: process.env.VBEE_VOICE_LONG || env.VBEE_VOICE_LONG || "hn_male_thanhlong_talk_48k-fhg",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/config") {
      return json(res, 200, {
        vbeeReady: Boolean(config.appId && config.token),
        appIdConfigured: Boolean(config.appId),
        tokenConfigured: Boolean(config.token),
        voices: actorVoices,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/voices") {
      return handleVoices(res);
    }

    if (req.method === "POST" && url.pathname === "/api/tts") {
      return handleTts(req, res);
    }

    if (req.method === "POST" && url.pathname === "/api/vbee-callback") {
      await readJson(req).catch(() => null);
      return json(res, 200, { ok: true });
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    return json(res, 500, { error: error.message || "Internal server error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`taw-puppeteer running at http://127.0.0.1:${port}`);
  console.log(`Vbee token configured: ${Boolean(config.token)}`);
});

async function loadEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return {};

  const content = await readFile(path, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        const key = line.slice(0, index).trim();
        const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        return [key, value];
      }),
  );
}

async function handleVoices(res) {
  if (!config.appId) {
    return json(res, 400, { error: "Missing VBEE_APP_ID" });
  }

  const response = await fetch(`${config.baseUrl}/api/public/v1/voices?voiceOwnership=VBEE&languageCode=vi-VN&limit=20`, {
    headers: vbeeHeaders({ includeAppId: true }),
  });
  const body = await response.json().catch(() => ({}));
  return json(res, response.ok ? 200 : response.status, body);
}

async function handleTts(req, res) {
  const body = await readJson(req);
  const text = String(body.text || "").trim();
  const actor = body.actor === "long" ? "long" : "mai";

  if (!text) {
    return json(res, 400, { error: "Missing text" });
  }

  if (!config.appId || !config.token) {
    return json(res, 412, {
      error: "Vbee token is not configured",
      fallback: "browser-speech",
      details: "Set VBEE_TOKEN in .env.local, then restart npm run dev.",
    });
  }

  const createResponse = await fetch(`${config.baseUrl}/api/v1/tts`, {
    method: "POST",
    headers: vbeeHeaders(),
    body: JSON.stringify({
      app_id: config.appId,
      response_type: "indirect",
      callback_url: config.callbackUrl,
      input_text: text,
      voice_code: actorVoices[actor],
      audio_type: "mp3",
      bitrate: 128,
      speed_rate: "1.0",
    }),
  });

  const created = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || created.status !== 1) {
    return json(res, createResponse.ok ? 502 : createResponse.status, {
      error: "Vbee create speech failed",
      provider: created,
    });
  }

  const requestId = created.result?.request_id;
  if (!requestId) {
    return json(res, 502, { error: "Vbee did not return request_id", provider: created });
  }

  const result = await pollVbeeRequest(requestId);
  if (!result.audio_link) {
    return json(res, 504, { error: "Vbee audio was not ready in time", requestId, provider: result });
  }

  const audioPath = await cacheAudio(requestId, result.audio_link, result.audio_type || "mp3");
  return json(res, 200, {
    requestId,
    audioUrl: audioPath,
    providerAudioLink: result.audio_link,
    voiceCode: result.voice_code,
    status: result.status,
  });
}

async function pollVbeeRequest(requestId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(attempt === 0 ? 500 : 1000);
    const response = await fetch(`${config.baseUrl}/api/v1/tts/${requestId}`, {
      headers: vbeeHeaders(),
    });
    const body = await response.json().catch(() => ({}));
    const result = body.result || {};
    if (result.status === "SUCCESS" || result.audio_link) return result;
    if (result.status === "FAILURE" || result.status === "FAILED") return result;
  }
  return { status: "TIMEOUT", request_id: requestId };
}

async function cacheAudio(requestId, audioLink, audioType) {
  const extension = audioType === "wav" ? "wav" : "mp3";
  const dir = join(root, ".cache", "vbee");
  const filePath = join(dir, `${requestId}.${extension}`);
  await mkdir(dir, { recursive: true });

  const response = await fetch(audioLink);
  if (!response.ok) {
    throw new Error(`Unable to download Vbee audio: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/audio/${requestId}.${extension}`;
}

function vbeeHeaders(options = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  if (options.includeAppId && config.appId) headers["app-id"] = config.appId;
  return headers;
}

async function serveStatic(pathname, res) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const base = cleanPath.startsWith("/audio/") ? join(root, ".cache", "vbee") : root;
  const relative = cleanPath.startsWith("/audio/") ? cleanPath.replace("/audio/", "") : cleanPath.slice(1);
  const filePath = normalize(join(base, relative));

  if (!filePath.startsWith(base)) {
    return json(res, 403, { error: "Forbidden" });
  }

  if (!existsSync(filePath)) {
    return json(res, 404, { error: "Not found" });
  }

  const type = contentTypes[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(res);
}

async function readJson(req) {
  let data = "";
  for await (const chunk of req) data += chunk;
  return data ? JSON.parse(data) : {};
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
