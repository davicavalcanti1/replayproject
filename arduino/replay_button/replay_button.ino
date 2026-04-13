/**
 * replay_button.ino
 * ESP8266 — botão físico de replay para o Replay MVP
 *
 * Ao apertar o botão, envia GET /botao para o backend Flask,
 * gerando clips de todas as câmeras ativas simultaneamente.
 *
 * Ligação do botão:
 *   Um lado  → D2 (GPIO 4)
 *   Outro    → GND
 *   (usa pull-up interno — não precisa de resistor externo)
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

const char* ssid       = "brisa-1349363";
const char* password   = "u1n3gpob";
const char* serverUrl  = "http://192.168.0.12:5000/botao";

#define BUTTON_PIN D2
#define COOLDOWN_MS 3000   // tempo mínimo entre dois disparos (ms)

unsigned long lastPressTime = 0;

void setup() {
  Serial.begin(9600);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  WiFi.begin(ssid, password);
  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" conectado!");
  Serial.print("IP do ESP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Reconecta automaticamente se cair o WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi perdido, reconectando...");
    WiFi.begin(ssid, password);
    delay(3000);
    return;
  }

  if (digitalRead(BUTTON_PIN) == LOW) {
    unsigned long now = millis();
    if (now - lastPressTime < COOLDOWN_MS) {
      delay(50);
      return; // ignora se pressionou muito rápido de novo
    }
    lastPressTime = now;

    Serial.println("Botao pressionado! Gerando replay...");

    WiFiClient client;
    HTTPClient http;
    http.begin(client, serverUrl);
    int httpCode = http.GET();

    if (httpCode == 200) {
      Serial.println("Replay gerado com sucesso!");
    } else {
      Serial.print("Erro: ");
      Serial.println(httpCode);
    }

    http.end();
    delay(200); // debounce
  }
}
