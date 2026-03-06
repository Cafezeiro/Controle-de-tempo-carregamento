# Sistema de Controle de Veiculos

Sistema web para cadastro e visualizacao de veiculos em tempo real. Versao atual sem Firebase: usa Netlify Functions + Netlify Blobs para sincronizar entre dispositivos.

## Funcionalidades
- Cadastro de veiculos (normal ou OFR) com hora de entrada e chegada
- Painel mostrando fila, tempos e destaques para OFR
- Interface responsiva e simples de usar
- Dados persistidos via Netlify Blobs (JSON) acessados pela Function `/api/fila`

## Como publicar no Netlify
- `netlify.toml` ja define `publish = "."` e `functions = "netlify/functions"`.
- Redirect `/api/*` → `/.netlify/functions/:splat` ja configurado.
- Suba a pasta inteira (Git/CLI ou drag-and-drop). Nao ha comando de build.
- Instale as dependencias (gera package-lock.json) com `npm install` antes de subir, pois a Function usa `@netlify/blobs`.

## Estrutura
```
cadastro veiculos/
├─ index.html       # Menu inicial (links para cadastro e painel)
├─ Cadastro.html    # Formulario de cadastro
├─ Painel.html      # Painel em tempo real
├─ README.md
├─ package.json                # dependencias da function (inclui @netlify/blobs)
├─ netlify.toml                # config de publish + redirects
└─ netlify/functions/fila.js   # API GET/POST da fila usando Netlify Blobs
```

## Backend (Netlify Functions + Blobs)
- API em `/.netlify/functions/fila` (tambem via `/api/fila`).
- `GET /api/fila` retorna o JSON completo da fila.
- `POST /api/fila` com `{transporte, placa, entrada, chegada, tipo}` salva e retorna `{ok:true, id}`.
- Os dados ficam persistidos em Netlify Blobs (JSON), sem depender de Firebase.
