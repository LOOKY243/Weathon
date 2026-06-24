from django.http import JsonResponse
from django.shortcuts import render

from . import services
import requests


def home(request):
    return render(request, 'forecast/home.html')


def world(request):
    return render(request, 'forecast/world.html')


def weather_api(request):
    lat, lng = request.GET.get("lat"), request.GET.get("lng")
    if not lat or not lng:
        return JsonResponse({"error": "lat and lng are required"}, status=400)
    try:
        data = services.get_weather(float(lat), float(lng))
    except (ValueError, requests.RequestException):
        return JsonResponse({"error": "Unable to fetch weather data"}, status=502)
    return JsonResponse(data)


def forecast_api(request):
    lat, lng = request.GET.get("lat"), request.GET.get("lng")
    if not lat or not lng:
        return JsonResponse({"error": "lat and lng are required"}, status=400)
    try:
        data = services.get_forecast(float(lat), float(lng))
    except (ValueError, requests.RequestException):
        return JsonResponse({"error": "Unable to fetch forecast data"}, status=502)
    return JsonResponse(data)