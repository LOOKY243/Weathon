from django.http import JsonResponse
import requests


WMO_CODES = {
    0: ("Clear sky", "☀️"),
    1: ("Mainly clear", "🌤️"),
    2: ("Partly cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Fog", "🌫️"),
    48: ("Depositing rime fog", "🌫️"),
    51: ("Light drizzle", "🌦️"),
    53: ("Moderate drizzle", "🌦️"),
    55: ("Dense drizzle", "🌦️"),
    56: ("Light freezing drizzle", "🌧️"),
    57: ("Dense freezing drizzle", "🌧️"),
    61: ("Slight rain", "🌦️"),
    63: ("Moderate rain", "🌦️"),
    65: ("Heavy rain", "🌧️"),
    66: ("Light freezing rain", "🌧️"),
    67: ("Heavy freezing rain", "🌧️"),
    71: ("Slight snow fall", "🌨️"),
    73: ("Moderate snow fall", "🌨️"),
    75: ("Heavy snow fall", "❄️"),
    77: ("Snow grains", "❄️"),
    80: ("Slight showers", "🌦️"),
    81: ("Moderate showers", "🌦️"),
    82: ("Heavy showers", "🌧️"),
    95: ("Thunderstorm", "⛈️"),
    96: ("Thunderstorm with slight hail", "⛈️"),
    99: ("Thunderstorm with heavy hail", "⛈️")
}


def describe_code(code):
    return WMO_CODES.get(code, ("Unknown", "🌍"))


def get_weather(lat, lng):

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": ["temperature_2m", "weather_code", "precipitation", "apparent_temperature", "is_day"],
    }
    response = requests.get(url, params = params, timeout = 10)
    response.raise_for_status()
    cur = response.json()["current"]

    condition, icon = describe_code(cur["weather_code"])
    return {
        "tempC": cur["temperature_2m"],
        "feelsC": cur["apparent_temperature"],
        "condition": condition,
        "precipMM": cur["precipitation"],
        "icon": icon,
        "isDay": cur["is_day"],
    }


def get_forecast(lat, lng):

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lng,
        "daily": ["weather_code", "temperature_2m_max", "temperature_2m_min", "apparent_temperature_max", "apparent_temperature_min", "uv_index_max", "precipitation_probability_max"],
        "hourly": ["temperature_2m", "weather_code"],
        "timezone": "auto",
    }
    response = requests.get(url, params = params, timeout = 10)
    response.raise_for_status()
    data = response.json()
    daily = data["daily"]
    hourly_data = data["hourly"]

    forecast = []
    for i in range(len(daily["time"])):
        condition, icon = describe_code(daily["weather_code"][i])
        forecast.append({
            "day": daily["time"][i],
            "high": daily["temperature_2m_max"][i],
            "low": daily["temperature_2m_min"][i],
            "feels_high": daily["apparent_temperature_max"][i],
            "feels_low": daily["apparent_temperature_min"][i],
            "uv_index": daily["uv_index_max"][i],
            "precip_prob": daily["precipitation_probability_max"][i],
            "condition": condition,
            "icon": icon,
        })
    hourly = []
    for i in range(min(24, len(hourly_data["time"]))):
        condition, icon = describe_code(hourly_data["weather_code"][i])
        hourly.append({
            "time": hourly_data["time"][i],
            "temp": hourly_data["temperature_2m"][i],
            "condition": condition,
            "icon": icon,
        })

    return {"forecast": forecast, "hourly": hourly}
