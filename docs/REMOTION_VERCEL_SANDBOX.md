# Renderização MP4 com Remotion + Vercel Sandbox

Este guia explica **detalhadamente** como usar o **Vercel Sandbox** para gerar vídeos MP4 do Remotion no servidor, sem AWS Lambda.

---

## 1. O que é o Vercel Sandbox para Remotion?

- **Vercel Sandbox** é um ambiente de execução que sobe uma **VM Linux efêmera** por renderização.
- Cada vez que você pede um MP4, a Vercel inicia um sandbox com **Chrome**, **FFmpeg** e as bibliotecas necessárias para o Remotion renderizar o vídeo.
- O vídeo é gerado **no servidor** e pode ser enviado para **Vercel Blob** (armazenamento) e depois baixado pelo usuário.

**Vantagens:**
- Não precisa configurar AWS Lambda nem conta AWS.
- Basta conta Vercel + um Blob Store.
- Deploy contínuo: push no Git e a renderização usa o código novo.

**Limitações:**
- Render em **uma única máquina** (mais lento que Lambda distribuído).
- Sandbox leva alguns segundos para subir (Chrome + FFmpeg).
- **Timeouts:** 45 min (Hobby), 5 h (Pro/Enterprise). **Concorrência:** 10 (Hobby), 2000 (Pro/Enterprise).

---

## 2. Pré-requisitos

| Item | Descrição |
|------|-----------|
| **Conta Vercel** | Projeto já deployado na Vercel (ex.: Afiliado Analytics). |
| **Plano** | Hobby funciona; para vídeos longos ou muitos usuários, Pro é recomendado (timeout 5 h, 2000 sandboxes). |
| **Vercel Blob** | Um Blob Store criado no dashboard da Vercel para guardar os MP4 gerados. |
| **Pacote `@remotion/vercel`** | Instalado no projeto para chamar a API de render no servidor. |

---

## 3. Passo a passo

### 3.1. Criar o Blob Store na Vercel

1. Acesse [vercel.com](https://vercel.com) → seu **projeto** (Afiliado Analytics).
2. Aba **Storage** (menu lateral).
3. **Create Database / Store** → escolha **Blob**.
4. Nome (ex.: `remotion-videos`) → **Create**.
5. **Connect to Project** e selecione o projeto do Afiliado Analytics.
6. Anote o nome do store (será usado como variável de ambiente).

Isso gera automaticamente variáveis como `BLOB_READ_WRITE_TOKEN` no projeto. **Redeploy** após conectar o Blob ao projeto.

---

### 3.2. Instalar o pacote `@remotion/vercel`

No diretório do projeto:

```bash
npm install @remotion/vercel
```

Use uma versão compatível com seu `remotion` (ex.: mesma major). No seu `package.json` você tem `remotion: ^4.0.436`; use `@remotion/vercel@^4.0.x`.

---

### 3.3. Registrar uma Composition para o servidor

O Remotion no **player** do front usa `<Player component={...} inputProps={...} />`. No **servidor** (Vercel Sandbox) é preciso um **bundle** que tenha uma **Composition** registrada com um **ID fixo** e que receba `inputProps`.

Você precisa de um **arquivo root** (ex.: `remotion/Root.tsx`) que:

1. Use `registerRoot()` do Remotion.
2. Renderize um `<Composition>` com o **mesmo** componente que você usa no Gerador de Criativos (`VideoComposition`) e as **mesmas** props que o front envia.

Exemplo mínimo (adaptar ao seu `VideoComposition` e `VideoInputProps`):

```tsx
// remotion/Root.tsx
import React from "react";
import { registerRoot, Composition } from "remotion";
import { VideoComposition } from "./VideoComposition";
import type { VideoInputProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GeradorCriativos"
        component={VideoComposition}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          style: "showcase",
          media: [],
          voiceoverSrc: null,
          musicSrc: null,
          musicVolume: 0.5,
          captions: [],
          subtitleTheme: {} as any,
          productName: "",
          price: "",
          ctaText: "Link na bio",
          fps: 30,
          width: 1080,
          height: 1920,
          durationInFrames: 300,
        } as VideoInputProps}
        calculateMetadata={({ props }) => {
          return {
            durationInFrames: props.durationInFrames,
            fps: props.fps,
            width: props.width,
            height: props.height,
          };
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
```

- O **ID** `GeradorCriativos` será usado na API de render.
- `defaultProps` deve bater com `VideoInputProps`; o servidor envia `inputProps` que sobrescrevem esses valores.
- `calculateMetadata` permite que duração, fps e dimensões venham das props (como no seu fluxo atual).

Esse root é usado para **gerar o bundle** que o Vercel Sandbox vai executar (ver próximo passo).

---

### 3.4. Gerar o bundle Remotion

O Sandbox não usa o Next.js diretamente; ele precisa de um **bundle estático** do Remotion (HTML + JS).

No `package.json` você já tem `@remotion/cli`. Adicione um script:

```json
"scripts": {
  "remotion:bundle": "remotion bundle remotion/Root.tsx --out-dir out/bundle"
}
```

- `remotion/Root.tsx` é o arquivo que chama `registerRoot` e contém a `<Composition>`.
- `out/bundle` é onde o Remotion gera os arquivos. Esse diretório (ou seu conteúdo) deve ser o que você envia para o Sandbox (ver 3.5).

Rode uma vez localmente para validar:

```bash
npm run remotion:bundle
```

Se der erro (ex.: imports do Next ou de paths do app), ajuste o root para usar apenas código que o Remotion consiga empacotar (evite imports de `@/`, de APIs do Next, etc.).

---

### 3.5. API de render no Next.js (App Router)

Crie uma rota que:

1. Recebe os **inputProps** do vídeo (o mesmo objeto que o front usa no Player).
2. Cria um sandbox (`createSandbox()`).
3. Coloca o bundle no sandbox (`addBundleToSandbox()`).
4. Chama `renderMediaOnVercel()` com `compositionId: "GeradorCriativos"` e os `inputProps`.
5. Faz upload do MP4 para o Vercel Blob (`uploadToVercelBlob()`).
6. Retorna a URL do vídeo (ou um link de download).

Exemplo de esqueleto (adaptar imports e paths):

```ts
// app/api/remotion/render-mp4/route.ts
import { NextResponse } from "next/server";
import { createSandbox, addBundleToSandbox, renderMediaOnVercel, uploadToVercelBlob } from "@remotion/vercel";
import path from "path";

export const maxDuration = 300; // 5 min (Pro); Hobby ~60

export async function POST(req: Request) {
  const body = await req.json();
  const inputProps = body.inputProps; // VideoInputProps do front

  const sandbox = await createSandbox();
  try {
    const bundleDir = path.join(process.cwd(), "out", "bundle");
    await addBundleToSandbox({ sandbox, localPath: bundleDir });

    const { sandboxFilePath } = await renderMediaOnVercel({
      sandbox,
      compositionId: "GeradorCriativos",
      inputProps,
      codec: "h264",
      onProgress: async (update) => {
        // opcional: enviar progresso por SSE ou WebSocket
        console.log(`Progress: ${Math.round(update.overallProgress * 100)}%`);
      },
    });

    const blobUrl = await uploadToVercelBlob({
      sandbox,
      sandboxFilePath,
      blobStoreId: process.env.BLOB_STORE_ID!, // ou nome do store
    });

    return NextResponse.json({ url: blobUrl });
  } finally {
    await sandbox.dispose();
  }
}
```

- **Importante:** O bundle precisa existir no servidor. No deploy da Vercel, o passo de build deve rodar `npm run remotion:bundle` e o diretório `out/bundle` deve ser incluído no deploy (não está em `.gitignore`). Ou use o método que a [documentação do Remotion](https://www.remotion.dev/docs/vercel-sandbox) recomenda (ex.: template oficial).
- Consulte a [doc do `@remotion/vercel`](https://www.remotion.dev/docs/vercel/api) para assinaturas exatas de `addBundleToSandbox` e `uploadToVercelBlob` (parâmetros podem ser `bundlePath`, `bucketName`, etc., conforme a versão).

---

### 3.6. Variáveis de ambiente no projeto Vercel

No projeto na Vercel → **Settings** → **Environment Variables**:

| Nome | Descrição |
|------|-----------|
| `BLOB_READ_WRITE_TOKEN` | Definido automaticamente ao conectar o Blob ao projeto. |
| `BLOB_STORE_ID` (ou o que a doc do `@remotion/vercel` pedir) | ID/nome do Blob Store, se a função de upload exigir. |

Redeploy após alterar variáveis.

---

### 3.7. Front: chamar a API e permitir download

No Gerador de Criativos (ex.: `video-editor/page.tsx`), no botão **Exportar MP4**:

1. Habilitar o botão (remover `disabled` quando houver configuração de render).
2. Ao clicar:
   - Montar o objeto `inputProps` igual ao que você passa para o `<Player>` (mesmo que `compositionProps`).
   - Fazer `POST /api/remotion/render-mp4` com `{ inputProps }`.
   - A resposta deve trazer `{ url: "https://..." }` (URL do Blob).
   - Mostrar um estado de “Renderizando… X%” se você implementar progresso (ex.: polling ou SSE).
   - Ao terminar, abrir a URL em nova aba ou iniciar download (ex.: `<a href={url} download>` ou `window.open(url)`).

Exemplo mínimo:

```ts
const [exporting, setExporting] = useState(false);
const [exportUrl, setExportUrl] = useState<string | null>(null);

const handleExportMp4 = async () => {
  setExporting(true);
  try {
    const res = await fetch("/api/remotion/render-mp4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputProps: compositionProps }),
    });
    const data = await res.json();
    if (data.url) setExportUrl(data.url);
  } finally {
    setExporting(false);
  }
};
```

---

## 4. Fluxo resumido

```
[Usuário clica Exportar MP4]
        ↓
[Front envia POST /api/remotion/render-mp4 com inputProps]
        ↓
[Next.js cria Sandbox, coloca bundle, chama renderMediaOnVercel]
        ↓
[Remotion renderiza MP4 dentro do Sandbox]
        ↓
[uploadToVercelBlob envia o arquivo para o Blob]
        ↓
[API retorna { url }]
        ↓
[Front exibe link ou inicia download]
```

---

## 5. Template oficial Remotion + Vercel (alternativa)

Se quiser seguir a estrutura que a Remotion testa e mantém:

1. Use o template:  
   `npx create-video@latest --template vercel`
2. Isso gera um projeto Next.js já com:
   - Root com Composition registrada
   - Rota de API que usa `renderMediaOnVercel` + `uploadToVercelBlob`
   - Blob conectado no deploy
3. Depois você pode **copiar** a pasta `remotion/`, o script de bundle e a rota de API para o Afiliado Analytics e adaptar para o seu `VideoComposition` e `VideoInputProps`.

Documentação: [Remotion – Vercel Sandbox](https://www.remotion.dev/docs/vercel-sandbox).

---

## 6. Limites e custos (resumo)

| Item | Hobby | Pro / Enterprise |
|------|--------|-------------------|
| Timeout por render | 45 min | 5 h |
| Sandboxes simultâneos | 10 | 2000 |
| Custo | Incluso no plano; excedente conforme [Vercel](https://vercel.com/docs/vercel-sandbox/pricing) | Idem |

Vídeos e arquivos no Blob **ficam armazenados** até você apagar. Configure [Spend Management](https://vercel.com/docs/accounts/spend-management) e limpe arquivos antigos se quiser controlar custo.

---

## 7. Checklist antes de usar em produção

- [ ] Blob Store criado e conectado ao projeto.
- [ ] `@remotion/vercel` instalado.
- [ ] Root com `<Composition id="GeradorCriativos">` e bundle gerado (`npm run remotion:bundle`).
- [ ] Rota `POST /api/remotion/render-mp4` implementada e testada (com `inputProps` reais).
- [ ] Build da Vercel inclui o bundle (ou gera no build).
- [ ] Botão “Exportar MP4” chama a API e trata resposta/erro e download.
- [ ] Variáveis de ambiente (Blob) configuradas e redeploy feito.

Se algo falhar, verifique os logs da função no dashboard da Vercel (Logs da rota) e a [documentação do Remotion para Vercel](https://www.remotion.dev/docs/vercel-sandbox).
