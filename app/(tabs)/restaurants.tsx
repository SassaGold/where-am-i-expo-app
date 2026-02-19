import { useCallback, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Alert,
  Modal,
  Image,
  FlatList,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from "expo-location";
import { saveWaypoint } from "../../utils/tripUtils";
import { Ionicons } from "@expo/vector-icons";
import { Place, Review } from "../../types/places";
import { enhancePlaceWithDetails, searchPlacesByType } from "../../utils/placeDetails";
import { useTheme, Theme } from '../../utils/theme';

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

const getStyles = (theme: Theme): ReturnType<typeof StyleSheet.create> => StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: theme.colors.background,
  },
  header: {
    marginTop: 18,
    marginBottom: 20,
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  headerGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: theme.colors.glowPrimary,
    top: -80,
    right: -40,
  },
  headerGlowSecondary: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.colors.glowAccent,
    top: -60,
    left: -30,
  },
  headerBadge: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginBottom: 20,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: theme.colors.surface,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: "600",
    textAlign: 'center',
  },
  filtersContainer: {
    marginBottom: 20,
  },
  filterLabel: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  filterTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "500",
    marginRight: 12,
    minWidth: 60,
  },
  filterButtons: {
    flexDirection: "row",
    flex: 1,
  },
  filterButton: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterButtonText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  filterButtonTextActive: {
    color: theme.colors.surface,
  },
  placeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  placeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  placeName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    marginRight: 12,
  },
  placeCategory: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  placeAddress: {
    color: '#444',
    fontSize: 14,
    marginBottom: 8,
  },
  placeRating: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  ratingText: {
    color: theme.colors.text,
    fontSize: 14,
    marginLeft: 4,
  },
  placeActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: 24,
    padding: 18,
    maxHeight: 420,
    width: 340,
    alignSelf: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 36,
    elevation: 24,
    borderWidth: 2,
    borderColor: theme.colors.cardBorder,
    marginTop: 8,
    marginBottom: 8,
  },
  modalTitle: {
    color: theme.colors.primary,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.2,
    fontFamily: 'System',
  },
  placeImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignSelf: 'center',
    marginBottom: 18,
    borderWidth: 3,
    borderColor: theme.colors.accent,
  },
  placeDescription: {
    color: theme.colors.text,
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 18,
    textAlign: 'center',
  },
  placeDetails: {
    marginBottom: 18,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    color: theme.colors.secondary,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  detailValue: {
    color: theme.colors.text,
    fontSize: 15,
  },
  closeButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  closeButtonText: {
    color: theme.colors.surface,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  reviewCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewAuthor: {
    color: '#000',
    fontSize: 16,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
  },
  reviewText: {
    color: '#000',
    fontSize: 14,
    marginBottom: 4,
  },
  reviewDate: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  saveWaypointButton: {
    backgroundColor: theme.colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    margin: 20,
    marginTop: 0,
    borderRadius: 12,
  },
  saveWaypointButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: theme.colors.text,
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
    color: theme.colors.text,
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
});

export default function RestaurantsScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedData, setCachedData] = useState<Place[]>([]);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [showPlaceDetails, setShowPlaceDetails] = useState(false);

  const saveToCache = useCallback(async (placesData: Place[]) => {
    try {
      const cacheData = {
        places: placesData,
        timestamp: Date.now(),
        region: region
      };
      await AsyncStorage.setItem('restaurants_cache', JSON.stringify(cacheData));
    } catch (err) {
      console.log('Failed to save cache:', err);
    }
  }, [region]);

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem('restaurants_cache');
      if (cached) {
        const cacheData = JSON.parse(cached);
        setCachedData(cacheData.places || []);
        setCacheTimestamp(cacheData.timestamp);
        return cacheData.places || [];
      }
    } catch (err) {
      console.log('Failed to load cache:', err);
    }
    return [];
  }, []);

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsOffline(false);

    try {
      // Always use Oslo coordinates for testing
      const latitude = 59.9139;
      const longitude = 10.7522;

      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      // Search for restaurants using Google Places API (mock)
      const googlePlaces = await searchPlacesByType('restaurant', { lat: latitude, lng: longitude }, 5000);

      if (googlePlaces.length === 0) {
        setPlaces([]);
        return;
      }

      // Convert Google Places results to our Place format
      const mapped = googlePlaces.map((place: any) => {
        const placeObj: Place = {
          id: place.place_id,
          name: place.name,
          category: 'restaurant',
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          distanceMeters: haversineMeters(latitude, longitude, place.geometry.location.lat, place.geometry.location.lng),
          phone: null,
          website: null,
          openingHours: null,
          address: place.vicinity,
          description: null,
          photos: place.photos ? place.photos.map((p: any) => p.photo_reference) : [],
          reviews: [],
        };
        return placeObj;
      });

      // Enhance places with detailed information
      const enhancedPlaces = await Promise.all(
        mapped.map(place => enhancePlaceWithDetails(place))
      );

      const sortedPlaces = enhancedPlaces
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
        .slice(0, 20);

      setPlaces(sortedPlaces);
      await saveToCache(sortedPlaces);
    } catch (err) {
      // Try to load from cache if network fails
      const cachedPlaces = await loadFromCache();
      if (cachedPlaces.length > 0) {
        setPlaces(cachedPlaces);
        setIsOffline(true);
        setError("Using cached data - check your internet connection.");
      } else {
        setError("Unable to load restaurants. Please try again.");
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
        note: `Distance: ${formatDistance(place.distanceMeters)}`,
      });
      Alert.alert("Success", `${place.name} saved as waypoint`);
    } catch (err) {
      Alert.alert("Error", "Failed to save waypoint");
    }
  }, []);

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      const matchesSearch = searchQuery === "" || 
        place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        place.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDistance = distanceFilter === null || (place.distanceMeters ?? 0) <= distanceFilter;
      const matchesCategory = categoryFilter === null || place.category === categoryFilter;
      return matchesSearch && matchesDistance && matchesCategory;
    });
  }, [places, searchQuery, distanceFilter, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(places.map(p => p.category));
    return Array.from(cats).sort();
  }, [places]);

  const openPlaceDetails = useCallback((place: Place) => {
    setSelectedPlace(place);
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

  return (
    <>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerGlow} />
        <View style={styles.headerGlowSecondary} />
        <Text style={styles.headerBadge}>Eat nearby</Text>
        <Text style={styles.title}>Restaurants Near You</Text>
        <Text style={styles.subtitle}>Discover places to eat nearby.</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or category..."
          placeholderTextColor={theme.colors.textSecondary}
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
      </View>

      <Pressable style={styles.primaryButton} onPress={loadPlaces}>
        <Text style={styles.primaryButtonText}>
          {loading ? "Loading..." : "Find restaurants near me"}
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

      {filteredPlaces.length === 0 && !loading ? (
        <Text style={{ color: '#ef4444', fontWeight: '600', textAlign: 'center', fontSize: 16 }}>
          {places.length === 0 ? "No restaurants found yet. Try updating your location." : "No restaurants match your filters."}
        </Text>
      ) : (
        filteredPlaces.map((place) => (
          <View key={place.id} style={styles.placeCard}>
            <View style={styles.placeHeader}>
              <Ionicons name="restaurant" size={28} color={theme.colors.primary} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeCategory}>{place.category}</Text>
                {place.phone && <Text style={styles.placeCategory}>📞 {place.phone}</Text>}
              </View>
              <Text style={styles.ratingText}>{formatDistance(place.distanceMeters)}</Text>
            </View>
            <View style={styles.placeActions}>
              <Pressable onPress={() => openPlaceDetails(place)}>
                <Ionicons name="information-circle" size={22} color={theme.colors.primary} />
              </Pressable>
              <Pressable onPress={() => savePlaceAsWaypoint(place)}>
                <Ionicons name="bookmark" size={22} color={theme.colors.primary} />
              </Pressable>
            </View>
          </View>
        ))
      )}

      {MapView && region && filteredPlaces.length > 0 && (
        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={region} showsUserLocation>
            {filteredPlaces.map((place) => (
              <Marker
                key={place.id}
                coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                title={place.name}
                description={place.category}
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
      <ScrollView contentContainerStyle={styles.modalContainer}>
        {selectedPlace && (
          <View style={styles.modalContent}>
            {/* Accent Bar */}
            <View style={{ height: 6, backgroundColor: theme.colors.accent, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginHorizontal: -20, marginTop: -20, marginBottom: 16 }} />
            {/* Header with close button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Pressable onPress={closePlaceDetails} style={[styles.closeButton, { marginRight: 12 }]}> 
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </Pressable>
              <Text style={[styles.modalTitle, { flex: 1 }]}>{selectedPlace.name}</Text>
              </View>
            {/* Photo */}
            {selectedPlace.photos && selectedPlace.photos.length > 0 && (
              <Image source={{ uri: selectedPlace.photos[0] }} style={[styles.placePhoto, { borderRadius: 16, marginBottom: 18 }]} />
            )}
            {/* Basic Info */}
            <View style={{ marginBottom: 18 }}>
              <View style={styles.infoRow}>
                <Ionicons name="location" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>{formatDistance(selectedPlace.distanceMeters)} away</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="pricetag" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.infoText}>{selectedPlace.category}</Text>
              </View>
              {selectedPlace.address && (
                <View style={styles.infoRow}>
                  <Ionicons name="home" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.infoText}>{selectedPlace.address}</Text>
                </View>
              )}
              {selectedPlace.description && (
                <View style={styles.infoRow}>
                  <Ionicons name="information-circle" size={18} color={theme.colors.primary} style={{ marginRight: 8 }} />
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
                    <Ionicons name="call" size={16} color={theme.colors.primary} />
                    <Text style={styles.infoText}>{selectedPlace.phone}</Text>
                  </View>
                )}
                {selectedPlace.website && (
                  <View style={styles.infoRow}>
                    <Ionicons name="globe" size={16} color={theme.colors.primary} />
                    <Text style={styles.infoText}>{selectedPlace.website}</Text>
                  </View>
                )}
                {selectedPlace.openingHours && (
                  <View style={styles.infoRow}>
                    <Ionicons name="time" size={16} color={theme.colors.primary} />
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
                  <Ionicons name="call" size={20} color={theme.colors.surface} />
                  <Text style={styles.actionButtonText}>Call</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.actionButton}
                onPress={() => navigateToPlace(selectedPlace)}
              >
                <Ionicons name="navigate" size={20} color={theme.colors.surface} />
                <Text style={styles.actionButtonText}>Navigate</Text>
              </Pressable>
              {selectedPlace.website && (
                <Pressable
                  style={styles.actionButton}
                  onPress={() => openWebsite(selectedPlace.website!)}
                >
                  <Ionicons name="globe" size={20} color={theme.colors.surface} />
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
                            color={theme.colors.accent}
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

            {/* End of Modal Content */}
            <Pressable style={styles.closeButton} onPress={closePlaceDetails}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Modal>
  </View>
  </>
  );
}

