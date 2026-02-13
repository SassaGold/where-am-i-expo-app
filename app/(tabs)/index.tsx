import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as Location from "expo-location";
import Constants from "expo-constants";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Place } from "../../types/places";
import { searchPlacesByType } from "../../utils/placeDetails";

let NativeMapView: any = null;
let NativeMarker: any = null;

if (Platform.OS !== "web") {
  try {
    const maps = eval('require("react-native-maps")');
    NativeMapView = maps.default ?? maps.MapView ?? maps;
    NativeMarker = null;
  } catch (e) {
    // Handle error if react-native-maps is not available
    NativeMapView = null;
    NativeMarker = null;
  }
}

type GeoAddress = {
  displayName: string;
  city?: string;
  country?: string;
};

type WeatherInfo = {
  temperatureC?: number;
  windSpeed?: number;
  precipitation?: number;
  precipitationProbability?: number;
  weatherCode?: number;
  // Forecast data
  hourlyForecast?: {
    time: string[];
    temperature: number[];
    precipitation: number[];
    precipitationProbability: number[];
    weatherCode: number[];
    windSpeed: number[];
  };
  dailyForecast?: {
    time: string[];
    temperatureMax: number[];
    temperatureMin: number[];
    precipitationSum: number[];
    precipitationProbabilityMax: number[];
    weatherCode: number[];
    windSpeedMax: number[];
  };
};

type RidingConditions = {
  score: number; // 0-100
  suitability: 'excellent' | 'good' | 'fair' | 'poor' | 'dangerous';
  alerts: string[];
  recommendations: string[];
};

type Place = {
  id: string;
  name: string;
  category: string;
  distanceMeters?: number;
};

const haversineMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (distance?: number) => {
  if (distance === undefined) {
    return "";
  }
  if (distance < 1000) {
    return `${Math.round(distance)} m`;
  }
  return `${(distance / 1000).toFixed(1)} km`;
};

const formatWeatherCode = (code?: number) => {
  if (code === undefined) {
    return "";
  }
  const mapping: Record<number, string> = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Heavy rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm w/ hail",
    99: "Thunderstorm w/ heavy hail",
  };
  return mapping[code] ?? "Unknown";
};

const latLonToTile = (lat: number, lon: number, zoom: number) => {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
};


const weatherEmoji = (code?: number) => {
  if (code === undefined) {
    return "❓";
  }
  if (code === 0) return "☀️";
  if (code === 1 || code === 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([51, 53, 55].includes(code)) return "🌦️";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌡️";
};

const buildAlerts = (weather?: WeatherInfo) => {
  if (!weather) {
    return [] as string[];
  }
  const alerts: string[] = [];
  if ((weather.precipitationProbability ?? 0) >= 60) {
    alerts.push("Rain likely in the next hour.");
  }
  if ((weather.windSpeed ?? 0) >= 10) {
    alerts.push("Windy conditions nearby.");
  }
  if ((weather.temperatureC ?? 0) <= 0) {
    alerts.push("Freezing temperatures detected.");
  }
  if ((weather.temperatureC ?? 0) >= 32) {
    alerts.push("High heat — stay hydrated.");
  }
  return alerts;
};

const calculateRidingConditions = (weather: WeatherInfo): RidingConditions => {
  let score = 100; // Start with perfect score
  const alerts: string[] = [];
  const recommendations: string[] = [];

  // Temperature factors
  const temp = weather.temperatureC ?? 20;
  if (temp < 5) {
    score -= 40;
    alerts.push("Very cold - risk of frostbite");
    recommendations.push("Wear thermal gear, consider heated grips");
  } else if (temp < 10) {
    score -= 20;
    alerts.push("Cold weather");
    recommendations.push("Wear warm layers");
  } else if (temp > 30) {
    score -= 30;
    alerts.push("Very hot - risk of heat exhaustion");
    recommendations.push("Stay hydrated, wear light clothing");
  } else if (temp > 25) {
    score -= 15;
    alerts.push("Hot weather");
    recommendations.push("Drink water regularly");
  }

  // Wind factors
  const windSpeed = weather.windSpeed ?? 0;
  if (windSpeed > 15) {
    score -= 50;
    alerts.push("Very windy - dangerous riding conditions");
    recommendations.push("Avoid riding if possible, use extreme caution");
  } else if (windSpeed > 10) {
    score -= 30;
    alerts.push("Strong winds");
    recommendations.push("Lean into wind, reduce speed");
  } else if (windSpeed > 5) {
    score -= 10;
    alerts.push("Moderate winds");
    recommendations.push("Be cautious on exposed roads");
  }

  // Precipitation factors
  const precipProb = weather.precipitationProbability ?? 0;
  const currentPrecip = weather.precipitation ?? 0;

  if (currentPrecip > 5 || precipProb > 80) {
    score -= 60;
    alerts.push("Heavy rain - extremely dangerous");
    recommendations.push("Do not ride, seek shelter");
  } else if (currentPrecip > 1 || precipProb > 60) {
    score -= 40;
    alerts.push("Rain expected");
    recommendations.push("Wear waterproof gear, reduce speed, increase following distance");
  } else if (precipProb > 30) {
    score -= 20;
    alerts.push("Possible rain");
    recommendations.push("Check weather frequently, be prepared for rain");
  }

  // Weather code factors (severe weather)
  const weatherCode = weather.weatherCode ?? 0;
  if ([95, 96, 99].includes(weatherCode)) {
    score -= 70;
    alerts.push("Thunderstorm - extremely dangerous");
    recommendations.push("Do not ride, seek shelter immediately");
  } else if ([71, 73, 75, 77].includes(weatherCode)) {
    score -= 50;
    alerts.push("Snow/ice conditions");
    recommendations.push("Do not ride, roads may be icy");
  } else if ([45, 48].includes(weatherCode)) {
    score -= 15;
    alerts.push("Foggy conditions");
    recommendations.push("Use headlights, reduce speed, increase following distance");
  }

  // Check forecast for next few hours
  if (weather.hourlyForecast) {
    const nextHours = weather.hourlyForecast.precipitationProbability.slice(0, 6); // Next 6 hours
    const maxPrecipProb = Math.max(...nextHours);
    if (maxPrecipProb > 70) {
      score -= 25;
      alerts.push("Rain likely in next few hours");
      recommendations.push("Plan route to avoid bad weather");
    }
  }

  // Determine suitability
  let suitability: RidingConditions['suitability'];
  if (score >= 80) suitability = 'excellent';
  else if (score >= 60) suitability = 'good';
  else if (score >= 40) suitability = 'fair';
  else if (score >= 20) suitability = 'poor';
  else suitability = 'dangerous';

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return {
    score,
    suitability,
    alerts,
    recommendations,
  };
};

const getScoreColor = (score: number) => {
  if (score >= 80) return { color: '#10b981' }; // green
  if (score >= 60) return { color: '#84cc16' }; // lime
  if (score >= 40) return { color: '#f59e0b' }; // amber
  if (score >= 20) return { color: '#f97316' }; // orange
  return { color: '#ef4444' }; // red
};

const getSuitabilityStyle = (suitability: RidingConditions['suitability']) => {
  switch (suitability) {
    case 'excellent': return { backgroundColor: '#10b981', color: '#fff' };
    case 'good': return { backgroundColor: '#84cc16', color: '#fff' };
    case 'fair': return { backgroundColor: '#f59e0b', color: '#fff' };
    case 'poor': return { backgroundColor: '#f97316', color: '#fff' };
    case 'dangerous': return { backgroundColor: '#ef4444', color: '#fff' };
    default: return { backgroundColor: '#6b7280', color: '#fff' };
  }
};

export default function Index() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<GeoAddress | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [ridingConditions, setRidingConditions] = useState<RidingConditions | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mapError, setMapError] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const [mapProviderIndex, setMapProviderIndex] = useState(0);
  const [mapImageLoading, setMapImageLoading] = useState(false);
  const [mapImageLoaded, setMapImageLoaded] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Location permission is required to show nearby info.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(position);

      const { latitude, longitude } = position.coords;

      // Helper function to detect if we're running on Netlify (production)
      const isProduction = (): boolean => {
        if (Platform.OS !== 'web') return false;
        return typeof window !== 'undefined' && window.location.hostname.includes('netlify');
      };

      const addressPromise = (async () => {
        try {
          let url;
          if (isProduction()) {
            url = `/.netlify/functions/places-reverse-geocode?lat=${latitude}&lng=${longitude}`;
          } else if (Platform.OS === 'web') {
            url = `http://localhost:3001/api/geocode/reverse?lat=${latitude}&lng=${longitude}`;
          } else {
            // For mobile, use Google Geocoding API directly
            url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          }

          const response = await fetch(url);
          const data = await response.json();

          if (isProduction() || Platform.OS !== 'web') {
            // Google API response
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const result = data.results[0];
              const addressComponents = result.address_components;
              const city = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name ||
                          addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'))?.long_name;
              const country = addressComponents.find((c: any) => c.types.includes('country'))?.long_name;
              return {
                displayName: result.formatted_address,
                city,
                country,
              };
            }
          } else {
            // Proxy response (nominatim format)
            return {
              displayName: data.display_name as string,
              city: data.address?.city || data.address?.town || data.address?.village,
              country: data.address?.country,
            };
          }
          return null;
        } catch (error) {
          console.error('Error fetching address:', error);
          return null;
        }
      })();

      const weatherPromise = fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,wind_speed_10m_max&forecast_days=3&timezone=auto`
      )
        .then((response) => response.json())
        .then((data) => {
          const currentPrecipitationProbability =
            data.hourly?.precipitation_probability?.[0] ?? undefined;

          const weatherInfo: WeatherInfo = {
            temperatureC: data.current?.temperature_2m ?? undefined,
            windSpeed: data.current?.wind_speed_10m ?? undefined,
            precipitation: data.current?.precipitation ?? undefined,
            weatherCode: data.current?.weather_code ?? undefined,
            precipitationProbability: currentPrecipitationProbability,
            hourlyForecast: data.hourly ? {
              time: data.hourly.time || [],
              temperature: data.hourly.temperature_2m || [],
              precipitation: data.hourly.precipitation || [],
              precipitationProbability: data.hourly.precipitation_probability || [],
              weatherCode: data.hourly.weather_code || [],
              windSpeed: data.hourly.wind_speed_10m || [],
            } : undefined,
            dailyForecast: data.daily ? {
              time: data.daily.time || [],
              temperatureMax: data.daily.temperature_2m_max || [],
              temperatureMin: data.daily.temperature_2m_min || [],
              precipitationSum: data.daily.precipitation_sum || [],
              precipitationProbabilityMax: data.daily.precipitation_probability_max || [],
              weatherCode: data.daily.weather_code || [],
              windSpeedMax: data.daily.wind_speed_10m_max || [],
            } : undefined,
          };

          // Calculate riding conditions
          const ridingConditions = calculateRidingConditions(weatherInfo);
          setRidingConditions(ridingConditions);

          return weatherInfo;
        })
        .catch(() => null);

      const overpassQuery = `
[out:json][timeout:25];
(
  node(around:5000,${latitude},${longitude})[shop~"motorcycle|motorcycle_repair|car_repair"];
  way(around:5000,${latitude},${longitude})[shop~"motorcycle|motorcycle_repair|car_repair"];
  relation(around:5000,${latitude},${longitude})[shop~"motorcycle|motorcycle_repair|car_repair"];
);
out center 60;`;

      const placesPromise = searchPlacesByType('car_repair', { lat: latitude, lng: longitude }, 5000)
        .then((googlePlaces) => {
          const mapped = googlePlaces.map((place: any) => ({
            id: place.place_id,
            name: place.name,
            category: 'motorbike workshop',
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            distanceMeters: haversineMeters(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
          } as Place));
          return mapped
            .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
            .slice(0, 12);
        })
        .catch(() => [] as Place[]);

      const [addressResult, weatherResult, placesResult] = await Promise.all([
        addressPromise,
        weatherPromise,
        placesPromise,
      ]);

      setAddress(addressResult);
      setWeather(weatherResult);
      setPlaces(placesResult ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError("Unable to load location data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const alerts = useMemo(() => buildAlerts(weather ?? undefined), [weather]);
  const weatherUrl = "https://www.yr.no";
    const appOwnership = Constants.appOwnership ?? "expo";
    const isWeb = Platform.OS === "web";
    const useNativeMaps =
      !isWeb && !!NativeMapView && appOwnership !== "expo";

    const googleMapsStaticKey = useMemo(() => {
      return (
        (Constants.expoConfig?.extra as any)?.googleMapsStaticKey ??
        (Constants.manifest as any)?.extra?.googleMapsStaticKey
      );
    }, []);

    const mapProviders = useMemo(() => {
      if (!location) {
        return [] as string[];
      }
      const { latitude, longitude } = location.coords;
      const googleUrl = googleMapsStaticKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=600x300&scale=2&maptype=roadmap&markers=color:red%7C${latitude},${longitude}&key=${googleMapsStaticKey}`
      : undefined;
    const tileZoom = 15;
    const tile = latLonToTile(latitude, longitude, tileZoom);
    const osmProviders = [
      `https://maps.wikimedia.org/img/osm-intl,15,${latitude},${longitude},600x300.png`,
      `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=600x300&maptype=mapnik&markers=${latitude},${longitude},red-pushpin`,
      `https://tile.openstreetmap.org/${tileZoom}/${tile.x}/${tile.y}.png`,
    ];

    return [
      ...(googleUrl ? [googleUrl] : []),
      ...osmProviders,
    ];
  }, [location, googleMapsStaticKey]);

  const mapUrl = mapProviders[mapProviderIndex];
  const mapImageSource = mapUrl
    ? {
        uri: mapUrl,
        ...(Platform.OS === "web"
          ? {
              headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "image/png,image/*;q=0.8,*/*;q=0.5",
              },
            }
          : {}),
      }
    : undefined;

  const mapProviderLabel = mapUrl ? mapUrl.split("/")[2] : "";
  const mapAttribution = mapUrl?.includes("googleapis.com")
    ? "© Google"
    : "© OpenStreetMap contributors";

  const nativeRegion = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : undefined;


  useEffect(() => {
    setMapError(false);
    setMapErrorMessage(null);
    setMapProviderIndex(0);
  }, [mapProviders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (mapUrl && (!useNativeMaps || isWeb)) {
      setMapImageLoading(true);
      setMapImageLoaded(false);
    }
  }, [mapUrl, useNativeMaps, isWeb]);

  const retryMapPreview = () => {
    if (!mapProviders.length) {
      return;
    }
    setMapError(false);
    setMapProviderIndex((prev) => (prev + 1) % mapProviders.length);
  };

  const openMaps = useCallback(() => {
    if (!location) {
      return;
    }
    const { latitude, longitude } = location.coords;
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => null);
  }, [location]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerGlowSecondary} />
        <Text style={styles.headerBadge}>Live nearby</Text>
        <Text style={styles.title}>Where Am I?</Text>
        <Text style={styles.subtitle}>Your location and what’s around you.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Map Preview</Text>
        {!isWeb && !location && (
          <Text style={styles.bodyText}>
            Tap “Update my location” to load the map.
          </Text>
        )}
        {useNativeMaps && location && NativeMapView && nativeRegion && (
          <View style={styles.mapNativeContainer}>
            <NativeMapView
              style={styles.mapNative}
              region={nativeRegion}
              showsUserLocation
              showsMyLocationButton
            >
              {NativeMarker && (
                <NativeMarker
                  coordinate={{
                    latitude: nativeRegion.latitude,
                    longitude: nativeRegion.longitude,
                  }}
                  title="You are here"
                />
              )}
              {places.map((place) => (
                NativeMarker && (
                  <NativeMarker
                    key={place.id}
                    coordinate={{
                      latitude: place.latitude,
                      longitude: place.longitude,
                    }}
                    title={place.name}
                    description={place.category}
                  />
                )
              ))}
            </NativeMapView>
          </View>
        )}
        {!useNativeMaps && !isWeb && location && (
          <Text style={styles.bodyText}>
            Showing a static map preview. Use “Open in Maps” for live navigation.
          </Text>
        )}
        {!mapUrl && isWeb && (
          <Text style={styles.bodyText}>
            Tap “Update my location” to load the map.
          </Text>
        )}
        {!mapUrl && !isWeb && location && (
          <View>
            <Text style={styles.bodyText}>
              Map preview is unavailable right now. Tap “Update my location” to
              retry.
            </Text>
            <Text style={styles.metaText}>
              Debug: map URL not generated.
            </Text>
          </View>
        )}
        {mapUrl && !mapError && mapImageSource && (!useNativeMaps || isWeb) && (
          <View>
            <ExpoImage
              source={mapImageSource}
              style={styles.mapImage}
              contentFit="cover"
              onLoad={() => {
                setMapImageLoaded(true);
                setMapImageLoading(false);
                setMapErrorMessage(null);
              }}
              onError={() => {
                setMapErrorMessage("Image failed to load");
                if (mapProviderIndex < mapProviders.length - 1) {
                  setMapProviderIndex((prev) => prev + 1);
                } else {
                  setMapError(true);
                }
                setMapImageLoading(false);
              }}
            />
            <Text style={styles.attributionText}>{mapAttribution}</Text>
          </View>
        )}
        {!useNativeMaps && !isWeb && !googleMapsStaticKey && (
          <Text style={styles.metaText}>
            Google Maps preview requires a Static Maps API key in
            extra.googleMapsStaticKey.
          </Text>
        )}
        {mapUrl && mapImageLoading && (!useNativeMaps || isWeb) && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Loading map preview…</Text>
          </View>
        )}
        {mapUrl && mapError && (!useNativeMaps || isWeb) && (
          <View>
            <Text style={styles.bodyText}>
              Map preview is unavailable. If using Google Static Maps, make
              sure Maps Static API is enabled, billing is active, and the key
              is not restricted for HTTP referrers.
            </Text>
            <Pressable style={styles.secondaryButton} onPress={retryMapPreview}>
              <Text style={styles.secondaryButtonText}>
                Try another provider
              </Text>
            </Pressable>
          </View>
        )}
        {mapErrorMessage && (!useNativeMaps || isWeb) && (
          <Text style={styles.metaText}>Map error: {mapErrorMessage}</Text>
        )}
      </View>

      <Pressable style={styles.primaryButton} onPress={loadData}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Loading..." : "Update my location"}
        </Text>
      </Pressable>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Fetching local data…</Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {location && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Location</Text>
          <Text style={styles.bodyText}>
            {address?.displayName ?? "Address not available"}
          </Text>
          <Text style={styles.metaText}>
            Lat {location.coords.latitude.toFixed(5)} · Lon {location.coords.longitude.toFixed(5)}
          </Text>
          <Text style={styles.metaText}>
            Accuracy {Math.round(location.coords.accuracy ?? 0)} m
          </Text>
          <Pressable style={styles.secondaryButton} onPress={openMaps}>
            <Text style={styles.secondaryButtonText}>Open in Maps</Text>
          </Pressable>
        </View>
      )}

      {weather && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Local Weather</Text>
          <View style={styles.weatherRow}>
            <Text style={styles.weatherEmoji}>{weatherEmoji(weather.weatherCode)}</Text>
            <View>
              <Text style={styles.bodyText}>
                {formatWeatherCode(weather.weatherCode)} · {weather.temperatureC?.toFixed(1)}°C
              </Text>
              <Text style={styles.metaText}>
                Wind {weather.windSpeed?.toFixed(1)} m/s · Precip {weather.precipitation ?? 0} mm
              </Text>
            </View>
          </View>
          <Text style={styles.bodyText}>
            Rain chance {weather.precipitationProbability ?? 0}%
          </Text>

          {/* Riding Conditions */}
          {ridingConditions && (
            <View style={styles.ridingConditions}>
              <View style={styles.ridingScoreRow}>
                <Text style={styles.ridingScoreLabel}>Riding Suitability:</Text>
                <View style={styles.scoreContainer}>
                  <Text style={[styles.ridingScore, getScoreColor(ridingConditions.score)]}>
                    {ridingConditions.score}/100
                  </Text>
                  <Text style={[styles.suitabilityBadge, getSuitabilityStyle(ridingConditions.suitability)]}>
                    {ridingConditions.suitability.toUpperCase()}
                  </Text>
                </View>
              </View>

              {ridingConditions.alerts.length > 0 && (
                <View style={styles.ridingAlerts}>
                  <Text style={styles.alertsTitle}>⚠️ Riding Alerts:</Text>
                  {ridingConditions.alerts.map((alert, index) => (
                    <Text key={index} style={styles.alertText}>• {alert}</Text>
                  ))}
                </View>
              )}

              {ridingConditions.recommendations.length > 0 && (
                <View style={styles.ridingRecommendations}>
                  <Text style={styles.recommendationsTitle}>💡 Recommendations:</Text>
                  {ridingConditions.recommendations.map((rec, index) => (
                    <Text key={index} style={styles.recommendationText}>• {rec}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 3-Day Forecast */}
          {weather.dailyForecast && weather.dailyForecast.time.length > 0 && (
            <View style={styles.forecastContainer}>
              <Text style={styles.forecastTitle}>3-Day Forecast</Text>
              <View style={styles.forecastGrid}>
                {weather.dailyForecast.time.slice(0, 3).map((date, index) => (
                  <View key={date} style={styles.forecastDay}>
                    <Text style={styles.forecastDate}>
                      {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={styles.forecastEmoji}>
                      {weatherEmoji(weather.dailyForecast?.weatherCode[index])}
                    </Text>
                    <Text style={styles.forecastTemp}>
                      {weather.dailyForecast?.temperatureMax[index]?.toFixed(0)}° / {weather.dailyForecast?.temperatureMin[index]?.toFixed(0)}°
                    </Text>
                    <Text style={styles.forecastPrecip}>
                      {weather.dailyForecast?.precipitationProbabilityMax[index]}% rain
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Pressable
            style={styles.secondaryButton}
            onPress={() => Linking.openURL(weatherUrl).catch(() => null)}
          >
            <Text style={styles.secondaryButtonText}>Open yr.no</Text>
          </Pressable>
        </View>
      )}

      {alerts.length > 0 && (
        <View style={[styles.card, styles.alertCard]}>
          <Text style={styles.cardTitle}>Alerts</Text>
          {alerts.map((alert) => (
            <Text key={alert} style={styles.bodyText}>
              • {alert}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Access</Text>
        <View style={styles.quickAccessGrid}>
          <Pressable style={styles.quickAccessButton} onPress={() => router.push('/(tabs)/restaurants')}>
            <Ionicons name="restaurant" size={24} color="#38bdf8" />
            <Text style={styles.quickAccessText}>Restaurants</Text>
          </Pressable>
          <Pressable style={styles.quickAccessButton} onPress={() => router.push('/(tabs)/hotels')}>
            <View style={styles.hotelIcon}>
              <Ionicons name="bed" size={16} color="#38bdf8" />
              <Ionicons name="star" size={12} color="#38bdf8" style={{ marginLeft: -4 }} />
            </View>
            <Text style={styles.quickAccessText}>Hotels</Text>
          </Pressable>
          <Pressable style={styles.quickAccessButton} onPress={() => router.push('/(tabs)/attractions')}>
            <Ionicons name="camera" size={24} color="#38bdf8" />
            <Text style={styles.quickAccessText}>Attractions</Text>
          </Pressable>
          <Pressable style={styles.quickAccessButton} onPress={() => router.push('/(tabs)/mc')}>
            <Ionicons name="construct" size={24} color="#38bdf8" />
            <Text style={styles.quickAccessText}>MC Services</Text>
          </Pressable>
        </View>
      </View>

      {lastUpdated && (
        <Text style={styles.metaText}>
          Last updated {lastUpdated.toLocaleTimeString()}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: "#0f0a1a",
  },
  header: {
    marginTop: 18,
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    backgroundColor: "#3b0764",
  },
  headerGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(236,72,153,0.55)",
    top: -80,
    right: -40,
  },
  headerGlowSecondary: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(59,130,246,0.45)",
    bottom: -60,
    left: -20,
  },
  headerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(15,10,26,0.35)",
    color: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  title: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#c4b5fd",
    marginTop: 6,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#f59e0b",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryButtonText: {
    color: "#2b0a3d",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#6d28d9",
    backgroundColor: "#1b1030",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontSize: 14,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  loadingText: {
    color: "#cbd5f5",
  },
  errorText: {
    color: "#f87171",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#1b1030",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2d1b4d",
    shadowColor: "#020617",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  alertCard: {
    borderColor: "#f59e0b",
    borderWidth: 1,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  bodyText: {
    color: "#e2e8f0",
    fontSize: 15,
    marginBottom: 4,
  },
  metaText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  mapImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#2d1b4d",
  },
  mapNativeContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2d1b4d",
  },
  mapNative: {
    width: "100%",
    height: 220,
  },
  attributionText: {
    color: "#c4b5fd",
    fontSize: 11,
    marginTop: 6,
  },
  placeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  placeInfo: {
    flex: 1,
    marginRight: 12,
  },
  weatherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  weatherEmoji: {
    fontSize: 36,
  },
  quickAccessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  quickAccessButton: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  quickAccessText: {
    color: "#e2e8f0",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  hotelIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ridingConditions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  ridingScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ridingScoreLabel: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ridingScore: {
    fontSize: 18,
    fontWeight: "bold",
  },
  suitabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 10,
    fontWeight: "bold",
  },
  ridingAlerts: {
    marginBottom: 12,
  },
  alertsTitle: {
    color: "#f59e0b",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  alertText: {
    color: "#f59e0b",
    fontSize: 13,
    marginBottom: 2,
  },
  ridingRecommendations: {
    marginBottom: 12,
  },
  recommendationsTitle: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  recommendationText: {
    color: "#38bdf8",
    fontSize: 13,
    marginBottom: 2,
  },
  forecastContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  forecastTitle: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  forecastGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  forecastDay: {
    flex: 1,
    backgroundColor: "#1e293b",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  forecastDate: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  forecastEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  forecastTemp: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  forecastPrecip: {
    color: "#94a3b8",
    fontSize: 10,
  },
});
