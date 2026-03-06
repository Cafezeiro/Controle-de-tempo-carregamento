// Persistencia usando Netlify Blobs, com fallback em memoria quando o ambiente nao estiver configurado.
const { getStore } = require("@netlify/blobs");

let memoryStore = {}; // fallback em memoria (nao persiste entre invocacoes)

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

async function loadFila() {
  if (store) {
    const text = await store.get("fila.json", { type: "text" });
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  return memoryStore;
}

async function saveFila(data) {
  if (store) {
    await store.set("fila.json", JSON.stringify(data), {
      metadata: { contentType: "application/json" },
    });
  } else {
    memoryStore = data;
  }
}

exports.handler = async (event) => {
  // CORS permissive para demo; ajuste Origin se quiser restringir
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === "GET") {
    const fila = await loadFila();
    return { statusCode: 200, headers, body: JSON.stringify(fila) };
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
    }

    const { transporte, placa, entrada, chegada, tipo } = body;
    if (!transporte || !placa || !entrada || !chegada || !tipo) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Campos obrigatorios faltando" }) };
    }

    const fila = await loadFila();
    const id = Date.now().toString();
    fila[id] = {
      transporte,
      placa,
      entrada,
      chegada,
      tipo,
      timestamp: Date.now(),
    };
    await saveFila(fila);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id }) };
  }

  if (event.httpMethod === "DELETE") {
    const id = (event.path || "").split("/").pop(); // id vem no final da rota /fila/:id
    if (!id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "ID obrigatorio" }) };
    }

    const fila = await loadFila();
    if (!fila[id]) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Registro nao encontrado" }) };
    }

    delete fila[id];
    await saveFila(fila);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
