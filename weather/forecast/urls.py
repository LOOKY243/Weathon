from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('world/', views.world, name='world'),
    path('weather/', views.weather_api, name='weather_api'),
    path('forecast/', views.forecast_api, name='forecast_api'),
]