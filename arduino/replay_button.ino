/**
 * replay_button.ino
 * ESP8266 — botão físico de replay para o Replay MVP
 *
 * Ao apertar o botão, envia POST /api/trigger-all para o backend Flask,
 * gerando clips de todas as câmeras ativas simultaneamente.
 *
 * Ligação do botão:
 *   Um lado  → GPIO D1 (pino 5 do NodeMCU)
 *   Outro    → GND
 *   (usa pull-up interno — não precisa de resistor externo)
 *
 * Bibliotecas necessárias (Arduino IDE → Gerenciador de Bibliotecas):
 *   - ESP8266WiFi       (já incluída no pacote ESP8266)
 *   - ESP8266HTTPClient (já incluída no pacote ESP8266)
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

// ── Configurações — edite aqui ────────────────────────────────────────────
const char* WIFI_SSID     = "SEU_WIFI";           // nome da rede Wi-Fi
const char* WIFI_PASSWORD = "SENHA_DO_WIFI";       // senha do Wi-Fi

// IP local do computador que roda o backend Flask (porta 5000)
// Exemplo: "192.168.1.100"
const char* BACKEND_HOST  = "192.168.1.100";
const int   BACKEND_PORT  = 5000;

// Token de segurança — deve ser igual ao TRIGGER_TOKEN no .env do backend.
// Deixe em branco ("") se não quiser usar autenticação.
const char* TRIGGER_TOKEN = "";
// ─────────────────────────────────────────────────────────────────────────

#define BUTTON_PIN  D1     // GPIO 5 — mude se usar outro pino
#define LED_PIN     LED_BUILTIN

// Debounce
#define DEBOUNCE_MS  200
// Cooldown entre disparos (evita múltiplos clips por segurar o botão)
#define COOLDOWN_MS  3000

unsigned long lastPressTime = 0;
bool          lastButtonState = HIGH;  // pull-up: solto = HIGH, pressionado = LOW

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN,    OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // LED apagado (active-low no NodeMCU)

  Serial.println("\n[Replay Button] Iniciando...");
  connectWiFi();
}

void loop() {
  // Reconecta se necessário
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Conexão perdida. Reconectando...");
    connectWiFi();
  }

  bool currentState = digitalRead(BUTTON_PIN);
  unsigned long now = millis();

  // Detecta borda de descida (solto → pressionado) com debounce + cooldown
  if (lastButtonState == HIGH && currentState == LOW) {
    if (now - lastPressTime > DEBOUNCE_MS + COOLDOWN_MS) {
      lastPressTime = now;
      Serial.println("[Botão] Pressionado — disparando replay...");
      triggerReplay();
    }
  }

  lastButtonState = currentState;
  delay(10);
}

// ── Conecta ao Wi-Fi ──────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("[WiFi] Conectando a %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Conectado! IP: %s\n", WiFi.localIP().toString().c_str());
    blinkLED(3, 100);  // 3 piscadas = conectado
  } else {
    Serial.println("\n[WiFi] Falha na conexão. Tentará novamente no próximo loop.");
  }
}

// ── Dispara o replay em todas as câmeras ─────────────────────────────────
void triggerReplay() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Sem Wi-Fi, cancelando.");
    return;
  }

  WiFiClient client;
  HTTPClient http;

  String url = String("http://") + BACKEND_HOST + ":" + BACKEND_PORT + "/api/trigger-all";
  Serial.printf("[HTTP] POST %s\n", url.c_str());

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");

  if (strlen(TRIGGER_TOKEN) > 0) {
    http.addHeader("X-Trigger-Token", TRIGGER_TOKEN);
  }

  // LED acende enquanto processa
  digitalWrite(LED_PIN, LOW);

  int httpCode = http.POST("{}");

  digitalWrite(LED_PIN, HIGH);

  if (httpCode > 0) {
    Serial.printf("[HTTP] Resposta: %d\n", httpCode);
    if (httpCode == 200) {
      Serial.println("[HTTP] Replay gerado com sucesso!");
      blinkLED(2, 200);  // 2 piscadas lentas = sucesso
    } else {
      Serial.printf("[HTTP] Erro do servidor: %d\n", httpCode);
      blinkLED(5, 80);   // 5 piscadas rápidas = erro
    }
  } else {
    Serial.printf("[HTTP] Falha na requisição: %s\n", http.errorToString(httpCode).c_str());
    blinkLED(5, 80);
  }

  http.end();
}

// ── Pisca o LED n vezes ───────────────────────────────────────────────────
void blinkLED(int times, int ms) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, LOW);
    delay(ms);
    digitalWrite(LED_PIN, HIGH);
    delay(ms);
  }
}
