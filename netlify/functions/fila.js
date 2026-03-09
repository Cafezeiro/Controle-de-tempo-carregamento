// Persistencia usando Netlify Blobs, com fallback em memoria quando o ambiente nao estiver configurado.
const { getStore } = require("@netlify/blobs");

const allowMemoryFallback = process.env.ALLOW_MEMORY_FALLBACK === "true";
let memoryStore = []; // fallback em memoria (nao persiste entre invocacoes)

function createStore() {
  const siteID = process.env.SITE_ID || process.env.BLOBS_SITE_ID;
  const token =
    process.env.BLOBS_TOKEN ||
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_BLOBS_WRITE_TOKEN;

  // Se ambiente estiver pronto, usa Blobs com credenciais automaticas ou fornecidas.
  if (siteID && token) {
    return getStore({ name: "fila", siteID, token });
  }

  // Tenta usar configuracao implicita (quando Netlify injeta variaveis automaticamente).
  try {
    return getStore({ name: "fila" });
  } catch (err) {
    // Sem Blobs configurado: fallback em memoria (nao persiste).
    return null;
  }
}

const store = createStore();

async function loadRaw() {
  if (store) {
    const text = await store.get("fila.json", { type: "text" });
    if (!text) return [];
    try {
      return JSON.parse(text);
    } catch {
      return [];
    }
  }
  if (!allowMemoryFallback) {
    const err = new Error("Armazenamento nao configurado");
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }
  return memoryStore;
}

function normalize(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).map(([id, v]) => ({ id, ...v }));
}

async function loadFila() {
  const data = await loadRaw();
  return normalize(data);
}

async function saveFila(data) {
  if (store) {
    await store.set("fila.json", JSON.stringify(data), {
      metadata: { contentType: "application/json" },
    });
  } else {
    if (!allowMemoryFallback) {
      const err = new Error("Armazenamento nao configurado");
      err.code = "STORAGE_NOT_CONFIGURED";
      throw err;
    }
    memoryStore = data;
  }
}

function getIdFromPath(path) {
  if (!path) return null;
  const match = path.match(/\/fila\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

exports.handler = async (event) => {
  // CORS permissive para demo; ajuste Origin se quiser restringir
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  const fail = (statusCode, message) => ({
    statusCode,
    headers,
    body: JSON.stringify({ error: message }),
  });

  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers };
    }

    const method = event.httpMethod || "GET";
    const id = getIdFromPath(event.path || "");

    if (method === "GET") {
      const fila = await loadFila();
      return { statusCode: 200, headers, body: JSON.stringify(fila) };
    }

    if (method === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch (err) {
        return fail(400, "Invalid JSON");
      }

      const { area, transporte, placa, entrada, chegada, tipo } = body;
      if (!area || !transporte || !placa || !entrada || !chegada || !tipo) {
        return fail(400, "Campos obrigatorios faltando");
      }

      const fila = await loadFila();
      const newId = Date.now().toString() + "_" + Math.random().toString(16).slice(2);
      const item = {
        id: newId,
        area,
        transporte,
        placa,
        entrada,
        chegada,
        tipo,
        createdAt: Date.now(),
      };
      fila.push(item);
      await saveFila(fila);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, item }) };
    }

    if (method === "PUT") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch (err) {
        return fail(400, "Invalid JSON");
      }

      const fila = await loadFila();

      if (id) {
        const idx = fila.findIndex((v) => v.id === id);
        if (idx < 0) {
          return fail(404, "Registro nao encontrado");
        }
        const current = fila[idx];
        fila[idx] = { ...current, ...body, id: current.id };
        await saveFila(fila);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, item: fila[idx] }) };
      }

      if (!Array.isArray(body)) {
        return fail(400, "Array esperado");
      }

      await saveFila(body);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (method === "DELETE") {
      if (id) {
        const fila = await loadFila();
        const idx = fila.findIndex((v) => v.id === id);
        if (idx < 0) {
          return fail(404, "Registro nao encontrado");
        }
        fila.splice(idx, 1);
        await saveFila(fila);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }

      await saveFila([]);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return fail(405, "Method not allowed");
  } catch (err) {
    if (err && err.code === "STORAGE_NOT_CONFIGURED") {
      return fail(500, "Armazenamento nao configurado. Ative o Netlify Blobs ou defina as variaveis de ambiente.");
    }
    console.error(err);
    return fail(500, "Erro interno");
  }
};
