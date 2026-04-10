# Sugestões de Melhorias — Replay MVP

## Prioridade alta

### 1. Banco de dados
Tudo está in-memory. Se o Flask reiniciar, perde usuários, clips e câmeras IP cadastradas.
Migrar para SQLite (simples) ou MySQL/PostgreSQL.

### 2. Persistir câmeras IP
Salvar IPs cadastrados em arquivo/banco para reconectar automaticamente ao reiniciar o servidor.

### 3. Hash de senhas
Senhas dos usuários estão em texto puro. Usar `bcrypt` ou `werkzeug.security`.

---

## Prioridade média

### 4. Aumentar buffer de replay
10 segundos é pouco pra replay útil. Subir pra 30-60s (testar consumo de memória).

### 5. Download de clips no mobile
Verificar se o botão de download funciona corretamente no celular.

### 6. PWA (Progressive Web App)
Adicionar `manifest.json` e service worker pra instalar como app no celular.

### 7. Notificações
Alertar quando uma câmera IP cai ou reconecta.

---

## Prioridade baixa

### 8. Multi-channel (DVR Intelbras)
DVRs Intelbras têm vários canais (channel=1,2,3...). Permitir adicionar múltiplos canais do mesmo IP de uma vez.

### 9. Gravação contínua
Salvar stream em disco continuamente (não só buffer circular de 10s).

### 10. ONVIF
Descoberta automática de câmeras IP na rede via protocolo ONVIF (sem precisar digitar IP manualmente).
