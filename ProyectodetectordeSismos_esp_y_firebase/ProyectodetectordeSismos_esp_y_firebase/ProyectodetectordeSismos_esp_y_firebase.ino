#include <Wire.h>
#include <MPU6050.h>
#include <WiFi.h>
#include "SinricPro.h"
#include "SinricProMotionsensor.h"

// Firebase
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// WiFi
#define WIFI_SSID         "iPhone de Miguel Angel"
#define WIFI_PASS         "Miguel2009"

// SinricPro
#define APP_KEY           "0c4646ac-9f42-4384-9d56-b9c414457791"
#define APP_SECRET        "fe513169-3109-4918-b81d-b13aa78a7f2f-ca79e213-9263-4120-a666-b84ff0785820"
#define MOTIONSENSOR_ID   "66cfaf0b54041e4ff625b7a0"

// Firebase config
#define API_KEY "AIzaSyDBojWa1ebyrI9GxHNwfClLqm-k6T92-OY"
#define DATABASE_URL "https://alexadetectoradesismos-default-rtdb.firebaseio.com/" 
#define USER_EMAIL "miguelangelgarcianieto702@gmail.com"
#define USER_PASSWORD "1016038298"

// Objetos Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Otros objetos y variables
MPU6050 mpu;
bool lastMotionState = false;
unsigned long lastChange = 0;
bool myPowerState = true;
long ax_offset = 0, ay_offset = 0, az_offset = 0;

void setupWiFi() {
  Serial.printf("\r\n[WiFi]: Connecting");
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.printf(".");
    delay(250);
  }
  IPAddress localIP = WiFi.localIP();
  Serial.printf(" connected! IP: %d.%d.%d.%d\r\n", localIP[0], localIP[1], localIP[2], localIP[3]);
}

void setupSinricPro() {
  SinricProMotionsensor& myMotionsensor = SinricPro[MOTIONSENSOR_ID];
  SinricPro.onConnected([](){ Serial.printf("Connected to SinricPro\r\n"); });
  SinricPro.onDisconnected([](){ Serial.printf("Disconnected from SinricPro\r\n"); });
  SinricPro.begin(APP_KEY, APP_SECRET);
}

void calibrateSensor() {
  Serial.println("Calibrando... Mantén el sensor quieto durante 3 segundos");
  delay(3000);
  const int n = 1000;
  long sum_ax = 0, sum_ay = 0, sum_az = 0;
  for(int i=0; i<n; i++) {
    int16_t ax, ay, az;
    mpu.getAcceleration(&ax, &ay, &az);
    sum_ax += ax;
    sum_ay += ay;
    sum_az += az;
    delay(2);
  }
  ax_offset = sum_ax / n;
  ay_offset = sum_ay / n;
  az_offset = sum_az / n - 16384;
  Serial.println("Calibración lista!");
}

void setupFirebase() {
  config.api_key = API_KEY;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  config.database_url = DATABASE_URL;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void handleVibration() {
  if (!myPowerState) return;
  unsigned long actualMillis = millis();
  if (actualMillis - lastChange < 500) return;

  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  ax -= ax_offset;
  ay -= ay_offset;
  az -= az_offset;

  float aX = ax / 16384.0;
  float aY = ay / 16384.0;
  float aZ = az / 16384.0;
  float aTotal = sqrt(aX*aX + aY*aY + aZ*aZ);

  float threshold = 1.2;
  bool motionDetected = aTotal > threshold;

  if (motionDetected != lastMotionState) {
    Serial.printf("Vibration %s | aTotal=%.2f G\r\n", motionDetected?"detected":"not detected", aTotal);
    lastMotionState = motionDetected;
    lastChange = actualMillis;

    // SinricPro: no lo tocamos
    SinricProMotionsensor &myMotionsensor = SinricPro[MOTIONSENSOR_ID];
    myMotionsensor.sendMotionEvent(motionDetected);

    // Calcular magnitud estimada de sismo (escala inventada)
    float magnitud = log10((aTotal - 1.0) + 1) * 3.0;
    if (magnitud < 0) magnitud = 0;

    Serial.printf("Magnitud estimada: %.2f\n", magnitud);

    // Enviar a Firebase
    if (Firebase.ready()) {
      String path = "/sismos/ultimo";
      if (Firebase.RTDB.setFloat(&fbdo, path, magnitud)) {
        Serial.println("Magnitud enviada a Firebase!");
      } else {
        Serial.printf("Fallo al enviar a Firebase: %s\n", fbdo.errorReason().c_str());
      }
    }
  }
}

void setup() {
  Serial.begin(115200); Serial.println();
  Wire.begin(21, 22);
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("ERROR: no se encontró MPU6050!"); while(1);
  }
  calibrateSensor();
  setupWiFi();
  setupFirebase();
  setupSinricPro();
}

void loop() {
  handleVibration();
  SinricPro.handle();
}
