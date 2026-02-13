import { useCallback, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Modal,
  Image,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { saveWaypoint } from "../../utils/tripUtils";
import { Ionicons } from "@expo/vector-icons";
import { Place, Review } from "../../types/places";
import { enhancePlaceWithDetails, searchPlacesByType } from "../../utils/placeDetails";

let MapView: any = null;
let Marker: any = null;

if (Platform.OS !== "web") {
  try {
    const maps = eval('require("react-native-maps")');
    MapView = maps.MapView ?? maps.default;
    Marker = maps.Marker ?? maps.default.Marker;
  } catch (e) {
    // Handle error if react-native-maps is not available
  }
}

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

export default function McScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parking, setParking] = useState<Place[]>([]);
  const [fuelStations, setFuelStations] = useState<Place[]>([]);
  const [workshops, setWorkshops] = useState<Place[]>([]);
  const [region, setRegion] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [freeParkingOnly, setFreeParkingOnly] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedData, setCachedData] = useState<{parking: Place[], fuelStations: Place[], workshops: Place[]}>({parking: [], fuelStations: [], workshops: []});
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showPlaceDetails, setShowPlaceDetails] = useState(false);

  const saveToCache = useCallback(async (parkingData: Place[], fuelData: Place[], workshopData: Place[]) => {
    try {
      const cacheData = {
        parking: parkingData,
        fuelStations: fuelData,
        workshops: workshopData,
        timestamp: Date.now(),
        region: region
      };
      await AsyncStorage.setItem('mc_cache', JSON.stringify(cacheData));
    } catch (err) {
      console.log('Failed to save cache:', err);
    }
  }, [region]);

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('mc_cache');
      if (cached) {
        const cacheData = JSON.parse(cached);
        setCachedData({
          parking: cacheData.parking || [],
          fuelStations: cacheData.fuelStations || [],
          workshops: cacheData.workshops || []
        });
        setCacheTimestamp(cacheData.timestamp);
        return {
          parking: cacheData.parking || [],
          fuelStations: cacheData.fuelStations || [],
          workshops: cacheData.workshops || []
        };
      }
    } catch (err) {
      console.log('Failed to load cache:', err);
    }
    return { parking: [], fuelStations: [], workshops: [] };
  }, []);

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Location permission is required to find places.");
        // Try to load from cache even without permission
        const cachedData = await loadFromCache();
        if (cachedData.parking.length > 0 || cachedData.fuelStations.length > 0 || cachedData.workshops.length > 0) {
          setParking(cachedData.parking);
          setFuelStations(cachedData.fuelStations);
          setWorkshops(cachedData.workshops);
          setIsOffline(true);
          setError("Using cached data - location permission required for fresh data.");
        }
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = position.coords;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      // Search for motorcycle-related places using Google Places API
      const [parkingPlaces, fuelPlaces, workshopPlaces] = await Promise.all([
        searchPlacesByType('parking', { lat: latitude, lng: longitude }, 5000),
        searchPlacesByType('gas_station', { lat: latitude, lng: longitude }, 5000),
        searchPlacesByType('car_repair', { lat: latitude, lng: longitude }, 5000), // Using car_repair as closest match for motorcycle repair
      ]);

      // Convert Google Places results to our Place format
      const parkingResults = parkingPlaces.map((place: any) => ({
        id: place.place_id,
        name: place.name,
        category: 'parking',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        distanceMeters: haversineMeters(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
        note: undefined,
        fee: false, // Google doesn't provide fee info in basic search
      } as Place));

      const fuelResults = fuelPlaces.map((place: any) => ({
        id: place.place_id,
        name: place.name,
        category: 'fuel',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        distanceMeters: haversineMeters(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
        note: undefined,
        fee: false,
      } as Place));

      const workshopResults = workshopPlaces.map((place: any) => ({
        id: place.place_id,
        name: place.name,
        category: 'workshop',
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        distanceMeters: haversineMeters(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
        note: undefined,
        fee: false,
      } as Place));

      const sortedParking = parkingResults
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
        .slice(0, 20);
      const sortedFuel = fuelResults
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
        .slice(0, 20);
      const sortedWorkshops = workshopResults
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
        .slice(0, 20);

      // Enhance places with Google Places data
      const [enhancedParking, enhancedFuel, enhancedWorkshops] = await Promise.all([
        Promise.all(sortedParking.map(place => enhancePlaceWithDetails(place))),
        Promise.all(sortedFuel.map(place => enhancePlaceWithDetails(place))),
        Promise.all(sortedWorkshops.map(place => enhancePlaceWithDetails(place))),
      ]);

      setParking(enhancedParking);
      setFuelStations(enhancedFuel);
      setWorkshops(enhancedWorkshops);
      await saveToCache(enhancedParking, enhancedFuel, enhancedWorkshops);
    } catch (err) {
      // Try to load from cache if network fails
      const cachedData = await loadFromCache();
      if (cachedData.parking.length > 0 || cachedData.fuelStations.length > 0 || cachedData.workshops.length > 0) {
        setParking(cachedData.parking);
        setFuelStations(cachedData.fuelStations);
        setWorkshops(cachedData.workshops);
        setIsOffline(true);
        setError("Using cached data - check your internet connection.");
      } else {
        const message =
          err instanceof Error && err.message
            ? `Unable to load motorcycle data (${err.message}). Please try again.`
            : "Unable to load motorcycle data. Please try again.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [saveToCache, loadFromCache]);

  const openInMaps = useCallback((place: Place) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
    Linking.openURL(url).catch(() => null);
  }, []);

  const savePlaceAsWaypoint = useCallback(async (place: Place) => {
    try {
      await saveWaypoint({
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        category: place.category,
        note: `Distance: ${formatDistance(place.distanceMeters)}${place.fee !== undefined ? ` • ${place.fee ? 'Paid' : 'Free'}` : ''}${place.note ? ` • ${place.note}` : ''}`,
      });
      Alert.alert("Success", `${place.name} saved as waypoint`);
    } catch (err) {
      Alert.alert("Error", "Failed to save waypoint");
    }
  }, []);

  const allPlaces = useMemo(() => {
    return [...parking, ...fuelStations, ...workshops];
  }, [parking, fuelStations, workshops]);

  const openPlaceDetails = useCallback(async (place: Place) => {
    try {
      // Enhance place with Google Places data
      const enhancedPlace = await enhancePlaceWithDetails(place);
      setSelectedPlace(enhancedPlace);
    } catch (error) {
      console.log('Error enhancing place details:', error);
      // Fallback to original place if enhancement fails
      setSelectedPlace(place);
    }
    setShowPlaceDetails(true);
  }, []);

  const closePlaceDetails = useCallback(() => {
    setShowPlaceDetails(false);
    setSelectedPlace(null);
  }, []);

  const callPlace = useCallback(async (phone: string) => {
    const url = `tel:${phone}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Unable to make phone call');
    }
  }, []);

  const navigateToPlace = useCallback(async (place: Place) => {
    const url = Platform.OS === 'ios'
      ? `maps://app?daddr=${place.latitude},${place.longitude}`
      : `geo:${place.latitude},${place.longitude}?q=${encodeURIComponent(place.name)}`;

    try {
      await Linking.openURL(url);
    } catch (error) {
      // Fallback to web maps
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
      await Linking.openURL(webUrl);
    }
  }, []);

  const openWebsite = useCallback(async (website: string) => {
    try {
      await Linking.openURL(website);
    } catch (error) {
      Alert.alert('Error', 'Unable to open website');
    }
  }, []);

  const filteredPlaces = useMemo(() => {
    return allPlaces.filter((place) => {
      const matchesSearch = searchQuery === "" || 
        place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        place.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDistance = distanceFilter === null || (place.distanceMeters ?? 0) <= distanceFilter;
      const matchesCategory = categoryFilter === null || place.category === categoryFilter;
      const matchesFreeParking = !freeParkingOnly || (place.category === "Parking" && place.fee === true);
      return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
    });
  }, [allPlaces, searchQuery, distanceFilter, categoryFilter, freeParkingOnly]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(allPlaces.map(p => p.category));
    return Array.from(cats).sort();
  }, [allPlaces]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerGlowSecondary} />
        <Text style={styles.headerBadge}>Ride nearby</Text>
        <Text style={styles.title}>Motorcycle Parking, Fuel & Workshops</Text>
        <Text style={styles.subtitle}>
          Motorcycle parking, fuel stations, and workshops nearby.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or category..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>Filters:</Text>
        <View style={styles.filterRow}>
          <Text style={styles.filterTitle}>Distance:</Text>
          <View style={styles.filterButtons}>
            <Pressable
              style={[styles.filterButton, distanceFilter === null && styles.filterButtonActive]}
              onPress={() => setDistanceFilter(null)}
            >
              <Text style={[styles.filterButtonText, distanceFilter === null && styles.filterButtonTextActive]}>All</Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, distanceFilter === 1000 && styles.filterButtonActive]}
              onPress={() => setDistanceFilter(1000)}
            >
              <Text style={[styles.filterButtonText, distanceFilter === 1000 && styles.filterButtonTextActive]}>1km</Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, distanceFilter === 5000 && styles.filterButtonActive]}
              onPress={() => setDistanceFilter(5000)}
            >
              <Text style={[styles.filterButtonText, distanceFilter === 5000 && styles.filterButtonTextActive]}>5km</Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, distanceFilter === 10000 && styles.filterButtonActive]}
              onPress={() => setDistanceFilter(10000)}
            >
              <Text style={[styles.filterButtonText, distanceFilter === 10000 && styles.filterButtonTextActive]}>10km</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterTitle}>Type:</Text>
          <View style={styles.filterButtons}>
            <Pressable
              style={[styles.filterButton, categoryFilter === null && styles.filterButtonActive]}
              onPress={() => setCategoryFilter(null)}
            >
              <Text style={[styles.filterButtonText, categoryFilter === null && styles.filterButtonTextActive]}>All</Text>
            </Pressable>
            {uniqueCategories.slice(0, 3).map((cat) => (
              <Pressable
                key={cat}
                style={[styles.filterButton, categoryFilter === cat && styles.filterButtonActive]}
                onPress={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              >
                <Text style={[styles.filterButtonText, categoryFilter === cat && styles.filterButtonTextActive]}>{cat}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterTitle}>Parking:</Text>
          <View style={styles.filterButtons}>
            <Pressable
              style={[styles.filterButton, !freeParkingOnly && styles.filterButtonActive]}
              onPress={() => setFreeParkingOnly(false)}
            >
              <Text style={[styles.filterButtonText, !freeParkingOnly && styles.filterButtonTextActive]}>All Parking</Text>
            </Pressable>
            <Pressable
              style={[styles.filterButton, freeParkingOnly && styles.filterButtonActive]}
              onPress={() => setFreeParkingOnly(true)}
            >
              <Text style={[styles.filterButtonText, freeParkingOnly && styles.filterButtonTextActive]}>Free Only</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable style={styles.primaryButton} onPress={loadPlaces}>
        <Text style={styles.primaryButtonText}>
          {loading
            ? "Loading..."
            : "Find motorcycle parking, fuel, and workshops"}
        </Text>
      </Pressable>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Searching nearby places…</Text>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {isOffline && cacheTimestamp && (
        <View style={styles.offlineIndicator}>
          <Text style={styles.offlineText}>
            📱 Offline Mode - Data from {new Date(cacheTimestamp).toLocaleDateString()}
          </Text>
        </View>
      )}

      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Motorcycle Parking</Text>
        {parking.filter(p => {
          const matchesSearch = searchQuery === "" || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
          const matchesCategory = categoryFilter === null || p.category === categoryFilter;
          const matchesFreeParking = !freeParkingOnly || p.fee === true;
          return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
        }).length === 0 && !loading ? (
          <Text style={styles.bodyText}>
            {parking.length === 0 ? "No motorcycle parking found yet. Try updating your location." : "No parking matches your filters."}
          </Text>
        ) : (
          parking.filter(p => {
            const matchesSearch = searchQuery === "" || 
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.category.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
            const matchesCategory = categoryFilter === null || p.category === categoryFilter;
            const matchesFreeParking = !freeParkingOnly || p.fee === true;
            return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
          }).map((place) => (
            <View key={place.id} style={styles.placeRow}>
              <Pressable
                style={styles.placeInfo}
                onPress={() => openPlaceDetails(place)}
              >
                <Text style={styles.bodyText}>{place.name}</Text>
                <View style={styles.tagRow}>
                  <Text style={styles.metaText}>{place.category}</Text>
                  {place.note && (
                    <Text style={styles.highlightTag}>{place.note}</Text>
                  )}
                </View>
              </Pressable>
              <View style={styles.placeActions}>
                <Text style={styles.metaText}>
                  {formatDistance(place.distanceMeters)}
                </Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={styles.detailsButton}
                    onPress={() => openPlaceDetails(place)}
                  >
                    <Ionicons name="information-circle" size={16} color="#38bdf8" />
                  </Pressable>
                  <Pressable
                    style={styles.waypointButton}
                    onPress={() => savePlaceAsWaypoint(place)}
                    onMouseEnter={() => setHoveredTooltip(`${place.id}-waypoint`)}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  >
                    <Ionicons name="bookmark" size={16} color="#38bdf8" />
                  </Pressable>
                  {Platform.OS === 'web' && hoveredTooltip === `${place.id}-waypoint` && (
                    <View style={styles.waypointTooltip}>
                      <Text style={styles.waypointTooltipText}>Save as waypoint</Text>
                    </View>
                  )}
                  {Platform.OS !== 'web' && (
                    <Text style={styles.waypointMobileText}>Save as waypoint</Text>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Fuel Stations</Text>
        {fuelStations.filter(p => {
          const matchesSearch = searchQuery === "" || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
          const matchesCategory = categoryFilter === null || p.category === categoryFilter;
          const matchesFreeParking = !freeParkingOnly;
          return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
        }).length === 0 && !loading ? (
          <Text style={styles.bodyText}>
            {fuelStations.length === 0 ? "No fuel stations found yet. Try updating your location." : "No fuel stations match your filters."}
          </Text>
        ) : (
          fuelStations.filter(p => {
            const matchesSearch = searchQuery === "" || 
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.category.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
            const matchesCategory = categoryFilter === null || p.category === categoryFilter;
            const matchesFreeParking = !freeParkingOnly;
            return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
          }).map((place) => (
            <View key={place.id} style={styles.placeRow}>
              <Pressable
                style={styles.placeInfo}
                onPress={() => openInMaps(place)}
              >
                <Text style={styles.bodyText}>{place.name}</Text>
                <Text style={styles.metaText}>{place.category}</Text>
              </Pressable>
              <View style={styles.placeActions}>
                <Text style={styles.metaText}>
                  {formatDistance(place.distanceMeters)}
                </Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={styles.waypointButton}
                    onPress={() => savePlaceAsWaypoint(place)}
                    onMouseEnter={() => setHoveredTooltip(`${place.id}-waypoint`)}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  >
                    <Ionicons name="bookmark" size={16} color="#38bdf8" />
                  </Pressable>
                  {Platform.OS === 'web' && hoveredTooltip === `${place.id}-waypoint` && (
                    <View style={styles.waypointTooltip}>
                      <Text style={styles.waypointTooltipText}>Save as waypoint</Text>
                    </View>
                  )}
                  {Platform.OS !== 'web' && (
                    <Text style={styles.waypointMobileText}>Save as waypoint</Text>
                  )}
                  <View style={styles.favoriteButtonContainer}>
                    <Pressable
                      style={styles.favoriteButton}
                      onPress={() => toggleFavorite(place)}
                      onMouseEnter={() => setHoveredTooltip(place.id)}
                      onMouseLeave={() => setHoveredTooltip(null)}
                    >
                      <Text style={styles.favoriteButtonText}>♥</Text>
                    </Pressable>
                    {Platform.OS === 'web' && hoveredTooltip === place.id && (
                      <View style={styles.favoriteTooltip}>
                        <Text style={styles.favoriteTooltipText}>Add to favorites</Text>
                      </View>
                    )}
                    {Platform.OS !== 'web' && (
                      <Text style={styles.favoriteMobileText}>Add to favorites</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>MC Stores and Workshop</Text>
        {workshops.filter(p => {
          const matchesSearch = searchQuery === "" || 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
          const matchesCategory = categoryFilter === null || p.category === categoryFilter;
          const matchesFreeParking = !freeParkingOnly;
          return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
        }).length === 0 && !loading ? (
          <Text style={styles.bodyText}>
            {workshops.length === 0 ? "No motorbike workshops found yet. Try updating your location." : "No workshops match your filters."}
          </Text>
        ) : (
          workshops.filter(p => {
            const matchesSearch = searchQuery === "" || 
              p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.category.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
            const matchesCategory = categoryFilter === null || p.category === categoryFilter;
            const matchesFreeParking = !freeParkingOnly;
            return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
          }).map((place) => (
            <View key={place.id} style={styles.placeRow}>
              <Pressable
                style={styles.placeInfo}
                onPress={() => openInMaps(place)}
              >
                <Text style={styles.bodyText}>{place.name}</Text>
                <Text style={styles.metaText}>{place.category}</Text>
              </Pressable>
              <View style={styles.placeActions}>
                <Text style={styles.metaText}>
                  {formatDistance(place.distanceMeters)}
                </Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={styles.waypointButton}
                    onPress={() => savePlaceAsWaypoint(place)}
                    onMouseEnter={() => setHoveredTooltip(`${place.id}-waypoint`)}
                    onMouseLeave={() => setHoveredTooltip(null)}
                  >
                    <Ionicons name="bookmark" size={16} color="#38bdf8" />
                  </Pressable>
                  {Platform.OS === 'web' && hoveredTooltip === `${place.id}-waypoint` && (
                    <View style={styles.waypointTooltip}>
                      <Text style={styles.waypointTooltipText}>Save as waypoint</Text>
                    </View>
                  )}
                  {Platform.OS !== 'web' && (
                    <Text style={styles.waypointMobileText}>Save as waypoint</Text>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {MapView && region && filteredPlaces.length > 0 && (
        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={region} showsUserLocation>
            {parking.filter(p => {
              const matchesSearch = searchQuery === "" || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
              const matchesCategory = categoryFilter === null || p.category === categoryFilter;
              const matchesFreeParking = !freeParkingOnly || p.fee === true;
              return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
            }).map((place) => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                title={place.name}
                description={place.category}
                pinColor="blue"
                onCalloutPress={() => {}} // Prevent opening default maps app
              />
            ))}
            {fuelStations.filter(p => {
              const matchesSearch = searchQuery === "" || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
              const matchesCategory = categoryFilter === null || p.category === categoryFilter;
              const matchesFreeParking = !freeParkingOnly;
              return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
            }).map((place) => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                title={place.name}
                description={place.category}
                pinColor="red"
                onCalloutPress={() => {}} // Prevent opening default maps app
              />
            ))}
            {workshops.filter(p => {
              const matchesSearch = searchQuery === "" || 
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesDistance = distanceFilter === null || (p.distanceMeters ?? 0) <= distanceFilter;
              const matchesCategory = categoryFilter === null || p.category === categoryFilter;
              const matchesFreeParking = !freeParkingOnly;
              return matchesSearch && matchesDistance && matchesCategory && matchesFreeParking;
            }).map((place) => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                title={place.name}
                description={place.category}
                pinColor="green"
                onCalloutPress={() => {}} // Prevent opening default maps app
              />
            ))}
          </MapView>
        </View>
      )}
    </ScrollView>

    {/* Place Details Modal */}
    <Modal
      visible={showPlaceDetails}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closePlaceDetails}
    >
      <ScrollView style={styles.modalContainer}>
        {selectedPlace && (
          <>
            {/* Header with close button */}
            <View style={styles.modalHeader}>
              <Pressable onPress={closePlaceDetails} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#e2e8f0" />
              </Pressable>
              <Text style={styles.modalTitle}>{selectedPlace.name}</Text>
            </View>

            {/* Photos */}
            {selectedPlace.photos && selectedPlace.photos.length > 0 && (
              <View style={styles.photosContainer}>
                <FlatList
                  horizontal
                  data={selectedPlace.photos}
                  keyExtractor={(item, index) => `${selectedPlace.id}-photo-${index}`}
                  renderItem={({ item }) => (
                    <Image source={{ uri: item }} style={styles.placePhoto} />
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.photosList}
                />
              </View>
            )}

            {/* Basic Info */}
            <View style={styles.infoSection}>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={16} color="#38bdf8" />
                <Text style={styles.infoText}>
                  {formatDistance(selectedPlace.distanceMeters)} away
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="pricetag" size={16} color="#38bdf8" />
                <Text style={styles.infoText}>{selectedPlace.category}</Text>
              </View>
              {selectedPlace.fee !== undefined && (
                <View style={styles.infoRow}>
                  <Ionicons name={selectedPlace.fee ? "cash" : "cash-outline"} size={16} color="#f59e0b" />
                  <Text style={styles.infoText}>{selectedPlace.fee ? 'Free parking' : 'Paid parking'}</Text>
                </View>
              )}
              {selectedPlace.note && (
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle" size={16} color="#38bdf8" />
                  <Text style={styles.infoText}>{selectedPlace.note}</Text>
                </View>
              )}
              {selectedPlace.address && (
                <View style={styles.infoRow}>
                  <Ionicons name="home" size={16} color="#38bdf8" />
                  <Text style={styles.infoText}>{selectedPlace.address}</Text>
                </View>
              )}
              {selectedPlace.description && (
                <View style={styles.infoRow}>
                  <Ionicons name="document-text" size={16} color="#38bdf8" />
                  <Text style={styles.infoText}>{selectedPlace.description}</Text>
                </View>
              )}
            </View>

            {/* Contact Info */}
            {(selectedPlace.phone || selectedPlace.website || selectedPlace.openingHours) && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Contact & Hours</Text>
                {selectedPlace.phone && (
                  <View style={styles.infoRow}>
                    <Ionicons name="call" size={16} color="#38bdf8" />
                    <Text style={styles.infoText}>{selectedPlace.phone}</Text>
                  </View>
                )}
                {selectedPlace.website && (
                  <View style={styles.infoRow}>
                    <Ionicons name="globe" size={16} color="#38bdf8" />
                    <Text style={styles.infoText}>{selectedPlace.website}</Text>
                  </View>
                )}
                {selectedPlace.openingHours && (
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={16} color="#38bdf8" />
                    <Text style={styles.infoText}>{selectedPlace.openingHours}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {selectedPlace.phone && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => callPlace(selectedPlace.phone!)}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Call</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.actionButton}
                onPress={() => navigateToPlace(selectedPlace)}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Navigate</Text>
              </Pressable>
              {selectedPlace.website && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => openWebsite(selectedPlace.website!)}
                >
                  <Ionicons name="globe" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>Website</Text>
                </Pressable>
              )}
            </View>

            {/* Reviews */}
            {selectedPlace.reviews && selectedPlace.reviews.length > 0 && (
              <View style={styles.infoSection}>
                <Text style={styles.sectionTitle}>Reviews</Text>
                {selectedPlace.reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewAuthor}>{review.author}</Text>
                      <View style={styles.ratingContainer}>
                        {[...Array(5)].map((_, i) => (
                          <Ionicons
                            key={i}
                            name={i < review.rating ? "star" : "star-outline"}
                            size={14}
                            color="#f59e0b"
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewText}>{review.text}</Text>
                    <Text style={styles.reviewDate}>{review.date}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Save as waypoint button */}
            <Pressable
              style={styles.saveWaypointButton}
              onPress={() => {
                savePlaceAsWaypoint(selectedPlace);
                closePlaceDetails();
              }}
            >
              <Ionicons name="bookmark" size={20} color="#fff" />
              <Text style={styles.saveWaypointButtonText}>Save as Waypoint</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Modal>
    </View>
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
    backgroundColor: "#14532d",
  },
  headerGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(34,197,94,0.5)",
    top: -80,
    right: -40,
  },
  headerGlowSecondary: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(20,184,166,0.45)",
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
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#ffffff",
    marginTop: 6,
    fontSize: 15,
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
  sectionCard: {
    backgroundColor: "#1b1030",
    padding: 14,
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
  cardTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  bodyText: {
    color: "#e2e8f0",
    fontSize: 15,
    marginBottom: 12,
  },
  metaText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  placeRow: {
    backgroundColor: "#140c24",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2d1b4d",
    shadowColor: "#020617",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  placeInfo: {
    flex: 1,
    marginRight: 12,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  highlightTag: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "600",
  },
  mapContainer: {
    marginTop: 20,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2d1b4d",
  },
  map: {
    width: "100%",
    height: 300,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: "#1b1030",
    borderWidth: 1,
    borderColor: "#2d1b4d",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#e2e8f0",
    fontSize: 16,
  },
  filtersContainer: {
    backgroundColor: "#1b1030",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2d1b4d",
  },
  filterLabel: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterTitle: {
    color: "#c4b5fd",
    fontSize: 14,
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterButton: {
    backgroundColor: "#2d1b4d",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4c1d95",
  },
  filterButtonActive: {
    backgroundColor: "#6d28d9",
    borderColor: "#8b5cf6",
  },
  filterButtonText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: "#f8fafc",
    fontWeight: "600",
  },
  offlineIndicator: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  offlineText: {
    color: '#dbeafe',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  waypointButton: {
    backgroundColor: "#1e293b",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
  },
  waypointTooltip: {
    position: "absolute",
    bottom: 40,
    left: 0,
    backgroundColor: "#1e293b",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  waypointTooltipText: {
    color: "#f8fafc",
    fontSize: 12,
  },
  waypointMobileText: {
    position: "absolute",
    bottom: -20,
    left: 0,
    color: "#94a3b8",
    fontSize: 10,
  },
  detailsButton: {
    backgroundColor: "#1e293b",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
    marginRight: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#0f0a1a",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 50,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  closeButton: {
    marginRight: 16,
    padding: 8,
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
  },
  photosContainer: {
    height: 200,
    marginVertical: 16,
  },
  photosList: {
    paddingHorizontal: 20,
  },
  placePhoto: {
    width: 280,
    height: 180,
    borderRadius: 12,
    marginRight: 12,
  },
  infoSection: {
    backgroundColor: "#1b1030",
    margin: 20,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2d1b4d",
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    color: "#e2e8f0",
    fontSize: 15,
    marginLeft: 8,
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    margin: 20,
    marginTop: 0,
  },
  actionButton: {
    backgroundColor: "#38bdf8",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  reviewCard: {
    backgroundColor: "#0f0a1a",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2d1b4d",
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewAuthor: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
  },
  reviewText: {
    color: "#e2e8f0",
    fontSize: 14,
    marginBottom: 4,
  },
  reviewDate: {
    color: "#94a3b8",
    fontSize: 12,
  },
  saveWaypointButton: {
    backgroundColor: "#f59e0b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
  },
  saveWaypointButtonText: {
    color: "#2b0a3d",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
