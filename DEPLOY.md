# Deploy: Edge (PC local) + Frontend (EasyPanel)

Setup completo para ter o backend rodando num PC local 24/7 (conectado às câmeras e ao ESP8266) e o frontend hospedado no EasyPanel, acessível de qualquer dispositivo via internet.

## Arquitetura

```
┌──────────────────────────────────┐        ┌────────────────────────┐
│  PC LOCAL (sua rede)             │        │  EASYPANEL             │
│  ════════════════════════════════│        │  ════════════════════  │
│  • Câmeras IP/USB                │        │  • Frontend React      │
│  • Flask backend (:5000)         │ HTTPS  │    (Nginx estático)    │
│  • ESP8266 botão (LAN)           │ ←────→ │  • Domínio público     │
│  • Cloudflare Tunnel             │ tunnel │  • SSL automático      │
└──────────────────────────────────┘        └──────────┬─────────────┘
                                                       │
                                           Usuários via Google Chrome
                                           de qualquer lugar
```

---

## Passo 1 — Cloudflare Tunnel no PC local

O Cloudflare Tunnel expõe `localhost:5000` como `https://seu-subdominio.trycloudflare.com` (ou domínio próprio), **sem abrir porta no roteador**.

### 1.1 Instalar `cloudflared` no Windows

```powershell
winget install --id Cloudflare.cloudflared
# ou baixe direto: https://github.com/cloudflare/cloudflared/releases/latest
```

Confirma:
```bash
cloudflared --version
```

### 1.2 Tunnel rápido (URL temporária, sem conta)

Pra testar primeiro, sem configurar domínio:

```bash
cloudflared tunnel --url http://localhost:5000
```

Vai aparecer algo como:
```
https://random-name-xxxx.trycloudflare.com
```

Essa URL é **temporária** (muda a cada restart) — boa só pra testar. Pro final, use o passo 1.3.

### 1.3 Tunnel persistente com domínio próprio

1. Crie conta gratuita em [dash.cloudflare.com](https://dash.cloudflare.com).
2. Adicione um domínio (ex: `seudominio.com`) ao Cloudflare (os nameservers do domínio precisam apontar pro Cloudflare).
3. No terminal, no PC local:

   ```bash
   cloudflared tunnel login
   # abre o browser pra autorizar
   
   cloudflared tunnel create replay-edge
   # copia o UUID que aparece
   
   cloudflared tunnel route dns replay-edge api.seudominio.com
   ```

4. Cria `C:\Users\<SEU_USER>\.cloudflared\config.yml`:

   ```yaml
   tunnel: <UUID_DO_PASSO_3>
   credentials-file: C:\Users\<SEU_USER>\.cloudflared\<UUID>.json
   
   ingress:
     - hostname: api.seudominio.com
       service: http://localhost:5000
     - service: http_status:404
   ```

5. Roda o tunnel:

   ```bash
   cloudflared tunnel run replay-edge
   ```

6. (Opcional, recomendado) Instala como serviço do Windows pra subir com o PC:

   ```bash
   cloudflared service install
   ```

Confirma: acessa `https://api.seudominio.com/health` do celular. Deve retornar JSON das câmeras.

---

## Passo 2 — Rodar o backend no PC local

### 2.1 Via Docker (recomendado, auto-restart)

No PC com as câmeras:

```bash
cd C:\Users\DELL\Desktop\replay_mvp
```

Edita `docker-compose.yml` pra ajustar as variáveis de ambiente:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    devices:
      - /dev/video0:/dev/video0
    restart: unless-stopped      # sobe automaticamente após reboot
    environment:
      - BUFFER_SECONDS=60
      - CAPTURE_FPS=30
      - CAMERA_INDICES=0,2
      - SECRET_KEY=troque-isso-uma-string-longa-aleatoria
      - FRONTEND_ORIGINS=https://replay.seudominio.com
      - SESSION_COOKIE_SAMESITE=None
      - SESSION_COOKIE_SECURE=1
      - TRIGGER_TOKEN=          # deixe em branco se ESP fica na mesma LAN
```

Sobe:

```bash
docker compose up -d backend
docker compose logs -f backend      # acompanha
```

### 2.2 Ou, direto com Python (sem Docker)

```bash
cd C:\Users\DELL\Desktop\replay_mvp\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# seta env vars (PowerShell)
$env:BUFFER_SECONDS="60"
$env:CAPTURE_FPS="30"
$env:FRONTEND_ORIGINS="https://replay.seudominio.com"
$env:SESSION_COOKIE_SAMESITE="None"
$env:SESSION_COOKIE_SECURE="1"
$env:SECRET_KEY="uma-chave-longa-aleatoria"

python app.py
```

---

## Passo 3 — Hospedar o frontend no EasyPanel

### 3.1 Preparar o repo

Verifica que esses arquivos existem (já criados):
- `frontend/Dockerfile.prod` — build + Nginx
- `frontend/nginx.prod.conf` — config do Nginx
- `frontend/.env.example` — referência das variáveis

Sobe o código pro GitHub (ou GitLab) — EasyPanel puxa de lá.

### 3.2 Criar serviço no EasyPanel

1. No painel EasyPanel, **Create Service → App**.
2. Preenche:
   - **Nome:** `replay-frontend`
   - **Source:** GitHub, seleciona o repo, branch `main`, **build context:** `frontend/`
   - **Build type:** Dockerfile, caminho: `Dockerfile.prod`
   - **Build args:** 
     - `VITE_API_URL` = `https://api.seudominio.com`
   - **Port:** 80
3. Em **Domains**, adiciona `replay.seudominio.com` (cria automaticamente cert Let's Encrypt).
4. **Deploy**.

Em 2-3 minutos deve estar no ar. Acessa `https://replay.seudominio.com` → tela de login.

---

## Passo 4 — Ajustes finais

### 4.1 Configurar o ESP8266 (botão físico)

O ESP8266 continua apontando pro **IP local** do PC (não passa pelo tunnel):

```cpp
const char* serverUrl = "http://192.168.x.x:5000/botao";
```

O botão é LAN. Só o frontend remoto precisa do tunnel.

### 4.2 Testar tudo ponta-a-ponta

1. Abre `https://replay.seudominio.com` do celular em rede 4G (fora da sua LAN).
2. Faz login com `admin/admin`.
3. Vai em **Menu (avatar) → Admin · Câmeras & Sistema** — deve mostrar câmeras online, CPU/RAM do PC.
4. Aperta o botão físico na sua casa.
5. Volta no celular — em 5s o clipe novo deve aparecer.
6. Testa baixar 10s / 30s / 1min.

### 4.3 Se o PC cair

- Docker `restart: unless-stopped` reinicia o Flask quando ele morrer.
- `cloudflared service install` mantém o tunnel subindo automático no boot.
- Pra monitorar, pode usar **UptimeRobot** (gratuito) pingando `https://api.seudominio.com/health` a cada 5 min — te avisa por e-mail se cair.

---

## Variáveis de ambiente — referência

### Backend (PC local)

| Variável | Padrão | Descrição |
|---|---|---|
| `BUFFER_SECONDS` | 10 | Tamanho do buffer circular por câmera (agora recomendo 60) |
| `CAPTURE_FPS` | 20 | FPS de captura (30 pra IP mainstream) |
| `CAMERA_INDICES` | `0,1,2,3` | Índices USB a abrir; vazio = auto-detect |
| `CAMERA_USER`, `CAMERA_PASSWORD` | `admin/admin` | Credenciais RTSP padrão Intelbras |
| `TRIGGER_TOKEN` | "" | Se setado, ESP precisa mandar header `X-Trigger-Token` |
| `SECRET_KEY` | `replay-mvp-secret-2024` | **Troque** em produção |
| `FRONTEND_ORIGINS` | "" | Origins permitidas p/ CORS, ex: `https://replay.seu.com,https://app.seu.com` |
| `SESSION_COOKIE_SAMESITE` | `Lax` | **Use `None` em produção** cross-site |
| `SESSION_COOKIE_SECURE` | `0` | **`1` em produção** (cookie só via HTTPS) |
| `PREFER_SUBSTREAM` | `0` | `1` força substream se mainstream travar |

### Frontend (EasyPanel)

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | "" | URL pública do backend, ex: `https://api.seudominio.com`. Build-time. |

---

## Troubleshooting

**Frontend carrega mas API dá erro CORS no console:**
Verifica que `FRONTEND_ORIGINS` no backend lista **exatamente** o domínio do frontend (inclui `https://` e sem `/` final).

**Login funciona mas aí tudo dá 401:**
Cookie não atravessa cross-site. Garante:
- Backend: `SESSION_COOKIE_SAMESITE=None` e `SESSION_COOKIE_SECURE=1`
- Acesso via **HTTPS** (tanto frontend quanto backend)
- O `VITE_API_URL` foi setado como **build arg** (e não só env runtime)

**Tunnel Cloudflare cai toda hora:**
Usa `cloudflared service install`. Se ainda cai, checa logs: `sc query cloudflared` no Windows.

**"Clips gravados" fica vazio mesmo apertando o botão:**
Confirme que o ESP alcança o backend (`http://IP_LOCAL:5000/botao` retornando 200). O frontend remoto não participa desse fluxo — só consome depois.

**RAM do PC estourou:**
`BUFFER_SECONDS=60` × `CAPTURE_FPS=30` × 4 câmeras ≈ 360MB. Baixa uma das duas, ou roda menos câmeras.
