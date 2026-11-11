---
name: clima-local
description: Obtiene el clima actual y el pronóstico de Neiva, Huila por defecto (o de otra ciudad si se indica) sin API key. Úsala cuando pregunte por el clima, la temperatura, si va a llover, el pronóstico o "qué tiempo hace".
argument-hint: "[ciudad opcional]"
allowed-tools: Bash(curl *), WebFetch
---

# Clima local

Consulta el clima con servicios gratuitos que no requieren API key. Responde siempre en español.

## Pasos

1. **Ubicación**
   - Si el usuario pasó una ciudad (`$ARGUMENTS`), úsala.
   - Si no, usa por defecto **Neiva, Huila (Colombia)**. No uses detección por IP.

2. **Consulta rápida (una línea)**

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=%l:+%c+%t+(sensación+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es&m"
   ```

   Por defecto `<CIUDAD>` = `Neiva,Huila,Colombia`. Con otra ciudad: `https://wttr.in/Bogota?...`.
   Los espacios del nombre van como `+` o `%20`.

3. **Pronóstico de 3 días (si lo piden)**

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=j1&lang=es&m"
   ```

   Del JSON usa `current_condition[0]` (temp_C, FeelsLikeC, humidity, windspeedKmph, lang_es/weatherDesc) y `weather[]` (maxtempC, mintempC, hourly[].chanceofrain).

4. **Fallback** si wttr.in falla o no responde: Open-Meteo (requiere coordenadas)
   - Neiva por defecto: latitud `2.9273`, longitud `-75.2819` (sin geocodificar).
   - Otra ciudad, geocodificar: `https://geocoding-api.open-meteo.com/v1/search?name=<CIUDAD>&count=1&language=es`
   - Clima: `https://api.open-meteo.com/v1/forecast?latitude=<LAT>&longitude=<LON>&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`

## Formato de respuesta

Breve, con unidades métricas (°C, km/h):

- Ubicación y condición actual
- Temperatura (y sensación térmica)
- Humedad, viento, probabilidad de lluvia
- Si hay pronóstico: una línea por día (mín/máx y lluvia)
- Una recomendación corta si aplica (paraguas, abrigo, etc.)

## Notas

- Indica siempre en la respuesta que la ubicación es Neiva, Huila, salvo que el usuario haya pedido otra.
- Si no hay conexión a internet, díselo al usuario; no inventes datos.
- En PowerShell usa `curl.exe` (no el alias `curl`) o `Invoke-RestMethod`.
